-- ============================================
-- FIXED Row Level Security (RLS) Policies
-- NO RECURSION - Uses SECURITY DEFINER functions
-- Run this in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: DROP ALL EXISTING POLICIES
-- ============================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_teacher" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

DROP POLICY IF EXISTS "halaqahs_select_all" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_insert_admin" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_update_admin" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_update_teacher" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_delete_admin" ON halaqahs;

DROP POLICY IF EXISTS "members_select_own" ON halaqah_members;
DROP POLICY IF EXISTS "members_select_teacher" ON halaqah_members;
DROP POLICY IF EXISTS "members_select_admin" ON halaqah_members;
DROP POLICY IF EXISTS "members_insert_admin" ON halaqah_members;
DROP POLICY IF EXISTS "members_delete_admin" ON halaqah_members;

DROP POLICY IF EXISTS "reports_select_own" ON reports;
DROP POLICY IF EXISTS "reports_select_teacher" ON reports;
DROP POLICY IF EXISTS "reports_select_admin" ON reports;
DROP POLICY IF EXISTS "reports_insert_student" ON reports;
DROP POLICY IF EXISTS "reports_update_own" ON reports;

DROP POLICY IF EXISTS "report_items_select_own" ON report_items;
DROP POLICY IF EXISTS "report_items_select_teacher" ON report_items;
DROP POLICY IF EXISTS "report_items_select_admin" ON report_items;
DROP POLICY IF EXISTS "report_items_insert_student" ON report_items;

-- ============================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqah_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: CREATE SECURITY DEFINER FUNCTIONS
-- These bypass RLS to avoid recursion
-- ============================================

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role::TEXT INTO user_role
  FROM profiles
  WHERE id = auth.uid();
  RETURN COALESCE(user_role, 'none');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth_user_role() = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if current user is teacher (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN auth_user_role() = 'teacher';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if teacher owns a halaqah (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_teacher_owns_halaqah(halaqah_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM halaqahs
    WHERE id = halaqah_uuid
    AND teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if student is in teacher's halaqah (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_is_student_of_teacher(student_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM halaqah_members hm
    JOIN halaqahs h ON h.id = hm.halaqah_id
    WHERE hm.student_id = student_uuid
    AND h.teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if report belongs to teacher's halaqah (bypasses RLS)
CREATE OR REPLACE FUNCTION auth_report_in_teacher_halaqah(report_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM reports r
    JOIN halaqahs h ON h.id = r.halaqah_id
    WHERE r.id = report_uuid
    AND h.teacher_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- STEP 4: PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (auth_is_admin());

-- Teachers can read their students' profiles
CREATE POLICY "profiles_select_teacher" ON profiles
  FOR SELECT USING (
    auth_is_teacher() AND auth_is_student_of_teacher(id)
  );

-- Users can insert their own profile (CRITICAL for signup)
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (auth_is_admin());

-- ============================================
-- STEP 5: HALAQAHS POLICIES
-- ============================================

-- All authenticated users can see halaqahs
CREATE POLICY "halaqahs_select_authenticated" ON halaqahs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins can create halaqahs
CREATE POLICY "halaqahs_insert_admin" ON halaqahs
  FOR INSERT WITH CHECK (auth_is_admin());

-- Admins can update any halaqah
CREATE POLICY "halaqahs_update_admin" ON halaqahs
  FOR UPDATE USING (auth_is_admin());

-- Teachers can update their own halaqahs
CREATE POLICY "halaqahs_update_teacher" ON halaqahs
  FOR UPDATE USING (teacher_id = auth.uid());

-- Only admins can delete halaqahs
CREATE POLICY "halaqahs_delete_admin" ON halaqahs
  FOR DELETE USING (auth_is_admin());

-- ============================================
-- STEP 6: HALAQAH_MEMBERS POLICIES
-- NO recursion - uses direct checks only
-- ============================================

-- Students can see their own memberships
CREATE POLICY "members_select_own" ON halaqah_members
  FOR SELECT USING (student_id = auth.uid());

-- Teachers can see members in their halaqahs
CREATE POLICY "members_select_teacher" ON halaqah_members
  FOR SELECT USING (auth_teacher_owns_halaqah(halaqah_id));

-- Admins can see all members
CREATE POLICY "members_select_admin" ON halaqah_members
  FOR SELECT USING (auth_is_admin());

-- Only admins can add members
CREATE POLICY "members_insert_admin" ON halaqah_members
  FOR INSERT WITH CHECK (auth_is_admin());

-- Only admins can remove members
CREATE POLICY "members_delete_admin" ON halaqah_members
  FOR DELETE USING (auth_is_admin());

-- ============================================
-- STEP 7: REPORTS POLICIES
-- ============================================

-- Students can see their own reports
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT USING (student_id = auth.uid());

-- Teachers can see reports in their halaqahs
CREATE POLICY "reports_select_teacher" ON reports
  FOR SELECT USING (auth_teacher_owns_halaqah(halaqah_id));

-- Admins can see all reports
CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT USING (auth_is_admin());

-- Students can create their own reports
CREATE POLICY "reports_insert_student" ON reports
  FOR INSERT WITH CHECK (student_id = auth.uid());

-- Students can update their own reports (same day only)
CREATE POLICY "reports_update_own" ON reports
  FOR UPDATE USING (
    student_id = auth.uid()
    AND report_date = CURRENT_DATE
  );

-- ============================================
-- STEP 8: REPORT_ITEMS POLICIES
-- ============================================

-- Students can see items from their reports
CREATE POLICY "report_items_select_own" ON report_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_items.report_id
      AND reports.student_id = auth.uid()
    )
  );

-- Teachers can see items from their halaqah reports
CREATE POLICY "report_items_select_teacher" ON report_items
  FOR SELECT USING (auth_report_in_teacher_halaqah(report_id));

-- Admins can see all report items
CREATE POLICY "report_items_select_admin" ON report_items
  FOR SELECT USING (auth_is_admin());

-- Students can add items to their own reports
CREATE POLICY "report_items_insert_student" ON report_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_items.report_id
      AND reports.student_id = auth.uid()
    )
  );

-- ============================================
-- STEP 9: GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- ============================================
-- VERIFICATION QUERY
-- Run this to verify policies are created
-- ============================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public';
