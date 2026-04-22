-- ============================================================
-- 0005_user_segmentation_and_teacher_fields
-- Adds:
--   - user_segment enum (women | men | children | non_arab_speakers)
--   - profiles.segment (default 'women' so existing rows stay consistent
--     with the original student_type='woman' assumption)
--   - profiles.recitation             (TEXT, free-form riwayah name)
--   - profiles.quran_parts_taught     (INTEGER 1..30, teacher-only)
--   - profiles.is_certified           (BOOLEAN, teacher ijazah flag)
--   - profiles.authorized_recitations (JSONB array of riwayah names)
-- Fully idempotent.
-- ============================================================

-- user_segment enum -------------------------------------------
DO $$
BEGIN
    CREATE TYPE user_segment AS ENUM ('women', 'men', 'children', 'non_arab_speakers');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Columns -----------------------------------------------------
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS segment user_segment NOT NULL DEFAULT 'women';

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS recitation TEXT;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS quran_parts_taught INTEGER
        CHECK (quran_parts_taught IS NULL OR quran_parts_taught BETWEEN 1 AND 30);

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS is_certified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS authorized_recitations JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Helpful index for admin segmentation filters.
CREATE INDEX IF NOT EXISTS idx_profiles_segment ON profiles(segment);
