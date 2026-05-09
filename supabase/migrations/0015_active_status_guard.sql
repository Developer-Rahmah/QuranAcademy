-- ============================================================
-- 0015_active_status_guard
--
-- Server-side enforcement of "the caller's profile must be active"
-- for every protected write path. The frontend already shows a
-- localized message and signs disabled users out, but RLS / RPC are
-- the ultimate authority — without these clauses a tampered client
-- (or a stale tab kept open while the account is being suspended)
-- could still reach Supabase and successfully INSERT/UPDATE rows.
--
-- Scope:
--   • new `is_caller_active()` helper (SECURITY DEFINER, STABLE)
--   • reports     INSERT/UPDATE/DELETE  → require caller active
--   • report_items INSERT/UPDATE/DELETE → require caller active
--   • set_student_status RPC            → refuse non-active callers
--
-- Read paths are intentionally NOT tightened. A suspended user might
-- still need to view their own historical data on signOut redirect;
-- their UI is already inaccessible because the auth context signs
-- them out client-side as soon as the new status reaches the SPA.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ---------------- helper ----------------------------------------------
-- SECURITY DEFINER avoids RLS recursion on `profiles` when the helper
-- is referenced from a policy on a different table. STABLE because
-- (auth.uid(), profiles.status) does not change within a single
-- statement, so the planner can short-circuit repeated calls.

CREATE OR REPLACE FUNCTION public.is_caller_active()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles
     WHERE id     = auth.uid()
       AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_caller_active() TO authenticated;

-- ---------------- reports ---------------------------------------------
DROP POLICY IF EXISTS "reports_insert_own"  ON public.reports;
DROP POLICY IF EXISTS "reports_update_own"  ON public.reports;
DROP POLICY IF EXISTS "reports_delete_own"  ON public.reports;

CREATE POLICY "reports_insert_own"
    ON public.reports FOR INSERT TO authenticated
    WITH CHECK (
        student_id = auth.uid()
        AND public.is_caller_active()
    );

-- Mirrors 0014: students may edit only their own reports, and only on
-- a date that is not in the future. Plus: the caller themselves must
-- be active.
CREATE POLICY "reports_update_own"
    ON public.reports FOR UPDATE TO authenticated
    USING (
        student_id = auth.uid()
        AND report_date <= CURRENT_DATE
        AND public.is_caller_active()
    )
    WITH CHECK (
        student_id = auth.uid()
        AND report_date <= CURRENT_DATE
        AND public.is_caller_active()
    );

CREATE POLICY "reports_delete_own"
    ON public.reports FOR DELETE TO authenticated
    USING (
        student_id = auth.uid()
        AND public.is_caller_active()
    );

-- ---------------- report_items ---------------------------------------
DROP POLICY IF EXISTS "report_items_insert_own" ON public.report_items;
DROP POLICY IF EXISTS "report_items_update_own" ON public.report_items;
DROP POLICY IF EXISTS "report_items_delete_own" ON public.report_items;

CREATE POLICY "report_items_insert_own"
    ON public.report_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
        AND public.is_caller_active()
    );

CREATE POLICY "report_items_update_own"
    ON public.report_items FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
        AND public.is_caller_active()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
        AND public.is_caller_active()
    );

CREATE POLICY "report_items_delete_own"
    ON public.report_items FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
        AND public.is_caller_active()
    );

-- ---------------- set_student_status RPC -----------------------------
-- Replaces the body from migration 0012 with a single added guard at
-- the top: a suspended / pending caller cannot mutate any student's
-- status, regardless of role. Everything else (per-role authorization,
-- relational fallback, target guardrails) is preserved verbatim.

CREATE OR REPLACE FUNCTION public.set_student_status(
    target uuid,
    new_status public.account_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id        uuid;
    caller_role      public.user_role;
    caller_status    public.account_status;
    target_role      public.user_role;
    is_member        boolean;
    is_teacher       boolean;
    is_supervisor    boolean;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, status
      INTO caller_role, caller_status
      FROM public.profiles
     WHERE id = caller_id;

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'caller has no profile' USING ERRCODE = '42501';
    END IF;

    -- New in 0015: refuse mutations from a caller whose own profile
    -- has been suspended or is still pending. Pairs with the
    -- frontend's auto-signout on profile.status change so a stale tab
    -- can never widen its scope.
    IF caller_status <> 'active' THEN
        RAISE EXCEPTION 'caller account is not active'
            USING ERRCODE = '42501';
    END IF;

    SELECT role INTO target_role FROM public.profiles WHERE id = target;
    IF target_role IS NULL THEN
        RAISE EXCEPTION 'target profile not found' USING ERRCODE = 'P0002';
    END IF;

    -- Hard guardrail: only admin can touch admin / supervisor_manager rows.
    IF target_role IN ('admin', 'supervisor_manager')
       AND caller_role <> 'admin' THEN
        RAISE EXCEPTION 'cannot modify org-level account'
            USING ERRCODE = '42501';
    END IF;

    -- Admin: full access.
    IF caller_role = 'admin' THEN
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    -- supervisor_manager: full access to non-org-level accounts (the
    -- guard above already blocks admin / supervisor_manager targets).
    IF caller_role = 'supervisor_manager' THEN
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    -- For teacher / halaqah_supervisor, the target MUST be a student.
    IF target_role <> 'student' THEN
        RAISE EXCEPTION 'target must be a student' USING ERRCODE = '42501';
    END IF;

    -- Teacher: allowed iff target is a member of a halaqah they own.
    IF caller_role = 'teacher' THEN
        SELECT EXISTS (
            SELECT 1
              FROM public.halaqahs h
              JOIN public.halaqah_members hm ON hm.halaqah_id = h.id
             WHERE h.teacher_id = caller_id
               AND hm.student_id = target
        ) INTO is_teacher;

        IF is_teacher THEN
            UPDATE public.profiles SET status = new_status WHERE id = target;
            RETURN;
        END IF;
    END IF;

    -- halaqah_supervisor: allowed iff target is a member of a halaqah
    -- they supervise.
    IF caller_role = 'halaqah_supervisor' THEN
        SELECT EXISTS (
            SELECT 1
              FROM public.halaqah_supervisors hs
              JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
             WHERE hs.user_id = caller_id
               AND hm.student_id = target
        ) INTO is_supervisor;

        IF is_supervisor THEN
            UPDATE public.profiles SET status = new_status WHERE id = target;
            RETURN;
        END IF;
    END IF;

    -- Dual-role fallback: profile.role might not be 'halaqah_supervisor'
    -- yet the user has supervisor rows. Allow if relational match.
    SELECT EXISTS (
        SELECT 1
          FROM public.halaqah_supervisors hs
          JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
         WHERE hs.user_id = caller_id
           AND hm.student_id = target
    ) INTO is_member;

    IF is_member THEN
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    RAISE EXCEPTION 'not authorized to manage this student'
        USING ERRCODE = '42501';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_student_status(uuid, public.account_status)
    TO authenticated;
