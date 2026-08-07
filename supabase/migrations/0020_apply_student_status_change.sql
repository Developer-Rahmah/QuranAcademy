-- ============================================================
-- 0020_apply_student_status_change
--
-- Introduces a single write path for every profile-status change
-- in the academy, and refactors `set_student_status` to funnel
-- through it. From this migration on:
--
--   • Every UI surface (AdminUsers / HalaqahDetails / Supervisor
--     Dashboard) calls `set_student_status(target, new_status,
--     p_source, p_reason, p_details)` — kept backward compatible
--     via DEFAULT parameters so pre-migration clients (calling
--     with just target + new_status) still work.
--   • The scheduler (migration 0021) calls the internal helper
--     `apply_student_status_change` directly, bypassing the
--     caller-must-be-active auth check because it runs as a DB
--     job with no auth.uid().
--
-- Design goals (per Part 4 / Part 8 of the spec):
--   1. Every status flip is auditable — enforced structurally by
--      routing the UPDATE + audit INSERT through one function.
--   2. Idempotent — a no-op transition (current == new_status)
--      returns early WITHOUT writing an audit row. Re-running the
--      scheduler twice never produces duplicate rows.
--   3. Backward-compatible — old call signatures still resolve
--      via DEFAULT params. UI code can migrate incrementally.
--
-- Idempotent — safe to re-run.
-- ============================================================


-- ---------------- helpers -----------------------------------------

-- Derive a default reason string from (source, new_status) when the
-- caller doesn't explicitly supply one. Keeps the CHECK constraint
-- on status_change_audit.reason satisfied automatically.
CREATE OR REPLACE FUNCTION public.default_status_change_reason(
    p_source     text,
    p_new_status public.account_status
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
    SELECT CASE
        WHEN p_source = 'automatic_scheduler' AND p_new_status = 'suspended'
            THEN 'automatic_suspension'
        WHEN p_source = 'automatic_scheduler' AND p_new_status = 'active'
            THEN 'automatic_reactivation'
        WHEN p_new_status = 'active'
            THEN 'manual_activation'
        ELSE 'manual_suspension'
    END;
$$;


-- ---------------- apply_student_status_change ---------------------
-- Canonical writer: UPDATE profiles + INSERT audit row in one
-- transaction. SECURITY DEFINER so it can bypass the audit-table
-- RLS deny-all policy. Never called directly by clients — access
-- is granted only to postgres/service_role so a leaked auth.uid()
-- can't invoke it. UI callers hit `set_student_status`, which
-- calls this after its own auth checks.
--
-- Contract:
--   • Reads current status once; returns early on no-op.
--   • Emits ONE audit row per real transition.
--   • changed_by defaults to auth.uid(); pass an explicit UUID
--     (or NULL) for the scheduler path.
--   • changed_by_role is snapshotted at write time (STABLE across
--     future role renames).
--   • Returns the id of the audit row (or NULL if no-op) so the
--     caller can surface a receipt if it wants.

CREATE OR REPLACE FUNCTION public.apply_student_status_change(
    p_target       uuid,
    p_new_status   public.account_status,
    p_source       text,
    p_reason       text DEFAULT NULL,
    p_details      jsonb DEFAULT '{}'::jsonb,
    p_changed_by   uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_status  public.account_status;
    resolved_reason text;
    actor_id        uuid;
    actor_role      text;
    audit_id        uuid;
BEGIN
    -- 1. Load current status. Locks the profile row for the rest
    --    of the transaction so a concurrent flip can't smuggle
    --    two audit entries through.
    SELECT status INTO current_status
      FROM public.profiles
     WHERE id = p_target
     FOR UPDATE;

    IF current_status IS NULL THEN
        RAISE EXCEPTION 'target profile not found'
            USING ERRCODE = 'P0002';
    END IF;

    -- 2. Idempotency short-circuit. No-op transitions do NOT emit
    --    an audit row — a re-run of the scheduler or a double-click
    --    on the admin button leaves the audit trail truthful.
    IF current_status = p_new_status THEN
        RETURN NULL;
    END IF;

    -- 3. Resolve actor identity. Callers may pass an explicit id
    --    (scheduler passes NULL); otherwise fall back to auth.uid()
    --    at write time. Role is snapshotted from profiles so the
    --    audit row survives future role renames / revocations.
    actor_id := COALESCE(p_changed_by, auth.uid());
    IF actor_id IS NOT NULL THEN
        SELECT role::text INTO actor_role
          FROM public.profiles
         WHERE id = actor_id;
    END IF;

    -- 4. Resolve reason. If the caller omitted it, derive from
    --    (source, new_status) so the CHECK on audit stays green.
    resolved_reason := COALESCE(
        p_reason,
        public.default_status_change_reason(p_source, p_new_status)
    );

    -- 5. Apply the mutation.
    UPDATE public.profiles
       SET status = p_new_status
     WHERE id = p_target;

    -- 6. Log the transition.
    INSERT INTO public.status_change_audit (
        student_id,
        previous_status,
        new_status,
        changed_by,
        changed_by_role,
        source,
        reason,
        details
    ) VALUES (
        p_target,
        current_status,
        p_new_status,
        actor_id,
        actor_role,
        p_source,
        resolved_reason,
        COALESCE(p_details, '{}'::jsonb)
    )
    RETURNING id INTO audit_id;

    RETURN audit_id;
END;
$$;

-- Function is internal — the deny-all RLS on the audit table is
-- authoritative even for other authenticated roles. Only
-- postgres / service_role can invoke it; RPC clients go through
-- `set_student_status`.
REVOKE ALL ON FUNCTION public.apply_student_status_change(
    uuid, public.account_status, text, text, jsonb, uuid
) FROM PUBLIC;


-- ---------------- set_student_status (v2, backward-compat) --------
-- Replaces the body from migration 0015. All auth checks are kept
-- verbatim; the concrete UPDATE + audit INSERT are replaced with a
-- single call to `apply_student_status_change`.
--
-- Two new DEFAULT parameters keep pre-migration clients working:
--   • p_source  — the UI channel the mutation came from. Defaults
--                 to 'system' when the client didn't send one.
--   • p_reason  — optional; NULL means "derive from source + new
--                 status" (see `default_status_change_reason`).
--   • p_details — free-form jsonb.
--
-- Callers that pre-date this migration invoke the RPC with just
-- (target, new_status). PostgREST fills the rest from the DEFAULTs
-- and the function still writes an audit row. UI code is being
-- migrated to always pass p_source explicitly.

CREATE OR REPLACE FUNCTION public.set_student_status(
    target       uuid,
    new_status   public.account_status,
    p_source     text  DEFAULT 'system',
    p_reason     text  DEFAULT NULL,
    p_details    jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id        uuid;
    caller_role      public.user_role;
    caller_status    public.account_status;
    target_role      public.user_role;
    is_member        boolean;
    is_teacher       boolean;
    is_supervisor    boolean;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role, status
      INTO caller_role, caller_status
      FROM public.profiles
     WHERE id = caller_id;

    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'caller has no profile' USING ERRCODE = '42501';
    END IF;

    IF caller_status <> 'active' THEN
        RAISE EXCEPTION 'caller account is not active'
            USING ERRCODE = '42501';
    END IF;

    SELECT role INTO target_role FROM public.profiles WHERE id = target;
    IF target_role IS NULL THEN
        RAISE EXCEPTION 'target profile not found' USING ERRCODE = 'P0002';
    END IF;

    -- Hard guardrail: only admin can touch admin / supervisor_manager rows.
    IF target_role IN ('admin', 'supervisor_manager')
       AND caller_role <> 'admin' THEN
        RAISE EXCEPTION 'cannot modify org-level account'
            USING ERRCODE = '42501';
    END IF;

    -- Admin: full access.
    IF caller_role = 'admin' THEN
        PERFORM public.apply_student_status_change(
            target, new_status, p_source, p_reason, p_details, caller_id
        );
        RETURN;
    END IF;

    -- supervisor_manager: full access to non-org-level accounts.
    IF caller_role = 'supervisor_manager' THEN
        PERFORM public.apply_student_status_change(
            target, new_status, p_source, p_reason, p_details, caller_id
        );
        RETURN;
    END IF;

    -- For teacher / halaqah_supervisor, the target MUST be a student.
    IF target_role <> 'student' THEN
        RAISE EXCEPTION 'target must be a student' USING ERRCODE = '42501';
    END IF;

    -- Teacher: allowed iff target is a member of a halaqah they own.
    IF caller_role = 'teacher' THEN
        SELECT EXISTS (
            SELECT 1
              FROM public.halaqahs h
              JOIN public.halaqah_members hm ON hm.halaqah_id = h.id
             WHERE h.teacher_id = caller_id
               AND hm.student_id = target
        ) INTO is_teacher;

        IF is_teacher THEN
            PERFORM public.apply_student_status_change(
                target, new_status, p_source, p_reason, p_details, caller_id
            );
            RETURN;
        END IF;
    END IF;

    -- halaqah_supervisor: allowed iff target is a member of a halaqah
    -- they supervise.
    IF caller_role = 'halaqah_supervisor' THEN
        SELECT EXISTS (
            SELECT 1
              FROM public.halaqah_supervisors hs
              JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
             WHERE hs.user_id = caller_id
               AND hm.student_id = target
        ) INTO is_supervisor;

        IF is_supervisor THEN
            PERFORM public.apply_student_status_change(
                target, new_status, p_source, p_reason, p_details, caller_id
            );
            RETURN;
        END IF;
    END IF;

    -- Dual-role fallback: profile.role might not be 'halaqah_supervisor'
    -- yet the user has supervisor rows. Allow if relational match.
    SELECT EXISTS (
        SELECT 1
          FROM public.halaqah_supervisors hs
          JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
         WHERE hs.user_id = caller_id
           AND hm.student_id = target
    ) INTO is_member;

    IF is_member THEN
        PERFORM public.apply_student_status_change(
            target, new_status, p_source, p_reason, p_details, caller_id
        );
        RETURN;
    END IF;

    RAISE EXCEPTION 'not authorized to manage this student'
        USING ERRCODE = '42501';
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_student_status(
    uuid, public.account_status, text, text, jsonb
) TO authenticated;
