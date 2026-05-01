-- ============================================================
-- 0010_halaqah_supervisors_rls_fix
--
-- Why this migration exists
-- -------------------------
-- 0009 created the `halaqah_supervisors` table with a single FOR ALL
-- policy. In production we observed `INSERT` requests succeeding at the
-- HTTP level (200 OK from PostgREST) but no row actually appearing in
-- the table. The most common cause is RLS denying the insert silently
-- — the response shape is ambiguous when an `insert(...)` returns zero
-- rows because the WITH CHECK clause failed.
--
-- This migration replaces the policies with explicit per-action policies
-- so each verb has the right CHECK / USING semantics, and broadens
-- SELECT so admins can read every row (the previous select_self policy
-- only let the supervisor read their own row, which is fine for the
-- post-login picker but breaks the "Halaqah supervisors" admin list).
--
-- Idempotent — drops every prior policy by name then recreates.
-- ============================================================

ALTER TABLE public.halaqah_supervisors ENABLE ROW LEVEL SECURITY;

-- Drop every prior policy so we can recreate cleanly.
DROP POLICY IF EXISTS "halaqah_supervisors_admin_all"     ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_select_self"   ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_select_any"    ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_insert_admin"  ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_update_admin"  ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_delete_admin"  ON public.halaqah_supervisors;

-- ---------------- SELECT ----------------------------------------
-- Any authenticated user can read. This is needed so:
--   * the post-login picker can ask "do I have any assignments?"
--   * the admin "Halaqah supervisors" list can show all rows for a halaqah
--   * supervisor_manager can audit assignments
-- The data here is non-sensitive (just two FK ids), so a permissive
-- SELECT is the right tradeoff and matches the spec.
CREATE POLICY "halaqah_supervisors_select_any"
    ON public.halaqah_supervisors
    FOR SELECT
    TO authenticated
    USING (true);

-- ---------------- INSERT ----------------------------------------
-- Only admin / supervisor_manager can assign supervisors. WITH CHECK
-- is the clause Postgres consults for INSERT (USING is for the rows
-- being affected by SELECT/UPDATE/DELETE). 0009's FOR ALL bundled both
-- under USING which is the most likely reason the insert was rejected
-- without a clear error.
CREATE POLICY "halaqah_supervisors_insert_admin"
    ON public.halaqah_supervisors
    FOR INSERT
    TO authenticated
    WITH CHECK (
        get_my_role() IN ('admin', 'supervisor_manager')
    );

-- ---------------- UPDATE ----------------------------------------
-- Same allowed roles. Practically unused (we only insert/delete) but
-- declared explicitly so the policy surface is complete.
CREATE POLICY "halaqah_supervisors_update_admin"
    ON public.halaqah_supervisors
    FOR UPDATE
    TO authenticated
    USING (get_my_role() IN ('admin', 'supervisor_manager'))
    WITH CHECK (get_my_role() IN ('admin', 'supervisor_manager'));

-- ---------------- DELETE ----------------------------------------
CREATE POLICY "halaqah_supervisors_delete_admin"
    ON public.halaqah_supervisors
    FOR DELETE
    TO authenticated
    USING (get_my_role() IN ('admin', 'supervisor_manager'));

-- Ensure grants haven't drifted.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.halaqah_supervisors TO authenticated;
