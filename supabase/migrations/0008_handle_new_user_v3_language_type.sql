-- ============================================================
-- 0008_handle_new_user_v3_language_type
--
-- Replace the signup trigger so it reads `language_type` from the auth
-- user's metadata and writes it into `profiles.language_type`.
--
-- IMPORTANT — run this file as-is in the Supabase SQL editor. NEW is a
-- PL/pgSQL trigger alias; it ONLY exists inside a FUNCTION body bound to
-- a TRIGGER. Running `... VALUES (NEW.id, ...)` at the top level yields
-- "missing FROM-clause entry for table new". Keep the whole block
-- (CREATE OR REPLACE FUNCTION … / CREATE TRIGGER …) together.
--
-- Backward compatible:
--   * Every earlier field still populated.
--   * Missing/unknown `language_type` metadata → defaults to 'arabic_speaker'
--     via COALESCE so the column is never left NULL.
--   * ON CONFLICT (id) DO NOTHING — rerunning this migration won't touch
--     existing rows.
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
        COALESCE(NEW.raw_user_meta_data->>'role', 'student')::user_role,
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
