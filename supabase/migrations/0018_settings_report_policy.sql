-- ============================================================
-- 0018_settings_report_policy
--
-- Adds a `report_policy` jsonb column to `public.settings`. The
-- column drives the automatic-suspension scheduler introduced in
-- migration 0021.
--
-- Canonical shape (frontend + scheduler both expect this):
--
--   {
--     "enabled":            false,        -- boolean
--     "grace_period_days":  7             -- positive integer
--   }
--
-- Semantics:
--   • enabled=false → the scheduler exits without doing anything.
--   • enabled=true  → any active student whose last-report gap
--                     exceeds grace_period_days is suspended.
--
-- Additive, non-breaking:
--   • DEFAULT '{"enabled":false,"grace_period_days":7}' — every
--     existing row is immediately valid, no backfill.
--   • NOT NULL because callers treat a missing value as "policy
--     disabled with a safe default". Storing the concrete default
--     avoids null-branching in downstream code.
--   • IF NOT EXISTS so re-running is safe.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE IF EXISTS public.settings
  ADD COLUMN IF NOT EXISTS report_policy jsonb
    NOT NULL
    DEFAULT '{"enabled":false,"grace_period_days":7}'::jsonb;
