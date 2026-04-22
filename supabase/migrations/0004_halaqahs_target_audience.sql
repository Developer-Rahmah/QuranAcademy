-- ============================================================
-- 0004_halaqahs_target_audience
-- Reconcile halaqahs.target_audience to use `preferred_audience`
-- (children | women | both). Idempotent: only runs the ALTER when
-- the column is currently the older `student_type` enum.
-- ============================================================

DO $$
DECLARE
    v_udt TEXT;
BEGIN
    SELECT udt_name
      INTO v_udt
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'halaqahs'
       AND column_name  = 'target_audience';

    -- Only migrate if the column still exists and still uses student_type.
    IF v_udt = 'student_type' THEN
        EXECUTE 'ALTER TABLE halaqahs ALTER COLUMN target_audience TYPE TEXT';
        EXECUTE 'ALTER TABLE halaqahs
                    ALTER COLUMN target_audience TYPE preferred_audience
                    USING target_audience::preferred_audience';
    END IF;
END $$;
