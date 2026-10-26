-- ============================================================
-- 0024_profiles_role_escalation_guard
--
-- SECURITY HARDENING (review before applying).
--
-- Closes a privilege-escalation hole that exists independently of the UI:
-- the `profiles_insert_own` / `profiles_update_own` RLS policies (migration
-- 0003) authorize a user to write their OWN row (`id = auth.uid()`) but do
-- NOT restrict the `role` column. As written, any authenticated user can:
--
--   1. UPDATE their own profile and set `role = 'admin'`  (or
--      'supervisor_manager'); or
--   2. INSERT their own profile with a privileged role (e.g. via the
--      client-side fallback in AuthContext.signUp, which runs
--      `profiles.insert({ role })` as the freshly-created user).
--
-- Because the RLS policies that grant elevated data access consult
-- `get_my_role()` WITHOUT checking account status, a self-granted admin
-- could then read/write every profile through the data API. The route
-- guards (which DO check status) are a frontend-only control and are not a
-- substitute for this backend boundary.
--
-- This migration adds a BEFORE INSERT/UPDATE trigger on `profiles` that
-- enforces least privilege at the database layer:
--
--   * Admins (get_my_role() = 'admin') may set any role — unchanged.
--   * A non-admin self-INSERT may only carry a self-registerable role
--     ('student' | 'teacher' | 'halaqah_supervisor'). This matches the
--     signup trigger whitelist (migration 0023) so the normal + fallback
--     registration paths keep working.
--   * A non-admin may NEVER change an existing row's role (NEW.role must
--     equal OLD.role on UPDATE). Profile edits that leave `role` untouched
--     are unaffected.
--
-- WHY THIS IS BACKWARD-COMPATIBLE / LOW-RISK
--   * Legitimate role assignment is performed by admins via
--     `profiles.update(id, { role })`, backed by the `profiles_admin_all`
--     policy — admins are explicitly exempted here, so that flow is
--     untouched.
--   * supervisor_manager cannot update other users' profiles today anyway
--     (no RLS UPDATE policy grants it), so this changes nothing for them.
--   * SECURITY DEFINER RPCs that touch only `status`
--     (set_student_status / apply_student_status_change / the daily
--     suspension job) leave `role` unchanged, so they pass the guard.
--   * The signup trigger (handle_new_user, migration 0023) already writes
--     only whitelisted roles, so profile auto-creation passes the guard.
--   * No existing rows are read, changed, or deleted. No policies are
--     dropped or weakened — this only ADDS a constraint.
--
-- Fully idempotent: CREATE OR REPLACE FUNCTION + DROP/CREATE TRIGGER.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_role_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_actor_role TEXT;
BEGIN
    v_actor_role := get_my_role();

    -- Admins may assign any role (existing admin user-management flow).
    IF v_actor_role = 'admin' THEN
        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- A non-admin self-insert may only carry a self-registerable role.
        IF NEW.role IS NULL
           OR NEW.role NOT IN ('student', 'teacher', 'halaqah_supervisor') THEN
            RAISE EXCEPTION
                'role % cannot be self-assigned at profile creation', NEW.role
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Non-admins may never change their (or anyone's) role.
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION
                'role may not be changed by a non-admin'
                USING ERRCODE = 'insufficient_privilege';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_role_guard ON public.profiles;
CREATE TRIGGER profiles_role_guard
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_role_guard();
