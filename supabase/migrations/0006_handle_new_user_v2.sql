-- ============================================================
-- 0006_handle_new_user_v2
-- Extend handle_new_user() to populate the new profile fields added in
-- 0005: segment, recitation, quran_parts_taught, is_certified,
-- authorized_recitations. Idempotent via CREATE OR REPLACE.
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available_times        JSONB;
    v_authorized_recitations JSONB;
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

    INSERT INTO profiles (
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
        'pending'::account_status,
        NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;
