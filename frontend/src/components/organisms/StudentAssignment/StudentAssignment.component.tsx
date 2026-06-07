/**
 * StudentAssignment Component
 * Modal for assigning students to a halaqah
 */
import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../atoms/Modal';
import { Button } from '../../atoms/Button';
import { Input } from '../../atoms/Input';
import { Badge } from '../../atoms/Badge';
import { PlusIcon, UsersIcon } from '../../atoms/Icon';
import { Pagination } from '../../molecules/Pagination';
import { ConfirmDialog } from '../../molecules/ConfirmDialog';
import { usePagination } from '../../../hooks/usePagination';
import { db, api } from '../../../lib/supabase';
import { supabase } from '../../../lib/supabase/client';
import { useToast } from '../../../context/ToastContext';
import { useTranslation } from '../../../locales/i18n';
import { canStudentJoinHalaqah } from '../../../lib/domain/roleRules';
import { uiText } from '../../../lib/uiText';
import { studentAssignmentStyles as styles } from './StudentAssignment.style';
import type { StudentAssignmentProps, StudentWithMembership } from './StudentAssignment.types';
import type { Profile } from '../../../types';

const PAGE_SIZE = 8;

export function StudentAssignment({
  halaqahId,
  halaqahName,
  halaqah,
  isOpen,
  onClose,
  onSuccess,
}: StudentAssignmentProps) {
  const { t } = useTranslation();
  const toast = useToast();

  // Bounded — one halaqah's active members. Fetched once per modal
  // open + after each mutation. Kept fully in memory (typically < 50).
  const [assignedStudents, setAssignedStudents] = useState<StudentWithMembership[]>([]);

  // Paginated — students eligible to assign. Server returns ONE page
  // per request via .range() + count: 'exact'.
  const [students, setStudents] = useState<StudentWithMembership[]>([]);
  const [availableTotal, setAvailableTotal] = useState(0);
  const [availablePage, setAvailablePage] = useState(0);

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  // For each student already placed somewhere, the membership we'd
  // need to delete in order to move them to this halaqah, plus the
  // current halaqah name (shown in the "currently in X" meta and in
  // the move-confirmation dialog). Built once per modal-open from a
  // single projected select on `halaqah_members ⨝ halaqahs(name)`.
  interface CurrentAssignment {
    membershipId: string;
    halaqahId: string;
    halaqahName: string;
  }
  const [assignmentsByStudentId, setAssignmentsByStudentId] = useState<
    Map<string, CurrentAssignment>
  >(new Map());

  // Move-confirmation state. When the admin clicks Assign on a row
  // that's already placed elsewhere, we stash the move parameters
  // here so the ConfirmDialog can render the source/destination
  // names and the confirm handler can act on them.
  interface PendingMove {
    studentId: string;
    studentName: string;
    fromHalaqahName: string;
    fromMembershipId: string;
  }
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [movingInFlight, setMovingInFlight] = useState(false);

  // Remove-confirmation state. Mirrors the move flow so the admin
  // gets the same yes/no prompt before a destructive action lands
  // on the DB.
  interface PendingRemove {
    membershipId: string;
    studentName: string;
  }
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [removingInFlight, setRemovingInFlight] = useState(false);

  // Fetch the assigned list (bounded — this halaqah's members) AND
  // the GLOBAL assignments map (every active membership joined to
  // its halaqah so we can render "currently in <name>" on grayed-out
  // rows and execute the move on confirm without an extra round-trip).
  // The "this halaqah's" rows are EXCLUDED from the global map so the
  // available list — which already shows them in the Assigned section
  // — doesn't render them a second time.
  const fetchAssigned = useCallback(
    async (): Promise<Set<string>> => {
      const [thisRes, allRes] = await Promise.all([
        db.members.getByHalaqah(halaqahId),
        supabase
          .from('halaqah_members')
          // Halaqah join — gives us the name we'll show on grayed-out
          // rows and in the move-confirmation dialog.
          .select('id, student_id, halaqah_id, halaqah:halaqahs(name)')
          .eq('status', 'active'),
      ]);
      if (thisRes.error) {
        console.error('Error fetching members:', thisRes.error);
        return new Set();
      }
      const members = thisRes.data ?? [];
      setAssignedStudents(
        members.map((m) => ({
          ...(m.student as Profile),
          isAssigned: true,
          membership: m,
        })),
      );
      const thisHalaqahMemberIds = new Set(
        members.map((m) => m.student_id),
      );

      if (allRes.error) {
        // Soft-fail: drop the elsewhere map so grayed-out rows can't
        // render. The available query still works; placed students
        // just won't show as movable until the next refresh.
        console.warn(
          'StudentAssignment: failed to fetch global memberships',
          allRes.error,
        );
        setAssignmentsByStudentId(new Map());
        return thisHalaqahMemberIds;
      }

      const globalRows = (allRes.data ?? []) as Array<{
        id: string;
        student_id: string | null;
        halaqah_id: string | null;
        halaqah: { name?: string | null } | { name?: string | null }[] | null;
      }>;
      const map = new Map<string, CurrentAssignment>();
      for (const row of globalRows) {
        if (!row.student_id || !row.halaqah_id) continue;
        // Skip rows for THIS halaqah — those are already in the
        // Assigned section above.
        if (row.halaqah_id === halaqahId) continue;
        // PostgREST may serialize the embedded relation as either an
        // object or a single-element array depending on cardinality.
        const halaqah = Array.isArray(row.halaqah) ? row.halaqah[0] : row.halaqah;
        map.set(row.student_id, {
          membershipId: row.id,
          halaqahId: row.halaqah_id,
          halaqahName: halaqah?.name || '',
        });
      }
      setAssignmentsByStudentId(map);
      return thisHalaqahMemberIds;
    },
    [halaqahId],
  );

  // Paginated fetch — server-side range + count, all filters pushed
  // into PostgREST so the network payload is exactly one page.
  const fetchAvailable = useCallback(
    async (assignedIds: Set<string>) => {
      const from = availablePage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .eq('role', 'student')
        .eq('status', 'active');

      // Gender filter — mirrors `canStudentJoinHalaqah` exactly so the
      // list and the defensive guard never disagree.
      //
      //   Men halaqah:
      //     show segment='men'
      //     OR  (student_type='child' AND segment='children')   ← unknown-
      //         (per spec, female child must NOT appear here)     gender kid
      //     [the male-child case is already covered by segment='men']
      //
      //   Women halaqah:
      //     show segment='women'
      //     OR  (student_type='child' AND segment IN ('men','children'))
      //         ← male child and unknown-gender child both allowed
      //
      // Halaqahs whose segment is not 'men' or 'women' (legacy rows
      // without the column populated) skip the filter — backward-compat
      // with the predicate.
      const hSeg = halaqah?.segment;
      if (hSeg === 'men') {
        query = query.or(
          `segment.eq.men,and(student_type.eq.child,segment.eq.children)`,
        );
      } else if (hSeg === 'women') {
        query = query.or(
          `segment.eq.women,and(student_type.eq.child,segment.in.(men,children))`,
        );
      }

      // Exclude THIS halaqah's members so they don't appear twice
      // (the Assigned section above already lists them). Students in
      // OTHER halaqahs intentionally stay visible — they'll be
      // grayed out and offered as a "move" candidate via the
      // confirmation dialog.
      if (assignedIds.size > 0) {
        query = query.not(
          'id',
          'in',
          `(${Array.from(assignedIds).join(',')})`,
        );
      }

      // Search — name + email.
      const q = searchQuery.trim().replace(/[%,()]/g, '');
      if (q) {
        query = query.or(
          `first_name.ilike.%${q}%,` +
            `second_name.ilike.%${q}%,` +
            `third_name.ilike.%${q}%,` +
            `email.ilike.%${q}%`,
        );
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error('Error fetching available students:', error);
        toast.error(t('errors.generic'));
        return;
      }
      const rows = (data ?? []) as Profile[];
      setStudents(
        rows.map((r) => ({ ...r, isAssigned: false, membership: undefined })),
      );
      setAvailableTotal(count ?? 0);
    },
    [availablePage, searchQuery, toast, t],
  );

  // Combined refresh: both lists in parallel after any mutation or
  // when the modal opens. fetchAvailable depends on the assigned set.
  const refreshLists = useCallback(async () => {
    setLoading(true);
    try {
      const assignedIds = await fetchAssigned();
      await fetchAvailable(assignedIds);
    } catch (err) {
      console.error('Error fetching data:', err);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [fetchAssigned, fetchAvailable, toast, t]);

  // Modal open → reset state and fetch both lists.
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setAvailablePage(0);
      void refreshLists();
    }
    // refreshLists changes when the assigned set or search/page changes,
    // but on modal-open we want a fresh start regardless — guard on
    // isOpen so we don't re-fetch every keystroke from here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, halaqahId]);

  // Search/page changes within an open modal: re-fetch only the
  // available page. The exclusion set we pass is just THIS halaqah's
  // members (derived from `assignedStudents`) — students in other
  // halaqahs intentionally stay visible so they can be moved here.
  useEffect(() => {
    if (!isOpen) return;
    const thisHalaqahIds = new Set(
      assignedStudents.map((s) => s.id).filter((id): id is string => !!id),
    );
    void fetchAvailable(thisHalaqahIds);
    // assignedStudents intentionally not in deps — we only want this
    // effect to fire on search/page changes; mutations refresh both
    // lists via refreshLists already.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, availablePage]);

  // Reset to page 0 when the search query changes.
  useEffect(() => {
    setAvailablePage(0);
  }, [searchQuery]);

  // Click handler for "Assign". Branches:
  //   - Already in another halaqah → open the ConfirmDialog and let
  //     the admin confirm the move. The dialog's onConfirm runs the
  //     two-step delete+add (commitPendingMove).
  //   - Not placed anywhere       → direct insert (the normal flow).
  // The defensive `canStudentJoinHalaqah` guard runs first in both
  // branches so a gender mismatch never reaches the DB.
  const assignStudent = async (studentId: string) => {
    const target = students.find((s) => s.id === studentId);
    if (target && halaqah && !canStudentJoinHalaqah(target, halaqah)) {
      toast.error(t('assignment.incompatibleGender'));
      return;
    }
    const placedElsewhere = assignmentsByStudentId.get(studentId);
    if (placedElsewhere && target) {
      setPendingMove({
        studentId,
        studentName: getDisplayName(target),
        fromHalaqahName:
          placedElsewhere.halaqahName || t('halaqah.title'),
        fromMembershipId: placedElsewhere.membershipId,
      });
      return;
    }

    setActionLoading(studentId);
    try {
      const { error } = await db.members.add(halaqahId, studentId);

      if (error) {
        console.error('Error assigning student:', error);
        toast.error(t('errors.generic'));
        return;
      }

      toast.success(t('admin.studentAssigned'));
      await refreshLists();
      onSuccess();
    } catch (err) {
      console.error('Error assigning student:', err);
      toast.error(t('errors.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  // Commit the move queued by `pendingMove`. Two steps: remove the
  // OLD membership, then add to THIS halaqah. The old-membership
  // removal mirrors the cascade in `removeStudent` (also drops a
  // stale supervisor relation if any), so the student leaves their
  // previous halaqah cleanly. On any error we surface the message
  // and leave the dialog open so the admin can retry or cancel.
  const commitPendingMove = async () => {
    if (!pendingMove) return;
    setMovingInFlight(true);
    setActionLoading(pendingMove.studentId);
    try {
      const { error: removeErr } = await db.members.remove(
        pendingMove.fromMembershipId,
      );
      if (removeErr) {
        console.error('Move failed at remove step:', removeErr);
        toast.error(t('errors.generic'));
        return;
      }
      // Soft cascade — clear the supervisor relation in the OLD
      // halaqah if any. Same idempotent semantics as `removeStudent`.
      const oldHalaqahId = assignmentsByStudentId.get(pendingMove.studentId)
        ?.halaqahId;
      if (oldHalaqahId) {
        const { error: supErr } = await api.supervisors.remove(
          pendingMove.studentId,
          oldHalaqahId,
        );
        if (supErr) {
          console.warn(
            'Move: failed to clear supervisor row in old halaqah',
            supErr,
          );
        }
      }

      const { error: addErr } = await db.members.add(
        halaqahId,
        pendingMove.studentId,
      );
      if (addErr) {
        console.error('Move failed at add step:', addErr);
        toast.error(t('errors.generic'));
        return;
      }
      toast.success(t('admin.studentMoved'));
      setPendingMove(null);
      await refreshLists();
      onSuccess();
    } catch (err) {
      console.error('Move failed:', err);
      toast.error(t('errors.generic'));
    } finally {
      setMovingInFlight(false);
      setActionLoading(null);
    }
  };

  // Commit the queued remove from `pendingRemove`. Delegates to the
  // existing `removeStudent` helper (which already handles the
  // optimistic update, the supervisor cascade, and the
  // refresh/toast/onSuccess), then clears the dialog state.
  const commitPendingRemove = async () => {
    if (!pendingRemove) return;
    setRemovingInFlight(true);
    try {
      await removeStudent(pendingRemove.membershipId);
    } finally {
      setRemovingInFlight(false);
      setPendingRemove(null);
    }
  };

  // Remove student from halaqah.
  //
  // 1) Optimistic local update — drop the row from `assignedStudents`
  //    immediately so the UI reflects the action even if the network
  //    is slow / the modal is closed before the refetch finishes.
  // 2) Delete the halaqah_members row. On error, restore the snapshot.
  // 3) ALSO delete any halaqah_supervisors row for the same
  //    (user_id, halaqah_id). A student can simultaneously be a
  //    supervisor of the halaqah they're a member of, and the two
  //    relations are independent — without this cascade, removing a
  //    student left a stale supervisor row + badge behind.
  //    The delete is idempotent (zero matching rows is not an error),
  //    so it's safe to call unconditionally.
  // 4) Refetch the modal's own student lists.
  // 5) Trigger the parent refetch so HalaqahDetails re-derives both
  //    members and supervisors from the now-clean DB state.
  const removeStudent = async (memberId: string) => {
    setActionLoading(memberId);
    const target = assignedStudents.find(
      (s) => s.membership?.id === memberId,
    );
    const studentId = target?.id;
    const snapshot = assignedStudents;
    setAssignedStudents((prev) =>
      prev.filter((s) => s.membership?.id !== memberId),
    );
    try {
      const { error } = await db.members.remove(memberId);

      if (error) {
        console.error('Error removing student:', error);
        toast.error(t('errors.generic'));
        setAssignedStudents(snapshot);
        return;
      }

      // Cascade: clean up the halaqah_supervisors row (if any). This is
      // a soft-fail — the membership delete already succeeded, so we
      // log + warn-toast but don't roll back the primary action.
      if (studentId) {
        const { error: supError } = await api.supervisors.remove(
          studentId,
          halaqahId,
        );
        if (supError) {
          console.error(
            'Failed to clean up supervisor relation:',
            supError,
          );
          toast.warning(t('admin.supervisorRemoveFailed'));
        }
      }

      toast.success(t('admin.studentRemoved'));
      await refreshLists();
      onSuccess();
    } catch (err) {
      console.error('Error removing student:', err);
      toast.error(t('errors.generic'));
      setAssignedStudents(snapshot);
    } finally {
      setActionLoading(null);
    }
  };

  // Get student display name
  const getDisplayName = (student: Profile): string => {
    const parts = [student.first_name, student.second_name, student.third_name].filter(Boolean);
    return parts.join(' ') || student.email;
  };

  // Compact label for the "currently in" chip on placed students.
  // The auto-generated halaqah name starts with "حلقة المعلم[/ة]" —
  // strip that prefix and lead with "ا." so the badge stays narrow
  // even when the time-slot label is long. Custom halaqah names that
  // don't match the prefix are rendered verbatim.
  const compactHalaqahLabel = (name: string): string => {
    const trimmed = name.trim();
    const stripped = trimmed.replace(
      /^حلقة\s+(?:المعلم\/ة|المعلمة|المعلم)\s+/u,
      '',
    );
    return stripped === trimmed ? trimmed : `ا. ${stripped}`;
  };

  // `students` already excludes the assigned set AND mismatched
  // genders at the server-query layer. The query encodes the same
  // rule as `canStudentJoinHalaqah` so the list and the defensive
  // guard never disagree: men halaqah only shows male students
  // (+ male / unknown children), women halaqah only shows female
  // students (+ male / unknown children). Female children remain
  // women-only.
  const filteredUnassigned = students;

  // Assigned list is bounded by halaqah size (typically < 50) — still
  // paginate client-side for ergonomic scrolling. Available list is
  // paginated server-side via availablePage/availableTotal.
  const assignedPager = usePagination(assignedStudents);
  const availablePageCount = Math.max(
    1,
    Math.ceil(availableTotal / PAGE_SIZE),
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${t(uiText.getManageStudentsLabel(halaqah?.segment))} - ${halaqahName}`}
      size="lg"
    >
      {loading ? (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
        </div>
      ) : (
        <div className={styles.container}>
          {/* Currently Assigned Students */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <UsersIcon className="w-4 h-4" />
              {t(uiText.getAssignedParticipantsLabel(halaqah?.segment))}
              <span className={styles.sectionCount}>{assignedStudents.length}</span>
            </h3>

            {assignedStudents.length === 0 ? (
              <div className={styles.emptyState}>
                {t(uiText.getEmptyStateText('student', halaqah?.segment))}
              </div>
            ) : (
              <>
                <div className={styles.studentList}>
                  {assignedPager.pageItems.map(student => (
                    <div key={student.id} className={styles.studentItem}>
                      <div className={styles.studentInfo}>
                        <div className={styles.studentName}>{getDisplayName(student)}</div>
                        <div className={styles.studentMeta}>
                          <span>{student.email}</span>
                          {student.phone && <span>{student.phone}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (!student.membership) return;
                          setPendingRemove({
                            membershipId: student.membership.id,
                            studentName: getDisplayName(student),
                          });
                        }}
                        loading={actionLoading === student.membership?.id}
                      >
                        {t('admin.remove')}
                      </Button>
                    </div>
                  ))}
                </div>
                <Pagination
                  page={assignedPager.page}
                  pageCount={assignedPager.pageCount}
                  onPageChange={assignedPager.setPage}
                />
              </>
            )}
          </div>

          <div className={styles.divider} />

          {/* Available Students to Assign */}
          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>
              <PlusIcon className="w-4 h-4" />
              {t(uiText.getAvailableParticipantsLabel(halaqah?.segment))}
              <span className={styles.sectionCount}>{students.length}</span>
            </h3>

            {/* Search */}
            <Input
              type="text"
              placeholder={t(uiText.getSearchStudentLabel(halaqah?.segment))}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />

            {filteredUnassigned.length === 0 ? (
              <div className={styles.emptyState}>
                {searchQuery
                  ? t('admin.noSearchResults')
                  : t(uiText.getEmptyStateText('student', halaqah?.segment))}
              </div>
            ) : (
              <>
                <div className={styles.studentList}>
                  {filteredUnassigned.map((student) => {
                    const placedElsewhere = assignmentsByStudentId.get(
                      student.id,
                    );
                    return (
                      <div key={student.id} className={styles.studentItem}>
                        <div className={styles.studentInfo}>
                          <div className={styles.studentName}>
                            {getDisplayName(student)}
                          </div>
                          <div className={styles.studentMeta}>
                            <span className="truncate">{student.email}</span>
                            {student.memorization_level && (
                              <Badge variant="secondary" size="sm">
                                {t(`registration.${student.memorization_level}`)}
                              </Badge>
                            )}
                          </div>
                          {placedElsewhere && (
                            // Sits on its own line so the long
                            // auto-generated name doesn't squeeze the
                            // email + level. Subtle outline variant —
                            // informational, not alarming.
                            <div className="mt-1.5">
                              <Badge variant="outline" size="sm">
                                {compactHalaqahLabel(placedElsewhere.halaqahName)}
                              </Badge>
                            </div>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant={placedElsewhere ? 'primary' : 'success'}
                          onClick={() => assignStudent(student.id)}
                          loading={actionLoading === student.id}
                        >
                          {placedElsewhere ? (
                            t('assignment.move')
                          ) : (
                            <>
                              <PlusIcon className="w-4 h-4" />
                              {t('admin.assign')}
                            </>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
                <Pagination
                  page={availablePage}
                  pageCount={availablePageCount}
                  onPageChange={setAvailablePage}
                />
              </>
            )}
          </div>

          <div className={styles.footer}>
            <Button variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* Move confirmation. Renders only when the admin clicked
          Assign on a student who's already in another halaqah —
          confirm runs commitPendingMove which deletes the old
          membership and inserts the new one in sequence. */}
      <ConfirmDialog
        isOpen={pendingMove !== null}
        onClose={() => {
          if (!movingInFlight) setPendingMove(null);
        }}
        onConfirm={() => void commitPendingMove()}
        title={t('assignment.confirmMoveTitle')}
        body={
          pendingMove
            ? t('assignment.confirmMoveBody')
                .replace('{{student}}', pendingMove.studentName)
                .replace('{{from}}', pendingMove.fromHalaqahName)
                .replace('{{to}}', halaqahName)
            : ''
        }
        confirmLabel={t('assignment.move')}
        confirmVariant="primary"
        loading={movingInFlight}
      />

      {/* Remove confirmation. Same yes/no prompt shape as the move
          flow so a destructive action never lands on the DB without
          an explicit confirm. */}
      <ConfirmDialog
        isOpen={pendingRemove !== null}
        onClose={() => {
          if (!removingInFlight) setPendingRemove(null);
        }}
        onConfirm={() => void commitPendingRemove()}
        title={t('assignment.confirmRemoveTitle')}
        body={
          pendingRemove
            ? t('assignment.confirmRemoveBody')
                .replace('{{student}}', pendingRemove.studentName)
                .replace('{{halaqah}}', halaqahName)
            : ''
        }
        confirmLabel={t('admin.remove')}
        loading={removingInFlight}
      />
    </Modal>
  );
}

export default StudentAssignment;
