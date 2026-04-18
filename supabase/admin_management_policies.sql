-- ============================================================
-- ADMIN MANAGEMENT POLICIES
-- Run this AFTER FINAL_FIX_RLS.sql
-- Adds policies needed for admin management features
-- ============================================================

-- ============================================================
-- ADDITIONAL PROFILE POLICIES
-- Allow teachers to view students in their halaqahs
-- Allow admins to view all profiles (already covered by admin_all)
-- ============================================================

-- Teachers can view profiles of students in their halaqahs
-- This is needed to display student names in teacher dashboard
CREATE POLICY "profiles_teacher_view_students"
ON profiles FOR SELECT
TO authenticated
USING (
  -- Allow if current user is a teacher and the profile belongs to a student in their halaqah
  EXISTS (
    SELECT 1 FROM halaqahs h
    JOIN halaqah_members hm ON hm.halaqah_id = h.id
    WHERE h.teacher_id = auth.uid()
    AND hm.student_id = profiles.id
  )
);

-- Teachers can view other teacher profiles (for halaqah listing)
CREATE POLICY "profiles_view_teachers"
ON profiles FOR SELECT
TO authenticated
USING (
  role = 'teacher'
);

-- ============================================================
-- VERIFICATION
-- ============================================================
-- Run this to verify all policies:
-- SELECT schemaname, tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;

-- ============================================================
-- NOTES:
-- ============================================================
-- The following policies from FINAL_FIX_RLS.sql already handle:
--
-- profiles_admin_all: Admin can do ALL operations on profiles
-- members_admin_all: Admin can INSERT/UPDATE/DELETE halaqah members
-- halaqahs_admin_all: Admin can do ALL operations on halaqahs
--
-- These are sufficient for:
-- - Admin activating/suspending users
-- - Admin assigning students to halaqahs
-- - Admin creating/editing halaqahs
-- ============================================================
