-- ============================================================
-- 0016_settings_completed_slots
--
-- Adds a `completed_slots` jsonb column to `public.settings`. The
-- column stores a JSON array of canonical time-slot ids (e.g.
-- `["17-19","19-21"]`) — one entry per slot the admin has marked as
-- "temporarily complete", meaning:
--
--   • the teacher-registration UI disables that slot in the picker,
--     with a "temporarily complete" label so the applicant knows to
--     pick a different time.
--   • student-registration is intentionally unaffected — the closure
--     is about capping teacher intake, not blocking students.
--
-- Additive, non-breaking:
--   • DEFAULT '[]' means every existing row is immediately valid — no
--     backfill step, no NULL to handle downstream.
--   • NOT NULL because callers treat missing-value as "not present in
--     the closure set". Empty array carries the same semantic and
--     avoids branching on null everywhere.
--   • IF NOT EXISTS on both table and column so re-running is safe.
--
-- Idempotent — safe to re-run.
-- ============================================================

ALTER TABLE IF EXISTS public.settings
  ADD COLUMN IF NOT EXISTS completed_slots jsonb NOT NULL DEFAULT '[]'::jsonb;
