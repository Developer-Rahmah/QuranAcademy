-- ============================================
-- Quran Memorization Academy Database Schema
-- أكاديمية تحفيظ القرآن الكريم
-- ============================================
-- Run this SQL in Supabase SQL Editor
-- Project Settings > SQL Editor > New Query

-- ============================================
-- 1. ENUM TYPES
-- ============================================

-- User roles
CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');

-- Student types (woman or child)
CREATE TYPE student_type AS ENUM ('woman', 'child');

-- Memorization levels
CREATE TYPE memorization_level AS ENUM ('beginner', 'intermediate', 'advanced');

-- Preferred teaching audience for teachers
CREATE TYPE preferred_audience AS ENUM ('children', 'women', 'both');

-- Account status
CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended');

-- Halaqah status
CREATE TYPE halaqah_status AS ENUM ('active', 'paused', 'completed');

-- Report item type (memorization or review)
CREATE TYPE report_type AS ENUM ('memorization', 'review');

-- ============================================
-- 2. TABLES
-- ============================================

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    first_name TEXT NOT NULL,
    second_name TEXT NOT NULL,
    third_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    age INTEGER,
    country TEXT,
    role user_role NOT NULL DEFAULT 'student',
    student_type student_type,
    memorization_level memorization_level,
    teaching_experience TEXT,
    preferred_audience preferred_audience,
    available_times JSONB DEFAULT '[]'::jsonb,
    status account_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Halaqahs (study circles)
CREATE TABLE halaqahs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    meet_link TEXT,
    level memorization_level,
    target_audience student_type,
    schedule JSONB DEFAULT '{}'::jsonb,
    status halaqah_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Halaqah members (students assigned to halaqahs)
CREATE TABLE halaqah_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    halaqah_id UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status account_status NOT NULL DEFAULT 'active',
    UNIQUE(halaqah_id, student_id)
);

-- Reports (daily progress reports)
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    halaqah_id UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, halaqah_id, report_date)
);

-- Report items (individual surah entries in a report)
CREATE TABLE report_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    surah_name TEXT NOT NULL,
    pages DECIMAL(5,2) NOT NULL CHECK (pages >= 0.25),
    type report_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_status ON profiles(status);
CREATE INDEX idx_halaqahs_teacher ON halaqahs(teacher_id);
CREATE INDEX idx_halaqahs_status ON halaqahs(status);
CREATE INDEX idx_halaqah_members_halaqah ON halaqah_members(halaqah_id);
CREATE INDEX idx_halaqah_members_student ON halaqah_members(student_id);
CREATE INDEX idx_reports_student ON reports(student_id);
CREATE INDEX idx_reports_halaqah ON reports(halaqah_id);
CREATE INDEX idx_reports_date ON reports(report_date);
CREATE INDEX idx_report_items_report ON report_items(report_id);
CREATE INDEX idx_report_items_type ON report_items(type);

-- ============================================
-- 4. FUNCTIONS
-- ============================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
    SELECT role FROM profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND role = 'admin'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if user is teacher
CREATE OR REPLACE FUNCTION is_teacher(user_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND role = 'teacher'
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if teacher owns halaqah
CREATE OR REPLACE FUNCTION teacher_owns_halaqah(teacher_id UUID, halaqah_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM halaqahs
        WHERE id = halaqah_id AND teacher_id = teacher_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to check if student is in halaqah
CREATE OR REPLACE FUNCTION student_in_halaqah(student_id UUID, halaqah_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM halaqah_members
        WHERE student_id = student_id AND halaqah_id = halaqah_id
    );
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get total memorization pages for a student
CREATE OR REPLACE FUNCTION get_student_memorization_pages(student_id UUID)
RETURNS DECIMAL AS $$
    SELECT COALESCE(SUM(ri.pages), 0)
    FROM report_items ri
    JOIN reports r ON ri.report_id = r.id
    WHERE r.student_id = student_id AND ri.type = 'memorization';
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to get total review pages for a student
CREATE OR REPLACE FUNCTION get_student_review_pages(student_id UUID)
RETURNS DECIMAL AS $$
    SELECT COALESCE(SUM(ri.pages), 0)
    FROM report_items ri
    JOIN reports r ON ri.report_id = r.id
    WHERE r.student_id = student_id AND ri.type = 'review';
$$ LANGUAGE sql SECURITY DEFINER;

-- Function to handle updated_at timestamp
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Auto-update updated_at for profiles
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Auto-update updated_at for halaqahs
CREATE TRIGGER halaqahs_updated_at
    BEFORE UPDATE ON halaqahs
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Auto-update updated_at for reports
CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE halaqah_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6.1 PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

-- Teachers can view profiles of students in their halaqahs
CREATE POLICY "Teachers can view students in their halaqahs"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM halaqahs h
            JOIN halaqah_members hm ON h.id = hm.halaqah_id
            WHERE h.teacher_id = auth.uid()
            AND hm.student_id = profiles.id
        )
    );

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (is_admin(auth.uid()));

-- Users can update their own profile (except role and status)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (is_admin(auth.uid()));

-- Allow insert during registration (handled by trigger)
CREATE POLICY "Allow profile creation"
    ON profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
    ON profiles FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================
-- 6.2 HALAQAHS POLICIES
-- ============================================

-- Students can view halaqahs they're members of
CREATE POLICY "Students can view their halaqahs"
    ON halaqahs FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM halaqah_members
            WHERE halaqah_id = halaqahs.id
            AND student_id = auth.uid()
        )
    );

-- Teachers can view their assigned halaqahs
CREATE POLICY "Teachers can view their halaqahs"
    ON halaqahs FOR SELECT
    USING (teacher_id = auth.uid());

-- Admins can view all halaqahs
CREATE POLICY "Admins can view all halaqahs"
    ON halaqahs FOR SELECT
    USING (is_admin(auth.uid()));

-- Teachers can update their halaqahs (only meet_link and schedule)
CREATE POLICY "Teachers can update their halaqahs"
    ON halaqahs FOR UPDATE
    USING (teacher_id = auth.uid())
    WITH CHECK (teacher_id = auth.uid());

-- Admins can insert halaqahs
CREATE POLICY "Admins can create halaqahs"
    ON halaqahs FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

-- Admins can update all halaqahs
CREATE POLICY "Admins can update all halaqahs"
    ON halaqahs FOR UPDATE
    USING (is_admin(auth.uid()));

-- Admins can delete halaqahs
CREATE POLICY "Admins can delete halaqahs"
    ON halaqahs FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================
-- 6.3 HALAQAH_MEMBERS POLICIES
-- ============================================

-- Students can view their own memberships
CREATE POLICY "Students can view own memberships"
    ON halaqah_members FOR SELECT
    USING (student_id = auth.uid());

-- Teachers can view memberships in their halaqahs
CREATE POLICY "Teachers can view halaqah memberships"
    ON halaqah_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM halaqahs
            WHERE id = halaqah_members.halaqah_id
            AND teacher_id = auth.uid()
        )
    );

-- Admins can view all memberships
CREATE POLICY "Admins can view all memberships"
    ON halaqah_members FOR SELECT
    USING (is_admin(auth.uid()));

-- Admins can insert memberships
CREATE POLICY "Admins can create memberships"
    ON halaqah_members FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

-- Admins can update memberships
CREATE POLICY "Admins can update memberships"
    ON halaqah_members FOR UPDATE
    USING (is_admin(auth.uid()));

-- Admins can delete memberships
CREATE POLICY "Admins can delete memberships"
    ON halaqah_members FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================
-- 6.4 REPORTS POLICIES
-- ============================================

-- Students can view their own reports
CREATE POLICY "Students can view own reports"
    ON reports FOR SELECT
    USING (student_id = auth.uid());

-- Students can create their own reports
CREATE POLICY "Students can create reports"
    ON reports FOR INSERT
    WITH CHECK (student_id = auth.uid());

-- Students can update their own reports (same day only)
CREATE POLICY "Students can update own reports"
    ON reports FOR UPDATE
    USING (student_id = auth.uid() AND report_date = CURRENT_DATE)
    WITH CHECK (student_id = auth.uid());

-- Teachers can view reports from students in their halaqahs
CREATE POLICY "Teachers can view halaqah reports"
    ON reports FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM halaqahs
            WHERE id = reports.halaqah_id
            AND teacher_id = auth.uid()
        )
    );

-- Admins can view all reports
CREATE POLICY "Admins can view all reports"
    ON reports FOR SELECT
    USING (is_admin(auth.uid()));

-- Admins can manage all reports
CREATE POLICY "Admins can manage reports"
    ON reports FOR ALL
    USING (is_admin(auth.uid()));

-- ============================================
-- 6.5 REPORT_ITEMS POLICIES
-- ============================================

-- Students can view their own report items
CREATE POLICY "Students can view own report items"
    ON report_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reports
            WHERE id = report_items.report_id
            AND student_id = auth.uid()
        )
    );

-- Students can create report items for their reports
CREATE POLICY "Students can create report items"
    ON report_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM reports
            WHERE id = report_items.report_id
            AND student_id = auth.uid()
        )
    );

-- Students can update their own report items (same day only)
CREATE POLICY "Students can update own report items"
    ON report_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM reports
            WHERE id = report_items.report_id
            AND student_id = auth.uid()
            AND report_date = CURRENT_DATE
        )
    );

-- Students can delete their own report items (same day only)
CREATE POLICY "Students can delete own report items"
    ON report_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM reports
            WHERE id = report_items.report_id
            AND student_id = auth.uid()
            AND report_date = CURRENT_DATE
        )
    );

-- Teachers can view report items from their halaqahs
CREATE POLICY "Teachers can view halaqah report items"
    ON report_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM reports r
            JOIN halaqahs h ON r.halaqah_id = h.id
            WHERE r.id = report_items.report_id
            AND h.teacher_id = auth.uid()
        )
    );

-- Admins can view all report items
CREATE POLICY "Admins can view all report items"
    ON report_items FOR SELECT
    USING (is_admin(auth.uid()));

-- Admins can manage all report items
CREATE POLICY "Admins can manage report items"
    ON report_items FOR ALL
    USING (is_admin(auth.uid()));

-- ============================================
-- 7. VIEWS (for easier querying)
-- ============================================

-- View: Student progress summary
CREATE OR REPLACE VIEW student_progress AS
SELECT
    p.id AS student_id,
    p.first_name || ' ' || p.second_name AS student_name,
    hm.halaqah_id,
    h.name AS halaqah_name,
    COALESCE(SUM(CASE WHEN ri.type = 'memorization' THEN ri.pages ELSE 0 END), 0) AS total_memorization_pages,
    COALESCE(SUM(CASE WHEN ri.type = 'review' THEN ri.pages ELSE 0 END), 0) AS total_review_pages,
    ROUND(COALESCE(SUM(CASE WHEN ri.type = 'memorization' THEN ri.pages ELSE 0 END), 0) / 604.0 * 100, 2) AS progress_percentage
FROM profiles p
JOIN halaqah_members hm ON p.id = hm.student_id
JOIN halaqahs h ON hm.halaqah_id = h.id
LEFT JOIN reports r ON p.id = r.student_id AND r.halaqah_id = h.id
LEFT JOIN report_items ri ON r.id = ri.report_id
WHERE p.role = 'student'
GROUP BY p.id, p.first_name, p.second_name, hm.halaqah_id, h.name;

-- View: Halaqah statistics
CREATE OR REPLACE VIEW halaqah_stats AS
SELECT
    h.id AS halaqah_id,
    h.name AS halaqah_name,
    p.first_name || ' ' || p.second_name AS teacher_name,
    COUNT(DISTINCT hm.student_id) AS student_count,
    COALESCE(SUM(CASE WHEN ri.type = 'memorization' THEN ri.pages ELSE 0 END), 0) AS total_memorization_pages,
    ROUND(AVG(sp.progress_percentage), 2) AS avg_progress_percentage
FROM halaqahs h
LEFT JOIN profiles p ON h.teacher_id = p.id
LEFT JOIN halaqah_members hm ON h.id = hm.halaqah_id
LEFT JOIN student_progress sp ON hm.student_id = sp.student_id AND h.id = sp.halaqah_id
LEFT JOIN reports r ON h.id = r.halaqah_id
LEFT JOIN report_items ri ON r.id = ri.report_id
GROUP BY h.id, h.name, p.first_name, p.second_name;

-- ============================================
-- 8. SEED DATA (Optional - for testing)
-- ============================================

-- Uncomment and modify to add initial admin user
-- After creating the first user via Supabase Auth, update their role:
-- UPDATE profiles SET role = 'admin', status = 'active' WHERE email = 'admin@example.com';
