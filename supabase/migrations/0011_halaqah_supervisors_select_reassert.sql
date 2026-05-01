-- ============================================================
-- 0011_halaqah_supervisors_select_reassert
--
-- Defensive: re-declare the SELECT policy on `halaqah_supervisors`.
-- If 0010 wasn't applied to a given environment, or someone manually
-- dropped policies in the SQL editor, this migration restores the
-- minimum read access needed for `api.supervisors.listByUser` to work.
--
-- The frontend already broadcasts `FETCH SUPERVISOR ASSIGNMENTS START`
-- and `FETCH RESULT` to the browser console — if rows exist in the
-- table but `data` comes back `[]`, RLS is the cause and this script
-- is the fix.
--
-- Idempotent.
-- ============================================================

ALTER TABLE public.halaqah_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "halaqah_supervisors_select_any" ON public.halaqah_supervisors;

-- Permissive read: any authenticated user can SELECT. This is needed
-- so the post-login dispatcher can answer "do I have any assignments?"
-- and the admin "Halaqah supervisors" list can render every row.
-- Data is non-sensitive (just two FK ids); writes remain admin-only.
CREATE POLICY "halaqah_supervisors_select_any"
    ON public.halaqah_supervisors
    FOR SELECT
    TO authenticated
    USING (true);

GRANT SELECT ON public.halaqah_supervisors TO authenticated;
