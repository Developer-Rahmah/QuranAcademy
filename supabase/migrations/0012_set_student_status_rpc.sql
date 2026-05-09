-- ============================================================
-- 0012_set_student_status_rpc
--
-- Adds a SECURITY DEFINER function `public.set_student_status` so
-- teachers and halaqah supervisors can activate/deactivate students
-- they manage WITHOUT widening the profiles UPDATE RLS policy
-- (which currently only allows the row owner + admin).
--
-- Authorization rules (matched to the product spec, Part 3):
--
--   • admin                    → may set any profile's status.
--   • supervisor_manager       → may set any non-admin profile's status.
--   • teacher                  → may set the status of a student that is
--                                a member of a halaqah where the teacher
--                                is `halaqahs.teacher_id`.
--   • halaqah_supervisor       → may set the status of a student that is
--                                a member of a halaqah they supervise
--                                (row in halaqah_supervisors).
--   • anyone else              → DENIED.
--
-- Additionally, the function REFUSES to change the status of admin or
-- supervisor_manager accounts unless the caller is admin — so a teacher
-- cannot accidentally (or maliciously) suspend an org-level account.
--
-- The function takes (target uuid, new_status account_status). It
-- raises `insufficient_privilege` on denial so PostgREST surfaces a
-- 403 to the client and the UI can toast a real error.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_student_status(
    target uuid,
    new_status public.account_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_id        uuid;
    caller_role      public.user_role;
    target_role      public.user_role;
    is_member        boolean;
    is_teacher       boolean;
    is_supervisor    boolean;
BEGIN
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
    END IF;

    SELECT role INTO caller_role FROM public.profiles WHERE id = caller_id;
    IF caller_role IS NULL THEN
        RAISE EXCEPTION 'caller has no profile' USING ERRCODE = '42501';
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
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    -- supervisor_manager: full access to non-org-level accounts (the
    -- guard above already blocks admin / supervisor_manager targets).
    IF caller_role = 'supervisor_manager' THEN
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    -- For teacher / halaqah_supervisor, the target MUST be a student
    -- (not another teacher, supervisor, etc.).
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
            UPDATE public.profiles SET status = new_status WHERE id = target;
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
            UPDATE public.profiles SET status = new_status WHERE id = target;
            RETURN;
        END IF;
    END IF;

    -- We may still allow this for users who are teacher OR supervisor
    -- via the relational role (halaqah_supervisors) but whose
    -- profile.role is something else. This catches dual-role accounts
    -- (e.g. profile.role='student' but also has supervisor rows).
    SELECT EXISTS (
        SELECT 1
          FROM public.halaqah_supervisors hs
          JOIN public.halaqah_members hm ON hm.halaqah_id = hs.halaqah_id
         WHERE hs.user_id = caller_id
           AND hm.student_id = target
    ) INTO is_member;

    IF is_member THEN
        UPDATE public.profiles SET status = new_status WHERE id = target;
        RETURN;
    END IF;

    RAISE EXCEPTION 'not authorized to manage this student'
        USING ERRCODE = '42501';
END;
$$;

-- Allow authenticated users to call the function. The function body
-- handles the per-role authorization itself.
GRANT EXECUTE ON FUNCTION public.set_student_status(uuid, public.account_status)
    TO authenticated;
