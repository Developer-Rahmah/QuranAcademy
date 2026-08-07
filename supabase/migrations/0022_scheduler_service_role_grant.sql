-- ============================================================
-- 0022_scheduler_service_role_grant
--
-- Scheduling for `run_daily_student_suspension()` lives OUTSIDE the
-- database — a Vercel Cron job hits a Node.js serverless endpoint
-- once a day (see `frontend/api/cron/daily-suspension.ts`). The
-- endpoint authenticates the DB call with the Supabase
-- `service_role` key.
--
-- Why not pg_cron on Supabase Free:
--   • Free-tier projects auto-pause after 7 days of inactivity;
--     when paused, pg_cron does not run and there is no alert.
--   • No execution SLA on the Free tier.
-- Vercel Cron fires reliably regardless of DB activity state and
-- gives us a retryable HTTP hook that's easier to observe.
--
-- This migration is the DB half of the swap:
--   1. Defensively unschedule any pre-existing `daily-student-
--      suspension` pg_cron job (in case an earlier version of this
--      migration set had been applied — a no-op if pg_cron isn't
--      installed or no such job exists).
--   2. GRANT EXECUTE on the scheduler function to `service_role`
--      so the Vercel endpoint can invoke it. `service_role` is the
--      Supabase-managed role attached to the SUPABASE_SERVICE_ROLE_KEY;
--      it bypasses RLS. The function stays REVOKEd from PUBLIC, so
--      no client JWT (anon, authenticated) can call it directly.
--
-- Idempotent — safe to re-run.
-- ============================================================

-- ---------------- 1. Remove any pre-existing pg_cron job ---------
-- Wrapped in a DO block so this migration succeeds cleanly on
-- projects where pg_cron was never installed (Free tier that
-- opted not to enable it) OR where the job simply never existed.
DO $$
BEGIN
    -- Reject silently if pg_cron isn't installed — we don't need
    -- it any more and don't want the migration to fail on
    -- installations that never had it.
    IF EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
    ) THEN
        BEGIN
            PERFORM cron.unschedule('daily-student-suspension');
        EXCEPTION WHEN OTHERS THEN
            -- Job didn't exist; nothing to do. Keep migration idempotent.
            NULL;
        END;
    END IF;
END $$;


-- ---------------- 2. Grant EXECUTE to service_role ---------------
-- `run_daily_student_suspension` is REVOKE-ALLed from PUBLIC in
-- migration 0021 (internal). The Vercel Cron endpoint uses the
-- service_role key; the grant here is what lets it call the RPC.
--
-- service_role is a Supabase-managed superuser-adjacent role that
-- bypasses RLS. Granting a single well-defined function to it is
-- narrower than the alternative (route through a webhook + widen
-- some other policy) and keeps the security surface small.

GRANT EXECUTE ON FUNCTION public.run_daily_student_suspension()
    TO service_role;
