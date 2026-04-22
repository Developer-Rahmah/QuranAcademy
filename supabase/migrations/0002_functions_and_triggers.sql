-- ============================================================
-- 0002_functions_and_triggers
-- Helper functions + updated_at triggers + auth.users → profiles trigger.
-- Uses CREATE OR REPLACE / DROP IF EXISTS for full idempotency.
-- ============================================================

-- ---------------- updated_at ---------------------------------
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS halaqahs_updated_at ON halaqahs;
CREATE TRIGGER halaqahs_updated_at
    BEFORE UPDATE ON halaqahs
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

DROP TRIGGER IF EXISTS reports_updated_at ON reports;
CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ---------------- RLS-safe role lookup -----------------------
-- get_my_role() is the single SECURITY DEFINER function RLS policies
-- consult to avoid recursion when checking for the 'admin' role.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ---------------- Auto-create profile on signup --------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available_times JSONB;
BEGIN
    BEGIN
        v_available_times := COALESCE(
            (NEW.raw_user_meta_data->>'available_times')::JSONB,
            '[]'::JSONB
        );
    EXCEPTION WHEN OTHERS THEN
        v_available_times := '[]'::JSONB;
    END;

    INSERT INTO profiles (
        id, email,
        first_name, second_name, third_name,
        phone, age, country, role,
        student_type, memorization_level,
        teaching_experience, preferred_audience,
        available_times, status,
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
        'pending'::account_status,
        NOW(), NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ---------------- Grants -------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL    ON ALL TABLES    IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES    IN SCHEMA public TO anon;
GRANT ALL    ON ALL SEQUENCES IN SCHEMA public TO authenticated;
