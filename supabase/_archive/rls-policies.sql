-- ============================================
-- Row Level Security (RLS) Policies
-- Run this AFTER schema.sql in Supabase SQL Editor
-- ============================================

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqah_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Check if user is teacher
-- ============================================
CREATE OR REPLACE FUNCTION is_teacher()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'teacher'
    AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER FUNCTION: Get user's role
-- ============================================
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
DECLARE
  user_role_val user_role;
BEGIN
  SELECT role INTO user_role_val
  FROM profiles
  WHERE id = auth.uid();
  RETURN user_role_val;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_select_teacher" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;

-- SELECT: Users can read their own profile
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT
  USING (id = auth.uid());

-- SELECT: Admins can read all profiles
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT
  USING (is_admin());

-- SELECT: Teachers can read student profiles in their halaqahs
CREATE POLICY "profiles_select_teacher" ON profiles
  FOR SELECT
  USING (
    is_teacher() AND (
      role = 'student' AND EXISTS (
        SELECT 1 FROM halaqah_members hm
        JOIN halaqahs h ON h.id = hm.halaqah_id
        WHERE hm.student_id = profiles.id
        AND h.teacher_id = auth.uid()
      )
    )
  );

-- INSERT: Authenticated users can create their own profile
-- This is CRITICAL for signup to work!
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- UPDATE: Users can update their own profile (limited fields)
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- UPDATE: Admins can update any profile
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE
  USING (is_admin());

-- ============================================
-- HALAQAHS POLICIES
-- ============================================

DROP POLICY IF EXISTS "halaqahs_select_all" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_insert_admin" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_update_admin" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_update_teacher" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_delete_admin" ON halaqahs;

-- SELECT: All authenticated users can see active halaqahs
CREATE POLICY "halaqahs_select_all" ON halaqahs
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: Only admins can create halaqahs
CREATE POLICY "halaqahs_insert_admin" ON halaqahs
  FOR INSERT
  WITH CHECK (is_admin());

-- UPDATE: Admins can update any halaqah
CREATE POLICY "halaqahs_update_admin" ON halaqahs
  FOR UPDATE
  USING (is_admin());

-- UPDATE: Teachers can update their own halaqahs (meet_link, schedule)
CREATE POLICY "halaqahs_update_teacher" ON halaqahs
  FOR UPDATE
  USING (teacher_id = auth.uid());

-- DELETE: Only admins can delete halaqahs
CREATE POLICY "halaqahs_delete_admin" ON halaqahs
  FOR DELETE
  USING (is_admin());

-- ============================================
-- HALAQAH_MEMBERS POLICIES
-- ============================================

DROP POLICY IF EXISTS "members_select_own" ON halaqah_members;
DROP POLICY IF EXISTS "members_select_teacher" ON halaqah_members;
DROP POLICY IF EXISTS "members_select_admin" ON halaqah_members;
DROP POLICY IF EXISTS "members_insert_admin" ON halaqah_members;
DROP POLICY IF EXISTS "members_delete_admin" ON halaqah_members;

-- SELECT: Students can see their own memberships
CREATE POLICY "members_select_own" ON halaqah_members
  FOR SELECT
  USING (student_id = auth.uid());

-- SELECT: Teachers can see members of their halaqahs
CREATE POLICY "members_select_teacher" ON halaqah_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM halaqahs
      WHERE halaqahs.id = halaqah_members.halaqah_id
      AND halaqahs.teacher_id = auth.uid()
    )
  );

-- SELECT: Admins can see all members
CREATE POLICY "members_select_admin" ON halaqah_members
  FOR SELECT
  USING (is_admin());

-- INSERT: Only admins can add members
CREATE POLICY "members_insert_admin" ON halaqah_members
  FOR INSERT
  WITH CHECK (is_admin());

-- DELETE: Only admins can remove members
CREATE POLICY "members_delete_admin" ON halaqah_members
  FOR DELETE
  USING (is_admin());

-- ============================================
-- REPORTS POLICIES
-- ============================================

DROP POLICY IF EXISTS "reports_select_own" ON reports;
DROP POLICY IF EXISTS "reports_select_teacher" ON reports;
DROP POLICY IF EXISTS "reports_select_admin" ON reports;
DROP POLICY IF EXISTS "reports_insert_student" ON reports;
DROP POLICY IF EXISTS "reports_update_own" ON reports;

-- SELECT: Students can see their own reports
CREATE POLICY "reports_select_own" ON reports
  FOR SELECT
  USING (student_id = auth.uid());

-- SELECT: Teachers can see reports from their halaqahs
CREATE POLICY "reports_select_teacher" ON reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM halaqahs
      WHERE halaqahs.id = reports.halaqah_id
      AND halaqahs.teacher_id = auth.uid()
    )
  );

-- SELECT: Admins can see all reports
CREATE POLICY "reports_select_admin" ON reports
  FOR SELECT
  USING (is_admin());

-- INSERT: Students can create reports for themselves
CREATE POLICY "reports_insert_student" ON reports
  FOR INSERT
  WITH CHECK (student_id = auth.uid());

-- UPDATE: Students can update their own reports (same day only)
CREATE POLICY "reports_update_own" ON reports
  FOR UPDATE
  USING (student_id = auth.uid() AND report_date = CURRENT_DATE);

-- ============================================
-- REPORT_ITEMS POLICIES
-- ============================================

DROP POLICY IF EXISTS "report_items_select_own" ON report_items;
DROP POLICY IF EXISTS "report_items_select_teacher" ON report_items;
DROP POLICY IF EXISTS "report_items_select_admin" ON report_items;
DROP POLICY IF EXISTS "report_items_insert_student" ON report_items;

-- SELECT: Students can see items of their own reports
CREATE POLICY "report_items_select_own" ON report_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_items.report_id
      AND reports.student_id = auth.uid()
    )
  );

-- SELECT: Teachers can see items from their halaqah reports
CREATE POLICY "report_items_select_teacher" ON report_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM reports
      JOIN halaqahs ON halaqahs.id = reports.halaqah_id
      WHERE reports.id = report_items.report_id
      AND halaqahs.teacher_id = auth.uid()
    )
  );

-- SELECT: Admins can see all report items
CREATE POLICY "report_items_select_admin" ON report_items
  FOR SELECT
  USING (is_admin());

-- INSERT: Students can add items to their own reports
CREATE POLICY "report_items_insert_student" ON report_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reports
      WHERE reports.id = report_items.report_id
      AND reports.student_id = auth.uid()
    )
  );

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;
