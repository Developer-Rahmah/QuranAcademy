-- ============================================================
-- 0009_halaqah_supervisors_and_roles
--
-- 1. Extend the user_role enum with two new members:
--      - halaqah_supervisor   (can supervise specific halaqahs;
--                              optionally also a student)
--      - supervisor_manager   (org-level oversight; cannot delete users
--                              and cannot access academy settings)
--    `admin` is intentionally left intact — its UI label changes only,
--    not its enum value (the spec asks the visible label to read
--    "الإدارة" but admin permissions remain unchanged).
--
-- 2. Create the `halaqah_supervisors` join table linking users to the
--    halaqahs they supervise (M:N). Used by the post-login "Continue as
--    Student / Supervisor" flow and by the supervisor-only views.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ---------- 1. extend user_role enum -------------------------------
DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'halaqah_supervisor';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'supervisor_manager';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ---------- 2. halaqah_supervisors table ---------------------------
CREATE TABLE IF NOT EXISTS public.halaqah_supervisors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    halaqah_id  UUID NOT NULL REFERENCES halaqahs(id)  ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, halaqah_id)
);

CREATE INDEX IF NOT EXISTS idx_halaqah_supervisors_user
    ON public.halaqah_supervisors(user_id);
CREATE INDEX IF NOT EXISTS idx_halaqah_supervisors_halaqah
    ON public.halaqah_supervisors(halaqah_id);

ALTER TABLE public.halaqah_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "halaqah_supervisors_admin_all"   ON public.halaqah_supervisors;
DROP POLICY IF EXISTS "halaqah_supervisors_select_self" ON public.halaqah_supervisors;

-- Admin/supervisor_manager get full access via get_my_role().
CREATE POLICY "halaqah_supervisors_admin_all"
    ON public.halaqah_supervisors FOR ALL
    TO authenticated
    USING (get_my_role() IN ('admin', 'supervisor_manager'))
    WITH CHECK (get_my_role() IN ('admin', 'supervisor_manager'));

-- A user can SELECT their own supervisor assignments — needed so the
-- post-login modal can list halaqahs they supervise.
CREATE POLICY "halaqah_supervisors_select_self"
    ON public.halaqah_supervisors FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.halaqah_supervisors TO authenticated;
