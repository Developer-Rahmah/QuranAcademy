-- ============================================================
-- 0021_run_daily_student_suspension
--
-- The automatic suspension pipeline. Runs entirely inside the DB
-- so it has zero dependencies on the frontend, admin login, the
-- browser, or the React lifecycle. Fires from Vercel Cron via
-- `run_daily_student_suspension()` (see migration 0022 for the
-- service_role grant + `frontend/api/cron/daily-suspension.ts`).
--
-- Business rules enforced by this file (v3):
--   1. NEVER derive the inactivity reference from profile.created_at.
--      A student may sit as `pending` for days before an admin
--      activates them and even longer before joining a halaqah —
--      counting those days is unfair.
--   2. Reference date, in strict priority order:
--        1) latest report date (any halaqah)
--        2) FIRST time the student joined ANY halaqah (MIN(joined_at)
--           across all halaqah_members rows for this student, ANY
--           hm.status). Transferring a no-reports student from
--           halaqah A to halaqah B must NOT reset the grace period —
--           the original commitment date A stays the anchor until the
--           student submits their first report.
--        3) if the student has never joined any halaqah at all, they
--           are NOT evaluated — `reason = 'NO_HALAQAH'`,
--           `will_suspend = false`.
--   3. Skip students with no active halaqah_members row (they still
--      need a current active membership to be a suspension target).
--   4. Skip students whose current halaqah is not `active` (paused /
--      completed / anything non-active).
--   5. Only `profiles.status = 'active'` may be suspended; pending
--      and already-suspended students are excluded.
--
-- Data-model note for rule 2: this SQL is correct provided the app's
-- "transfer" flow does NOT hard-delete the original halaqah_members
-- row (soft-delete via hm.status = 'suspended' is fine, or leaving
-- the row and creating a new one for the destination halaqah is also
-- fine). Hard-deleting the row would lose the original joined_at and
-- collapse the anchor back to the new membership's join date. If
-- that becomes a concern, guard the transfer path at the API layer.
--
-- Composition (unchanged from v1 at the boundary):
--   • `report_policy_evaluation` view — the extension point.
--     Now emits a `reason` classification and enriched
--     student / halaqah / teacher context so the admin preview
--     page and future reminder jobs can read one clear row per
--     student without further joins.
--   • `run_daily_student_suspension()` — Vercel-Cron entrypoint.
--     Reads settings.report_policy, aggregates counters per
--     `reason`, iterates only `will_suspend = true` rows through
--     `apply_student_status_change` (atomic UPDATE + audit).
--     Each per-student call is wrapped in its own BEGIN/EXCEPTION
--     so a single failure never aborts the entire run.
--
-- Idempotent — safe to re-run. Function signature is unchanged so
-- the `GRANT EXECUTE ... TO service_role` from migration 0022
-- survives this CREATE OR REPLACE.
-- ============================================================


-- ---------------- report_policy_evaluation view -------------------
-- One row per student (any role='student', any status). The `reason`
-- field classifies each student into exactly one bucket:
--
--   ALREADY_SUSPENDED  status = 'suspended'
--   PENDING            status = 'pending'
--   NO_HALAQAH         status = 'active', no active membership row
--   INACTIVE_HALAQAH   status = 'active', membership present but
--                        halaqah.status <> 'active'
--   NO_REPORTS_YET     eligible so far, no submitted reports; using
--                        joined_halaqah_at as the reference date
--   HAS_REPORTS        eligible so far, has ≥1 submitted report
--
-- `will_suspend` is TRUE iff the reason is NO_REPORTS_YET or
-- HAS_REPORTS AND the days-since-reference exceeds the current
-- grace period. The `enabled` flag is NOT checked here — the
-- scheduler layer gates that so the preview page can show what
-- WOULD suspend under the current grace period regardless of
-- whether the policy is switched on.
--
-- Multi-halaqah students: DISTINCT ON picks the LATEST-joined
-- active membership as the reference. A student who switched
-- halaqahs 2 weeks ago and never reported gets grace from that
-- switch date, not from their oldest join.

-- Drop-then-create instead of CREATE OR REPLACE. Reason: this
-- migration file has been rewritten twice (v1 → v2 → v3), and
-- CREATE OR REPLACE VIEW rejects column renames / reordering
-- ("cannot change name of view column"). DROP … CASCADE is
-- idempotent on fresh DBs (no-op) and lets any dev / prod DB that
-- already ran the earlier column shape (`activated_on`, etc.)
-- upgrade cleanly. No other object depends on this view — the
-- scheduler function looks it up at run-time, not via a schema
-- dependency — so the CASCADE is defensive rather than required.
DROP VIEW IF EXISTS public.report_policy_evaluation CASCADE;

CREATE VIEW public.report_policy_evaluation AS
WITH policy AS (
    SELECT (report_policy ->> 'grace_period_days')::integer AS grace_period_days
      FROM public.settings
      LIMIT 1
),
latest_report AS (
    SELECT
        r.student_id,
        MAX(r.report_date) AS latest_report_date
      FROM public.reports r
     GROUP BY r.student_id
),
-- Earliest EVER halaqah commitment per student, across ANY
-- halaqah_members row regardless of hm.status. This is the
-- countdown anchor when a student has never submitted a report —
-- transferring them between halaqahs must not reset the timer.
--
-- CASCADE on halaqah_members guarantees there are no orphan rows
-- referencing a deleted halaqah, so we can group without joining
-- halaqahs. No status filter here — a soft-deleted (suspended)
-- membership on the transfer origin is still evidence of the
-- student's original commitment.
first_joined AS (
    SELECT
        hm.student_id,
        MIN(hm.joined_at)::date AS first_joined_at
      FROM public.halaqah_members hm
     GROUP BY hm.student_id
),
-- The student's CURRENT active membership (latest join wins among
-- multiple actives). Drives DISPLAY (halaqah / teacher name /
-- halaqah_status) and the ELIGIBILITY gate — a student must have
-- an active row on an active halaqah to be suspendable.
-- Deliberately NOT the source of the reference date any more.
active_membership AS (
    SELECT DISTINCT ON (hm.student_id)
        hm.student_id,
        hm.halaqah_id,
        hm.joined_at,
        h.name       AS halaqah_name,
        h.status     AS halaqah_status,
        h.teacher_id
      FROM public.halaqah_members hm
      JOIN public.halaqahs h ON h.id = hm.halaqah_id
     WHERE hm.status = 'active'
     ORDER BY hm.student_id, hm.joined_at DESC
)
SELECT
    p.id AS student_id,

    -- Display fields — trimmed + collapsed to NULL when blank so the
    -- UI can fall back to `student_email` without extra guarding.
    NULLIF(
        TRIM(BOTH ' ' FROM
            COALESCE(p.first_name, '') || ' ' ||
            COALESCE(p.second_name, '') || ' ' ||
            COALESCE(p.third_name, '')
        ), '')                                     AS student_name,
    p.email                                        AS student_email,

    m.halaqah_id                                   AS halaqah_id,
    m.halaqah_name                                 AS halaqah_name,
    m.halaqah_status                               AS halaqah_status,
    m.teacher_id                                   AS teacher_id,
    NULLIF(
        TRIM(BOTH ' ' FROM
            COALESCE(t.first_name, '') || ' ' ||
            COALESCE(t.second_name, '')
        ), '')                                     AS teacher_name,

    m.joined_at::date                              AS joined_halaqah_at,
    lr.latest_report_date                          AS last_report_date,

    -- Reference date per business rule 2.
    -- • latest_report_date if any exists
    -- • else fj.first_joined_at (MIN across ALL memberships)
    -- • else NULL (no halaqah at all — student is out of scope)
    -- The switch from `m.joined_at` to `fj.first_joined_at` is the
    -- transfer-safety fix: the countdown now survives halaqah
    -- transfers for students who have never submitted a report.
    COALESCE(lr.latest_report_date, fj.first_joined_at) AS reference_date,

    -- Days since the reference. NULL if reference itself is NULL —
    -- callers must treat NULL as "not evaluable".
    (CURRENT_DATE - COALESCE(lr.latest_report_date, fj.first_joined_at))
                                                   AS days_since_reference,

    policy.grace_period_days                       AS grace_period_days,

    (policy.grace_period_days
        - (CURRENT_DATE - COALESCE(lr.latest_report_date, fj.first_joined_at)))
                                                   AS days_until_suspension,

    -- Single classification per row. Order matters — first match wins.
    CASE
        WHEN p.status = 'suspended'          THEN 'ALREADY_SUSPENDED'
        WHEN p.status = 'pending'            THEN 'PENDING'
        WHEN m.halaqah_id IS NULL            THEN 'NO_HALAQAH'
        WHEN m.halaqah_status <> 'active'    THEN 'INACTIVE_HALAQAH'
        WHEN lr.latest_report_date IS NULL   THEN 'NO_REPORTS_YET'
        ELSE                                      'HAS_REPORTS'
    END                                            AS reason,

    -- will_suspend: TRUE iff every business rule is satisfied AND
    -- the grace period is exceeded. Independent of the enabled
    -- flag — the scheduler / preview each gate that separately.
    (
        p.status = 'active'
        AND m.halaqah_id IS NOT NULL
        AND m.halaqah_status = 'active'
        AND policy.grace_period_days IS NOT NULL
        AND policy.grace_period_days > 0
        AND (CURRENT_DATE - COALESCE(lr.latest_report_date, fj.first_joined_at))
            > policy.grace_period_days
    )                                              AS will_suspend,

    -- Debug-visible anchor for the no-reports branch. Added at the
    -- END of the column list so this CREATE OR REPLACE VIEW is
    -- compatible with the previous shape (PG requires existing
    -- columns to keep their names / positions / types; only
    -- appends are allowed).
    fj.first_joined_at                             AS first_joined_at

  FROM public.profiles p
  LEFT JOIN active_membership m ON m.student_id = p.id
  LEFT JOIN latest_report lr    ON lr.student_id = p.id
  LEFT JOIN first_joined fj     ON fj.student_id = p.id
  LEFT JOIN public.profiles t   ON t.id = m.teacher_id
  CROSS JOIN policy
 WHERE p.role = 'student';

-- Read access: SECURITY INVOKER means callers see rows only within
-- their own RLS bounds. Admins / supervisor_managers see everything;
-- teachers see students in their halaqahs; regular students see
-- themselves. The GRANT is symmetric with the anon/authenticated
-- pattern used elsewhere.
GRANT SELECT ON public.report_policy_evaluation TO authenticated;


-- ---------------- run_daily_student_suspension --------------------
-- Same signature as v1 so the `GRANT EXECUTE ... TO service_role`
-- from migration 0022 remains attached. The Vercel Cron endpoint
-- (`frontend/api/cron/daily-suspension.ts`) calls this exactly once
-- per day.
--
-- Returns a jsonb summary with the following keys (all non-null):
--   processed                 — total rows in the evaluation view
--   eligible                  — rows where will_suspend = true
--   suspended                 — audit rows actually written this run
--   already_suspended         — students already at status='suspended'
--   pending_students          — students at status='pending'
--   students_without_halaqah  — active students with no active
--                                membership
--   inactive_halaqah          — active students whose halaqah is
--                                paused / completed / non-active
--   errors                    — per-student failures caught
--   enabled                   — the current policy.enabled flag
--   grace_period              — the current policy.grace_period_days
--   run_at                    — server timestamp of this invocation
--
-- Behaviour:
--   • Policy disabled OR grace_period missing / non-positive →
--     return summary with suspended=0, errors=0, but reporting
--     accurate `eligible` / `pending` / `no_halaqah` /
--     `inactive_halaqah` counters so admins can see the WOULD-BE
--     impact before enabling.
--   • Policy enabled → LOOP only will_suspend=true rows, dispatch
--     each through apply_student_status_change (idempotent), catch
--     per-row exceptions into the `errors` counter.

CREATE OR REPLACE FUNCTION public.run_daily_student_suspension()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_enabled              boolean;
    v_grace_period         integer;

    -- Aggregate counters, computed regardless of enabled flag.
    v_processed            integer := 0;
    v_eligible             integer := 0;
    v_already_suspended    integer := 0;
    v_pending              integer := 0;
    v_no_halaqah           integer := 0;
    v_inactive_halaqah     integer := 0;

    -- Per-run mutation counters (only accumulate when enabled).
    v_suspended            integer := 0;
    v_errors               integer := 0;

    v_audit_id             uuid;
    r                      record;
BEGIN
    SELECT
        (report_policy ->> 'enabled')::boolean,
        (report_policy ->> 'grace_period_days')::integer
      INTO v_enabled, v_grace_period
      FROM public.settings
      LIMIT 1;

    -- One aggregate pass over the view populates ALL classification
    -- counters at once — no per-classification round trip, no N+1.
    SELECT
        COUNT(*)                                            ::integer,
        COUNT(*) FILTER (WHERE will_suspend)                ::integer,
        COUNT(*) FILTER (WHERE reason = 'ALREADY_SUSPENDED')::integer,
        COUNT(*) FILTER (WHERE reason = 'PENDING')          ::integer,
        COUNT(*) FILTER (WHERE reason = 'NO_HALAQAH')       ::integer,
        COUNT(*) FILTER (WHERE reason = 'INACTIVE_HALAQAH') ::integer
      INTO
        v_processed,
        v_eligible,
        v_already_suspended,
        v_pending,
        v_no_halaqah,
        v_inactive_halaqah
      FROM public.report_policy_evaluation;

    -- Guard: policy disabled OR malformed grace period. We return
    -- the counters we already computed so a "dry" invocation still
    -- surfaces the WOULD-BE impact — useful before flipping the
    -- switch on for the first time.
    IF NOT COALESCE(v_enabled, false)
       OR v_grace_period IS NULL
       OR v_grace_period <= 0 THEN
        RETURN jsonb_build_object(
            'processed',                v_processed,
            'eligible',                 v_eligible,
            'suspended',                0,
            'already_suspended',        v_already_suspended,
            'pending_students',         v_pending,
            'students_without_halaqah', v_no_halaqah,
            'inactive_halaqah',         v_inactive_halaqah,
            'errors',                   0,
            'enabled',                  COALESCE(v_enabled, false),
            'grace_period',             v_grace_period,
            'run_at',                   NOW()
        );
    END IF;

    -- Iterate eligible candidates. Each per-row call is wrapped in
    -- its own BEGIN/EXCEPTION block so a single-student failure
    -- (e.g. concurrent DELETE) increments the errors counter
    -- without aborting the whole cron run.
    FOR r IN
        SELECT
            student_id,
            last_report_date,
            reference_date,
            days_since_reference,
            grace_period_days,
            reason,
            first_joined_at
          FROM public.report_policy_evaluation
         WHERE will_suspend = true
    LOOP
        BEGIN
            v_audit_id := public.apply_student_status_change(
                r.student_id,
                'suspended'::public.account_status,
                'automatic_scheduler',
                'automatic_suspension',
                jsonb_build_object(
                    'latest_report_date',   r.last_report_date,
                    'reference_date',       r.reference_date,
                    'days_since_reference', r.days_since_reference,
                    'grace_period_days',    r.grace_period_days,
                    'reason',               r.reason,
                    'first_joined_at',      r.first_joined_at
                ),
                NULL   -- scheduler runs without auth.uid()
            );

            -- apply_student_status_change returns NULL on no-op
            -- (already suspended). Count only real transitions;
            -- pre-existing suspensions are captured by
            -- v_already_suspended above.
            IF v_audit_id IS NOT NULL THEN
                v_suspended := v_suspended + 1;
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Log at DB level (audit table can't hold a
            -- transition-failed row without violating its NOT
            -- NULL constraints). The counter surfaces the failure
            -- in the scheduler summary so Vercel logs pick it up.
            v_errors := v_errors + 1;
            RAISE WARNING
                'run_daily_student_suspension: student % failed: %',
                r.student_id, SQLERRM;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'processed',                v_processed,
        'eligible',                 v_eligible,
        'suspended',                v_suspended,
        'already_suspended',        v_already_suspended,
        'pending_students',         v_pending,
        'students_without_halaqah', v_no_halaqah,
        'inactive_halaqah',         v_inactive_halaqah,
        'errors',                   v_errors,
        'enabled',                  true,
        'grace_period',             v_grace_period,
        'run_at',                   NOW()
    );
END;
$$;

-- Internal-only: no client should call this directly. Migration
-- 0022 grants EXECUTE to service_role for the Vercel Cron path.
REVOKE ALL ON FUNCTION public.run_daily_student_suspension() FROM PUBLIC;
