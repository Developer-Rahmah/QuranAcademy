-- ============================================================
-- 0001_init_schema
-- Canonical schema: enums, tables, indexes.
-- Fully idempotent — safe to re-run against a populated DB.
-- ============================================================

-- Extensions ---------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums --------------------------------------------------------
DO $$ BEGIN CREATE TYPE user_role         AS ENUM ('student', 'teacher', 'admin');           EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE student_type      AS ENUM ('woman', 'child');                        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE memorization_level AS ENUM ('beginner', 'intermediate', 'advanced'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE preferred_audience AS ENUM ('children', 'women', 'both');            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE account_status    AS ENUM ('pending', 'active', 'suspended');        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE halaqah_status    AS ENUM ('active', 'paused', 'completed');         EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE report_type       AS ENUM ('memorization', 'review');                EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- profiles -----------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email               TEXT NOT NULL UNIQUE,
    first_name          TEXT NOT NULL DEFAULT '',
    second_name         TEXT NOT NULL DEFAULT '',
    third_name          TEXT NOT NULL DEFAULT '',
    phone               TEXT NOT NULL DEFAULT '',
    age                 INTEGER,
    country             TEXT,
    role                user_role NOT NULL DEFAULT 'student',
    student_type        student_type,
    memorization_level  memorization_level,
    teaching_experience TEXT,
    preferred_audience  preferred_audience,
    available_times     JSONB NOT NULL DEFAULT '[]'::jsonb,
    status              account_status NOT NULL DEFAULT 'pending',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- halaqahs -----------------------------------------------------
-- Note: target_audience is reconciled to preferred_audience in 0004.
CREATE TABLE IF NOT EXISTS halaqahs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    teacher_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
    meet_link       TEXT,
    level           memorization_level,
    target_audience preferred_audience,
    schedule        JSONB NOT NULL DEFAULT '{}'::jsonb,
    status          halaqah_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- halaqah_members ---------------------------------------------
CREATE TABLE IF NOT EXISTS halaqah_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    halaqah_id UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status     account_status NOT NULL DEFAULT 'active',
    UNIQUE(halaqah_id, student_id)
);

-- reports ------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    halaqah_id  UUID NOT NULL REFERENCES halaqahs(id) ON DELETE CASCADE,
    report_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(student_id, halaqah_id, report_date)
);

-- report_items -------------------------------------------------
CREATE TABLE IF NOT EXISTS report_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id  UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    surah_name TEXT NOT NULL,
    pages      DECIMAL(5,2) NOT NULL CHECK (pages >= 0.25),
    type       report_type NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes ------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role            ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_status          ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_halaqahs_teacher         ON halaqahs(teacher_id);
CREATE INDEX IF NOT EXISTS idx_halaqahs_status          ON halaqahs(status);
CREATE INDEX IF NOT EXISTS idx_halaqah_members_halaqah  ON halaqah_members(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_halaqah_members_student  ON halaqah_members(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_student          ON reports(student_id);
CREATE INDEX IF NOT EXISTS idx_reports_halaqah          ON reports(halaqah_id);
CREATE INDEX IF NOT EXISTS idx_reports_date             ON reports(report_date);
CREATE INDEX IF NOT EXISTS idx_report_items_report      ON report_items(report_id);
CREATE INDEX IF NOT EXISTS idx_report_items_type        ON report_items(type);
