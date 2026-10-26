-- ============================================================
-- 0023_handle_new_user_v4_role_whitelist
--
-- Harden the signup trigger so the `role` taken from the (user-controlled)
-- auth metadata is restricted to the set of roles a visitor is allowed to
-- self-register as. Everything else in the function is IDENTICAL to v3
-- (migration 0008) — this is purely a security hardening of the role
-- assignment, plus adding `halaqah_supervisor` as a self-registerable role
-- for the new "volunteer supervisor" registration flow.
--
-- WHY THIS IS NEEDED
--   `raw_user_meta_data` is attacker-controlled: it is populated verbatim
--   from the client `supabase.auth.signUp({ options: { data } })` call.
--   v3 cast `raw_user_meta_data->>'role'` straight to `user_role`, so a
--   crafted signUp payload with `role: 'admin'` (or 'supervisor_manager')
--   would create a profile carrying that privileged role. Because RLS
--   consults `get_my_role()` WITHOUT checking account status, such a
--   self-granted admin could read/write other profiles via the data API
--   even while 'pending'. This migration closes that escalation path for
--   every registration surface (existing student/teacher + new supervisor).
--
-- SELF-REGISTERABLE ROLES (whitelist)
--   'student', 'teacher', 'halaqah_supervisor'
--   Any other value (including 'admin' and 'supervisor_manager') or a
--   missing/garbage value falls back to 'student'. Privileged roles can
--   still only be granted later by an admin through the authenticated
--   admin surface — never through public signup.
--
-- NOTE on halaqah_supervisor
--   Registering with role = 'halaqah_supervisor' grants NO data access by
--   itself. Every supervisor RLS policy (migration 0013) requires a row in
--   `halaqah_supervisors`, which registration never creates. A volunteer
--   supervisor therefore sees nothing until an admin explicitly assigns
--   them to a halaqah. Least privilege is preserved.
--
-- IMPORTANT — run this whole block AS-IS in the Supabase SQL editor. NEW
-- is a PL/pgSQL trigger alias; it only exists inside a function body bound
-- to a trigger. Keep CREATE OR REPLACE FUNCTION … / CREATE TRIGGER …
-- together.
--
-- Backward compatible:
--   * Every earlier field still populated exactly as in v3.
--   * Legitimate student/teacher signups are unaffected (those roles are
--     in the whitelist).
--   * ON CONFLICT (id) DO NOTHING — replaying this migration, or a retry
--     of the same signup, never mutates an existing row.
--   * No existing rows are read, changed, or deleted.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available_times        JSONB;
    v_authorized_recitations JSONB;
    v_language_type          TEXT;
    v_requested_role         TEXT;
    v_role                   user_role;
BEGIN
    -- available_times
    BEGIN
        v_available_times := COALESCE(
            (NEW.raw_user_meta_data->>'available_times')::JSONB,
            '[]'::JSONB
        );
    EXCEPTION WHEN OTHERS THEN
        v_available_times := '[]'::JSONB;
    END;

    -- authorized_recitations (teacher field, optional)
    BEGIN
        v_authorized_recitations := COALESCE(
            (NEW.raw_user_meta_data->>'authorized_recitations')::JSONB,
            '[]'::JSONB
        );
    EXCEPTION WHEN OTHERS THEN
        v_authorized_recitations := '[]'::JSONB;
    END;

    -- language_type — pulled from auth metadata; defaults to
    -- 'arabic_speaker' so the column is never NULL.
    v_language_type := COALESCE(
        NULLIF(NEW.raw_user_meta_data->>'language_type', ''),
        'arabic_speaker'
    );

    -- role — WHITELISTED. Only roles a visitor may self-register as are
    -- honoured; anything else (admin / supervisor_manager / unknown /
    -- NULL) collapses to 'student'. This is the security fix.
    v_requested_role := NEW.raw_user_meta_data->>'role';
    IF v_requested_role IN ('student', 'teacher', 'halaqah_supervisor') THEN
        v_role := v_requested_role::user_role;
    ELSE
        v_role := 'student'::user_role;
    END IF;

    INSERT INTO public.profiles (
        id, email,
        first_name, second_name, third_name,
        phone, age, country, role,
        student_type, memorization_level,
        teaching_experience, preferred_audience,
        available_times,
        segment,
        recitation,
        quran_parts_taught,
        is_certified,
        authorized_recitations,
        language_type,
        status,
        created_at, updated_at
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'second_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'third_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        NULLIF(NEW.raw_user_meta_data->>'age', '')::INTEGER,
        NEW.raw_user_meta_data->>'country',
        v_role,
        NULLIF(NEW.raw_user_meta_data->>'student_type', '')::student_type,
        NULLIF(NEW.raw_user_meta_data->>'memorization_level', '')::memorization_level,
        NEW.raw_user_meta_data->>'teaching_experience',
        NULLIF(NEW.raw_user_meta_data->>'preferred_audience', '')::preferred_audience,
        v_available_times,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'segment', '')::user_segment,
            'women'::user_segment
        ),
        NEW.raw_user_meta_data->>'recitation',
        NULLIF(NEW.raw_user_meta_data->>'quran_parts_taught', '')::INTEGER,
        COALESCE(
            NULLIF(NEW.raw_user_meta_data->>'is_certified', '')::BOOLEAN,
            false
        ),
        v_authorized_recitations,
        v_language_type,
        'pending'::account_status,
        NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Re-bind the trigger. This is idempotent — replaying is a no-op.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
