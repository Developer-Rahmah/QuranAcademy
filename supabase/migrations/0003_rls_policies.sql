-- ============================================================
-- 0003_rls_policies
-- Enable RLS + create all policies.
-- Drops any existing policy by name before (re)creating, so this
-- file is idempotent and can safely replay against the live DB.
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqahs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqah_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items    ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------
-- profiles
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "profiles_insert_own"            ON profiles;
DROP POLICY IF EXISTS "profiles_select_own"            ON profiles;
DROP POLICY IF EXISTS "profiles_update_own"            ON profiles;
DROP POLICY IF EXISTS "profiles_admin_all"             ON profiles;
DROP POLICY IF EXISTS "profiles_teacher_view_students" ON profiles;
DROP POLICY IF EXISTS "profiles_view_teachers"         ON profiles;

CREATE POLICY "profiles_insert_own"
    ON profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_select_own"
    ON profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_all"
    ON profiles FOR ALL TO authenticated
    USING (get_my_role() = 'admin');

-- Teachers can read profiles of students in halaqahs they own.
CREATE POLICY "profiles_teacher_view_students"
    ON profiles FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM halaqahs h
            JOIN halaqah_members hm ON hm.halaqah_id = h.id
            WHERE h.teacher_id = auth.uid()
              AND hm.student_id = profiles.id
        )
    );

-- Any authenticated user can read teacher profiles (for listings).
CREATE POLICY "profiles_view_teachers"
    ON profiles FOR SELECT TO authenticated
    USING (role = 'teacher');

-- -----------------------------------------------------------
-- halaqahs
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "halaqahs_select_authenticated" ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_admin_all"            ON halaqahs;
DROP POLICY IF EXISTS "halaqahs_teacher_update"       ON halaqahs;

CREATE POLICY "halaqahs_select_authenticated"
    ON halaqahs FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "halaqahs_admin_all"
    ON halaqahs FOR ALL TO authenticated
    USING (get_my_role() = 'admin');

CREATE POLICY "halaqahs_teacher_update"
    ON halaqahs FOR UPDATE TO authenticated
    USING (teacher_id = auth.uid());

-- -----------------------------------------------------------
-- halaqah_members
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "members_select_own"     ON halaqah_members;
DROP POLICY IF EXISTS "members_select_teacher" ON halaqah_members;
DROP POLICY IF EXISTS "members_admin_all"      ON halaqah_members;

CREATE POLICY "members_select_own"
    ON halaqah_members FOR SELECT TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "members_select_teacher"
    ON halaqah_members FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM halaqahs h
            WHERE h.id = halaqah_members.halaqah_id
              AND h.teacher_id = auth.uid()
        )
    );

CREATE POLICY "members_admin_all"
    ON halaqah_members FOR ALL TO authenticated
    USING (get_my_role() = 'admin');

-- -----------------------------------------------------------
-- reports
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "reports_select_own"     ON reports;
DROP POLICY IF EXISTS "reports_insert_own"     ON reports;
DROP POLICY IF EXISTS "reports_update_own"     ON reports;
DROP POLICY IF EXISTS "reports_select_teacher" ON reports;
DROP POLICY IF EXISTS "reports_admin_all"      ON reports;

CREATE POLICY "reports_select_own"
    ON reports FOR SELECT TO authenticated
    USING (student_id = auth.uid());

CREATE POLICY "reports_insert_own"
    ON reports FOR INSERT TO authenticated
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "reports_update_own"
    ON reports FOR UPDATE TO authenticated
    USING (student_id = auth.uid() AND report_date = CURRENT_DATE)
    WITH CHECK (student_id = auth.uid());

CREATE POLICY "reports_select_teacher"
    ON reports FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM halaqahs h
            WHERE h.id = reports.halaqah_id
              AND h.teacher_id = auth.uid()
        )
    );

CREATE POLICY "reports_admin_all"
    ON reports FOR ALL TO authenticated
    USING (get_my_role() = 'admin');

-- -----------------------------------------------------------
-- report_items
-- -----------------------------------------------------------
DROP POLICY IF EXISTS "report_items_select_own"     ON report_items;
DROP POLICY IF EXISTS "report_items_insert_own"     ON report_items;
DROP POLICY IF EXISTS "report_items_select_teacher" ON report_items;
DROP POLICY IF EXISTS "report_items_admin_all"      ON report_items;

CREATE POLICY "report_items_select_own"
    ON report_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
    );

CREATE POLICY "report_items_insert_own"
    ON report_items FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports r
            WHERE r.id = report_items.report_id
              AND r.student_id = auth.uid()
        )
    );

CREATE POLICY "report_items_select_teacher"
    ON report_items FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            JOIN halaqahs h ON h.id = r.halaqah_id
            WHERE r.id = report_items.report_id
              AND h.teacher_id = auth.uid()
        )
    );

CREATE POLICY "report_items_admin_all"
    ON report_items FOR ALL TO authenticated
    USING (get_my_role() = 'admin');
