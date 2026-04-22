-- ============================================================
-- FINAL FIX: RLS Policies for Quran Academy
-- This script COMPLETELY replaces all existing policies
-- Run this ENTIRE script in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: DISABLE RLS TEMPORARILY TO CLEAN UP
-- ============================================================
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS halaqahs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS halaqah_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS report_items DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 2: DROP ALL EXISTING POLICIES
-- ============================================================
DO $$
DECLARE
    pol RECORD;
BEGIN
    -- Drop all policies on profiles
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', pol.policyname);
    END LOOP;

    -- Drop all policies on halaqahs
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'halaqahs' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON halaqahs', pol.policyname);
    END LOOP;

    -- Drop all policies on halaqah_members
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'halaqah_members' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON halaqah_members', pol.policyname);
    END LOOP;

    -- Drop all policies on reports
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'reports' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON reports', pol.policyname);
    END LOOP;

    -- Drop all policies on report_items
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'report_items' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON report_items', pol.policyname);
    END LOOP;
END $$;

-- ============================================================
-- STEP 3: DROP OLD HELPER FUNCTIONS (they may cause recursion)
-- ============================================================
DROP FUNCTION IF EXISTS is_admin() CASCADE;
DROP FUNCTION IF EXISTS is_teacher() CASCADE;
DROP FUNCTION IF EXISTS get_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_user_role() CASCADE;
DROP FUNCTION IF EXISTS auth_is_admin() CASCADE;
DROP FUNCTION IF EXISTS auth_is_teacher() CASCADE;
DROP FUNCTION IF EXISTS auth_teacher_owns_halaqah(UUID) CASCADE;
DROP FUNCTION IF EXISTS auth_is_student_of_teacher(UUID) CASCADE;
DROP FUNCTION IF EXISTS auth_report_in_teacher_halaqah(UUID) CASCADE;

-- ============================================================
-- STEP 4: CREATE SAFE HELPER FUNCTION (SECURITY DEFINER)
-- This function bypasses RLS completely
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT FROM profiles WHERE id = auth.uid();
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ============================================================
-- STEP 5: RE-ENABLE RLS
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqah_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 6: PROFILES POLICIES (SIMPLE - NO RECURSION POSSIBLE)
-- ============================================================

-- Users can INSERT their own profile (CRITICAL for signup)
CREATE POLICY "profiles_insert_own"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- Users can SELECT their own profile
CREATE POLICY "profiles_select_own"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Users can UPDATE their own profile
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin can do everything (uses SECURITY DEFINER function)
CREATE POLICY "profiles_admin_all"
ON profiles FOR ALL
TO authenticated
USING (get_my_role() = 'admin');

-- ============================================================
-- STEP 7: HALAQAHS POLICIES (SIMPLE)
-- ============================================================

-- Anyone authenticated can view halaqahs
CREATE POLICY "halaqahs_select_authenticated"
ON halaqahs FOR SELECT
TO authenticated
USING (true);

-- Admin can do everything
CREATE POLICY "halaqahs_admin_all"
ON halaqahs FOR ALL
TO authenticated
USING (get_my_role() = 'admin');

-- Teachers can update their own halaqahs
CREATE POLICY "halaqahs_teacher_update"
ON halaqahs FOR UPDATE
TO authenticated
USING (teacher_id = auth.uid());

-- ============================================================
-- STEP 8: HALAQAH_MEMBERS POLICIES (NO PROFILE REFERENCE)
-- ============================================================

-- Students can see their own membership
CREATE POLICY "members_select_own"
ON halaqah_members FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Teachers can see members of halaqahs they own
-- Uses subquery on halaqahs only (no profiles reference)
CREATE POLICY "members_select_teacher"
ON halaqah_members FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM halaqahs h
    WHERE h.id = halaqah_members.halaqah_id
    AND h.teacher_id = auth.uid()
  )
);

-- Admin can do everything
CREATE POLICY "members_admin_all"
ON halaqah_members FOR ALL
TO authenticated
USING (get_my_role() = 'admin');

-- ============================================================
-- STEP 9: REPORTS POLICIES
-- ============================================================

-- Students can see their own reports
CREATE POLICY "reports_select_own"
ON reports FOR SELECT
TO authenticated
USING (student_id = auth.uid());

-- Students can insert their own reports
CREATE POLICY "reports_insert_own"
ON reports FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

-- Students can update their own reports (same day)
CREATE POLICY "reports_update_own"
ON reports FOR UPDATE
TO authenticated
USING (student_id = auth.uid() AND report_date = CURRENT_DATE)
WITH CHECK (student_id = auth.uid());

-- Teachers can see reports from their halaqahs
CREATE POLICY "reports_select_teacher"
ON reports FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM halaqahs h
    WHERE h.id = reports.halaqah_id
    AND h.teacher_id = auth.uid()
  )
);

-- Admin can do everything
CREATE POLICY "reports_admin_all"
ON reports FOR ALL
TO authenticated
USING (get_my_role() = 'admin');

-- ============================================================
-- STEP 10: REPORT_ITEMS POLICIES
-- ============================================================

-- Students can see items from their reports
CREATE POLICY "report_items_select_own"
ON report_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id = report_items.report_id
    AND r.student_id = auth.uid()
  )
);

-- Students can insert items to their reports
CREATE POLICY "report_items_insert_own"
ON report_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM reports r
    WHERE r.id = report_items.report_id
    AND r.student_id = auth.uid()
  )
);

-- Teachers can see items from their halaqah reports
CREATE POLICY "report_items_select_teacher"
ON report_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM reports r
    JOIN halaqahs h ON h.id = r.halaqah_id
    WHERE r.id = report_items.report_id
    AND h.teacher_id = auth.uid()
  )
);

-- Admin can do everything
CREATE POLICY "report_items_admin_all"
ON report_items FOR ALL
TO authenticated
USING (get_my_role() = 'admin');

-- ============================================================
-- STEP 11: CREATE TRIGGER TO AUTO-CREATE PROFILE ON SIGNUP
-- This ensures profile is ALWAYS created, even if FE fails
-- ============================================================

-- Function to create profile automatically
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_times JSONB;
BEGIN
  -- Parse available_times from JSON string or default to empty array
  BEGIN
    v_available_times := COALESCE(
      (NEW.raw_user_meta_data->>'available_times')::JSONB,
      '[]'::JSONB
    );
  EXCEPTION WHEN OTHERS THEN
    v_available_times := '[]'::JSONB;
  END;

  INSERT INTO profiles (
    id,
    email,
    first_name,
    second_name,
    third_name,
    phone,
    age,
    country,
    role,
    student_type,
    memorization_level,
    teaching_experience,
    preferred_audience,
    available_times,
    status,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'second_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'third_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    (NEW.raw_user_meta_data->>'age')::INTEGER,
    NEW.raw_user_meta_data->>'country',
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')::user_role,
    (NEW.raw_user_meta_data->>'student_type')::student_type,
    (NEW.raw_user_meta_data->>'memorization_level')::memorization_level,
    NEW.raw_user_meta_data->>'teaching_experience',
    (NEW.raw_user_meta_data->>'preferred_audience')::preferred_audience,
    v_available_times,
    'pending'::account_status,
    NOW(),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- STEP 12: GRANT PERMISSIONS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================
-- STEP 13: VERIFICATION QUERIES (RUN THESE AFTER)
-- ============================================================

-- Check all policies are created
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- Check trigger exists
-- SELECT trigger_name, event_manipulation, action_statement
-- FROM information_schema.triggers
-- WHERE trigger_schema = 'auth';

-- ============================================================
-- DONE! Now test by:
-- 1. Sign up a new user
-- 2. Check profiles table has a row
-- 3. Login and fetch profile
-- ============================================================
