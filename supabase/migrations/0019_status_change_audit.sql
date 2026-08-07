-- ============================================================
-- 0019_status_change_audit
--
-- Introduces the `status_change_audit` table — the append-only log
-- of every profile-status change in the academy. One row per
-- transition, regardless of who ran it (admin, supervisor manager,
-- teacher, halaqah supervisor, or the automatic scheduler).
--
-- The row schema captures WHAT changed, WHO changed it, WHY, and
-- from WHICH UI surface / system channel:
--
--   student_id       — the profile whose status transitioned
--   previous_status  — enum value before the change
--   new_status       — enum value after the change
--   changed_by       — profiles.id of the actor (NULL for the
--                       automatic scheduler; there is no user)
--   changed_by_role  — role snapshot at time of change; kept as
--                       text so revoked roles / renames don't
--                       break past rows
--   source           — coarse channel: which UI or system caused
--                       this. See CHECK constraint for the
--                       enum-of-strings.
--   reason           — coarse intent: manual vs automatic,
--                       activation vs suspension.
--   details          — free-form jsonb payload for context
--                       (e.g. latest_report_date, days_since_report
--                       for automatic suspensions).
--   created_at       — server-generated timestamp.
--
-- Access model:
--   • SELECT: admin + supervisor_manager only (RLS).
--   • INSERT: gated to internal SECURITY DEFINER functions in
--     migration 0020 (`apply_student_status_change`). The public
--     policy denies all direct writes from anon/authenticated.
--     Nobody can hand-forge an audit row.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.status_change_audit (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id        UUID NOT NULL REFERENCES public.profiles(id)
                            ON DELETE CASCADE,
    previous_status   public.account_status NOT NULL,
    new_status        public.account_status NOT NULL,
    changed_by        UUID REFERENCES public.profiles(id)
                            ON DELETE SET NULL,
    changed_by_role   TEXT,
    source            TEXT NOT NULL,
    reason            TEXT NOT NULL,
    details           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Source is one of a fixed enum-of-strings. Kept as TEXT + CHECK
    -- so adding a new source (e.g. 'email_worker') later is one
    -- migration and doesn't require an ALTER TYPE. Text values
    -- match the frontend `AuditSource` union byte-for-byte.
    CONSTRAINT status_change_audit_source_check CHECK (
        source IN (
            'admin_users',
            'halaqah_details',
            'supervisor_dashboard',
            'automatic_scheduler',
            'system'
        )
    ),

    -- Same design for reason.
    CONSTRAINT status_change_audit_reason_check CHECK (
        reason IN (
            'manual_suspension',
            'manual_activation',
            'automatic_suspension',
            'automatic_reactivation'
        )
    )
);

-- Indexes: every filter surface the audit page exposes needs an
-- index so search is O(log n). student_id + created_at combine
-- for the "activity per student" page.
CREATE INDEX IF NOT EXISTS idx_status_change_audit_student
    ON public.status_change_audit(student_id);
CREATE INDEX IF NOT EXISTS idx_status_change_audit_changed_by
    ON public.status_change_audit(changed_by);
CREATE INDEX IF NOT EXISTS idx_status_change_audit_source
    ON public.status_change_audit(source);
CREATE INDEX IF NOT EXISTS idx_status_change_audit_reason
    ON public.status_change_audit(reason);
CREATE INDEX IF NOT EXISTS idx_status_change_audit_new_status
    ON public.status_change_audit(new_status);
CREATE INDEX IF NOT EXISTS idx_status_change_audit_created_at
    ON public.status_change_audit(created_at DESC);

-- RLS ------------------------------------------------------------
ALTER TABLE public.status_change_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "status_change_audit_select_org"  ON public.status_change_audit;
DROP POLICY IF EXISTS "status_change_audit_no_write"    ON public.status_change_audit;

-- SELECT: admin + supervisor_manager only. Uses the existing
-- `get_my_role()` helper introduced in earlier migrations so the
-- policy stays consistent with the rest of the org-scoped tables.
CREATE POLICY "status_change_audit_select_org"
    ON public.status_change_audit
    FOR SELECT
    TO authenticated
    USING (
        public.get_my_role() IN ('admin', 'supervisor_manager')
    );

-- Writes: no direct writes from anon/authenticated. All inserts
-- flow through `apply_student_status_change` (SECURITY DEFINER,
-- migration 0020) which runs with the function owner's privileges
-- and bypasses this policy. A stray client `.insert()` fails
-- closed.
CREATE POLICY "status_change_audit_no_write"
    ON public.status_change_audit
    FOR ALL
    TO authenticated
    USING (false)
    WITH CHECK (false);
