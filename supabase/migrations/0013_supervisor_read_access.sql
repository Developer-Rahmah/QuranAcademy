-- ============================================================
-- 0013_supervisor_read_access
--
-- WHY THIS MIGRATION EXISTS
-- -------------------------
-- The base RLS (migration 0003) was written before the
-- `halaqah_supervisor` and `supervisor_manager` roles existed
-- (they were introduced in 0009). As a result the base policies on
-- `profiles`, `halaqah_members`, `reports`, and `report_items`
-- silently deny reads to those two roles, which manifests as:
--
--   * SupervisorDashboard renders an empty student list.
--   * HalaqahDetails (when viewed by a halaqah_supervisor) shows
--     UUIDs instead of names because the joined `student:profiles`
--     payload is `null` under RLS.
--   * Phone / email / third_name never reach the UI even though
--     the SELECT clause asks for them.
--   * Reports-driven panels (consistency, last-7-days) are empty.
--
-- This migration ADDS read-only policies that grant:
--
--   halaqah_supervisor → can SELECT the rows belonging to halaqahs
--                        they have a row for in `halaqah_supervisors`.
--   supervisor_manager → can SELECT all rows in those tables
--                        EXCEPT admin profiles (org-level isolation).
--
-- It DOES NOT widen any write paths. The `set_student_status` RPC
-- (migration 0012) remains the only way for these roles to mutate
-- student status, so authorization stays funneled through one
-- inspectable function.
--
-- Idempotent — drops every prior policy by name before recreating.
-- ============================================================

-- ---------------- helpers --------------------------------------------
-- We re-use `get_my_role()` from migration 0002 (SECURITY DEFINER,
-- avoids RLS recursion).

-- ---------------- profiles -------------------------------------------
DROP POLICY IF EXISTS "profiles_supervisor_view_students"     ON public.profiles;
DROP POLICY IF EXISTS "profiles_supervisor_manager_view_all"  ON public.profiles;

-- A halaqah_supervisor can read profiles of students who are
-- members of any halaqah the supervisor is assigned to.
CREATE POLICY "profiles_supervisor_view_students"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM public.halaqah_supervisors hs
              JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
             WHERE hs.user_id   = auth.uid()
               AND hm.student_id = profiles.id
        )
    );

-- supervisor_manager can read every profile EXCEPT admin profiles.
-- (Admin rows stay isolated to enforce the spec rule that
-- supervisor_manager has no escalation path to admin accounts.)
CREATE POLICY "profiles_supervisor_manager_view_all"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        get_my_role() = 'supervisor_manager'
        AND profiles.role <> 'admin'
    );

-- ---------------- halaqah_members ------------------------------------
DROP POLICY IF EXISTS "members_select_supervisor"          ON public.halaqah_members;
DROP POLICY IF EXISTS "members_select_supervisor_manager"  ON public.halaqah_members;

-- A halaqah_supervisor can read all members of halaqahs they supervise.
CREATE POLICY "members_select_supervisor"
    ON public.halaqah_members FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM public.halaqah_supervisors hs
             WHERE hs.user_id    = auth.uid()
               AND hs.halaqah_id = halaqah_members.halaqah_id
        )
    );

-- supervisor_manager can read every halaqah_members row.
CREATE POLICY "members_select_supervisor_manager"
    ON public.halaqah_members FOR SELECT TO authenticated
    USING (get_my_role() = 'supervisor_manager');

-- ---------------- reports --------------------------------------------
DROP POLICY IF EXISTS "reports_select_supervisor"          ON public.reports;
DROP POLICY IF EXISTS "reports_select_supervisor_manager"  ON public.reports;

-- A halaqah_supervisor can read every report filed in halaqahs
-- they supervise — needed for consistency / week-strip aggregations.
CREATE POLICY "reports_select_supervisor"
    ON public.reports FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM public.halaqah_supervisors hs
             WHERE hs.user_id    = auth.uid()
               AND hs.halaqah_id = reports.halaqah_id
        )
    );

CREATE POLICY "reports_select_supervisor_manager"
    ON public.reports FOR SELECT TO authenticated
    USING (get_my_role() = 'supervisor_manager');

-- ---------------- report_items ---------------------------------------
DROP POLICY IF EXISTS "report_items_select_supervisor"          ON public.report_items;
DROP POLICY IF EXISTS "report_items_select_supervisor_manager"  ON public.report_items;

-- Mirror the report SELECT scope, joined through `reports`.
CREATE POLICY "report_items_select_supervisor"
    ON public.report_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
              FROM public.reports r
              JOIN public.halaqah_supervisors hs
                ON hs.halaqah_id = r.halaqah_id
             WHERE r.id        = report_items.report_id
               AND hs.user_id  = auth.uid()
        )
    );

CREATE POLICY "report_items_select_supervisor_manager"
    ON public.report_items FOR SELECT TO authenticated
    USING (get_my_role() = 'supervisor_manager');

-- Grants are unchanged — `authenticated` already had SELECT on these
-- tables; RLS is what gates the actual rows.
