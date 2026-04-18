-- ============================================
-- Quran Academy Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'teacher', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE student_type AS ENUM ('woman', 'child');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE memorization_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE preferred_audience AS ENUM ('children', 'women', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE account_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE halaqah_status AS ENUM ('active', 'paused', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE report_type AS ENUM ('memorization', 'review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  second_name TEXT NOT NULL DEFAULT '',
  third_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  age INTEGER,
  country TEXT,
  role user_role NOT NULL DEFAULT 'student',
  student_type student_type,
  memorization_level memorization_level,
  teaching_experience TEXT,
  preferred_audience preferred_audience,
  available_times TEXT[] DEFAULT '{}',
  status account_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HALAQAHS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS halaqahs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  teacher_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  meet_link TEXT,
  level memorization_level,
  target_audience student_type,
  schedule JSONB DEFAULT '{}',
  status halaqah_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HALAQAH_MEMBERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS halaqah_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  halaqah_id UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  status account_status NOT NULL DEFAULT 'active',
  UNIQUE(halaqah_id, student_id)
);

-- ============================================
-- REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  halaqah_id UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- REPORT_ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS report_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  surah_name TEXT NOT NULL,
  pages DECIMAL(5,2) NOT NULL DEFAULT 0,
  type report_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_halaqahs_teacher ON halaqahs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_halaqahs_status ON halaqahs(status);
CREATE INDEX IF NOT EXISTS idx_members_halaqah ON halaqah_members(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_members_student ON halaqah_members(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_student ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_halaqah ON reports(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_report_items_report ON report_items(report_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS halaqahs_updated_at ON halaqahs;
CREATE TRIGGER halaqahs_updated_at
  BEFORE UPDATE ON halaqahs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS reports_updated_at ON reports;
CREATE TRIGGER reports_updated_at
  BEFORE UPDATE ON reports
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
