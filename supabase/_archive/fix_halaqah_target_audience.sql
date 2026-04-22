-- ============================================================
-- FIX: Halaqah target_audience column
-- The column was using student_type enum (woman, child)
-- But it should support 'both' as well
-- ============================================================

-- Option 1: Change the column to use preferred_audience enum
-- (preferred_audience already has: children, women, both)

-- First, drop the constraint if it exists
ALTER TABLE halaqahs
ALTER COLUMN target_audience TYPE TEXT;

-- Now alter it to use preferred_audience enum
ALTER TABLE halaqahs
ALTER COLUMN target_audience TYPE preferred_audience
USING target_audience::preferred_audience;

-- ============================================================
-- ALTERNATIVE: If the above doesn't work, use this instead:
-- ============================================================
--
-- -- Drop and recreate the column
-- ALTER TABLE halaqahs DROP COLUMN IF EXISTS target_audience;
-- ALTER TABLE halaqahs ADD COLUMN target_audience preferred_audience DEFAULT 'both';
--
-- ============================================================

-- Verify the change
-- SELECT column_name, data_type, udt_name
-- FROM information_schema.columns
-- WHERE table_name = 'halaqahs' AND column_name = 'target_audience';
