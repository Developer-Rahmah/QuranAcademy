/**
 * Admin Users Page - User management for administrators
 * Allows viewing, activating, and suspending user accounts
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../lib/supabase';
import { supabase } from '../lib/supabase/client';
import { adminUserDetailPath, halaqahDetailPath } from '../lib/routes';
import { segmentationRules } from '../lib/segmentationRules';
// AdminUsers is a MIXED context (admin manages everyone), so plural
// labels like "students" / "teachers" resolve to the neutral variant.
import { uiText } from '../lib/uiText';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { StatusBadge, Badge } from '../components/atoms/Badge';
import { UsersIcon, TeacherIcon, CheckIcon } from '../components/atoms/Icon';
import { MatchingBadge } from '../components/molecules/MatchingBadge';
import { Pagination } from '../components/molecules/Pagination';
import { buildMatchIndex, findMatches } from '../lib/matching';
import {
  autoAssignStudent,
  createHalaqahsForTeacher,
  loadAssignmentContext,
  runAssignmentSweep,
} from '../lib/autoHalaqah';
import { buildWhatsAppLink } from '../lib/utils';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../locales/i18n';
import {
  canDeleteUsers,
  canAssignRole as permsCanAssignRole,
  isAdminOrSupervisorManager,
  canManageUserStatus,
} from '../lib/permissions';
import type { Profile, UserRole, AccountStatus, UserSegment } from '../types';

// ============================================
// Types
// ============================================
type FilterRole    = UserRole | 'all';
type FilterStatus  = AccountStatus | 'all';
type FilterSegment = UserSegment | 'all';
/**
 * Halaqah-assignment filter:
 *   - 'all'         — no filter (default)
 *   - 'assigned'    — student is in at least one active halaqah_members
 *                     row / teacher owns at least one halaqahs row
 *   - 'unassigned'  — inverse of the above
 *
 * The filter is role-aware: applied against `halaqah_members` for
 * student rows and against `halaqahs.teacher_id` for teacher rows.
 * Other roles (admin, supervisor_manager, halaqah_supervisor) are
 * neither students nor teachers and are unaffected by this filter.
 */
type FilterAssignment = 'all' | 'assigned' | 'unassigned';
/**
 * Schedule-matching filter:
 *   - 'all'       — no filter (default)
 *   - 'has'       — show only rows that have at least one cross-side match
 *   - 'none'      — show only rows that have no cross-side match
 *
 * A "match" means the row's `available_times` intersects with at least
 * one active profile of the opposite role. Admin rows never participate
 * (they're already excluded from the table) and the filter is silently
 * ignored for rows whose role is neither student nor teacher.
 */
type FilterMatching = 'all' | 'has' | 'none';

interface UserFilters {
  role: FilterRole;
  status: FilterStatus;
  segment: FilterSegment;
  matching: FilterMatching;
  assignment: FilterAssignment;
}

// ============================================
// Styles
// ============================================
const styles = {
  filtersContainer: 'flex flex-wrap gap-4 mb-6',
  filterGroup: 'flex items-center gap-2',
  filterLabel: 'text-base text-muted',
  table: 'w-full',
  tableHead: 'bg-muted/50',
  tableHeadCell: 'px-4 py-3 text-right text-base font-medium text-foreground',
  tableBody: 'divide-y divide-border',
  tableRow: 'hover:bg-muted/30 transition-colors',
  tableCell: 'px-4 py-3 text-base',
  tableCellName: 'font-medium text-foreground',
  tableCellMuted: 'text-muted',
  actionsCell: 'flex gap-2',
  emptyState: 'text-center py-12 text-muted',
  loadingState: 'flex items-center justify-center py-12',
  spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  statsRow: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6',
  statCard: 'bg-card p-4 rounded-lg border border-border text-center',
  statValue: 'text-2xl font-bold text-foreground',
  statLabel: 'text-base text-muted',
};

// ============================================
// Component
// ============================================
export function AdminUsers() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  // Current viewer's role drives what role-change targets they're allowed
  // to assign. Only admin can grant `supervisor_manager`; only admin can
  // grant `admin` (supervisor_manager cannot escalate to admin).
  const { profile: currentUser, refreshProfile } = useAuth();
  const viewerRole = currentUser?.role;
  // Belt-and-braces: the route is already admin-only, but the action
  // helpers re-check viewer role so a future role addition (or a
  // mistakenly widened route guard) can't activate users via UI.
  const allowedToManageStatus = canManageUserStatus(viewerRole);

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
    segment: 'all',
    matching: 'all',
    assignment: 'all',
  });
  // Active student / teacher pools fetched once, used for client-side
  // schedule matching. Independent of the role/status filters above so
  // the badge count on each row always reflects the FULL pool, not
  // whatever subset the current filter would show.
  const [studentsPool, setStudentsPool] = useState<Profile[]>([]);
  const [teachersPool, setTeachersPool] = useState<Profile[]>([]);
  // Halaqah-assignment indexes — Set lookups for O(1) per-row checks.
  //
  //   assignedStudentIds  : student.id ∈ at least one active membership
  //   teachersWithHalaqah : profile.id ∈ halaqahs.teacher_id (any status,
  //                        because even a paused halaqah counts as "the
  //                        teacher is engaged" for triage purposes)
  //
  // Both are derived from a single SELECT per source table on mount.
  // No N+1, no per-row queries.
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set());
  const [teachersWithHalaqah, setTeachersWithHalaqah] = useState<Set<string>>(new Set());
  // Per-user halaqah lookup — feeds the "Halaqah" column in the
  // table. Built off the same halaqahs + memberships fetch as the
  // assignment sets above, so no extra queries. A user may have 0-N
  // halaqahs:
  //   • student → one entry per active membership row
  //   • teacher → one entry per halaqah they own (any status)
  //   • everyone else → not in the map at all
  const [halaqahsByUser, setHalaqahsByUser] = useState<
    Map<string, ReadonlyArray<{ id: string; name: string }>>
  >(new Map());
  // Server-side pagination state. The main user query fetches PAGE_SIZE
  // rows at a time and returns the academy-wide total via
  // `count: 'exact'` so the pager can render "Page X of N". The pool
  // fetches above remain ONE-shot (on mount) — they're projected to
  // just id/segment/age/available_times so the payload stays small
  // even with hundreds of users, and the matching badges + "Has
  // matches"/"Halaqah" filters keep working without re-fetching on
  // every page click.
  const PAGE_SIZE = 8;
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  // Free-text search across the user's name, email, and phone. Applied
  // on top of the role/status/segment dropdown filters so all four can
  // narrow the list together.
  const [searchQuery, setSearchQuery] = useState('');

  // Toggle a single row's selection.
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Bulk-delete the selected profiles. Two-step: confirm dialog → DELETE.
  // Uses the supabase client directly because there's no `delete` method on
  // the legacy `db.profiles` facade. RLS still applies — only admins /
  // supervisor_managers should be able to actually run this.
  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(t('admin.confirmDeleteSelected'))) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from('profiles')
        .delete()
        .in('id', ids);
      if (error) {
        console.error('Bulk delete error:', error);
        toast.error(t('admin.deletedFailed'));
        return;
      }
      toast.success(t('admin.deletedSuccess'));
      setSelectedIds(new Set());
      // Refetch — keeps the stat counts and rows consistent.
      await fetchUsers();
    } finally {
      setBulkDeleting(false);
    }
  };

  // ============================================
  // Fetch Pools (mount-once)
  // ============================================
  // Pools + assignment indexes feed every per-row badge and the
  // "Has matches" / "Halaqah" filters. They're fetched ONCE per
  // session and projected to the minimum columns needed — so the
  // payload stays small even at academy scale and the filters keep
  // working without re-fetching the whole world on every page click.
  const fetchPools = useCallback(async () => {
    try {
      const [studentsRes, teachersRes, membershipsRes, halaqahsRes] =
        await Promise.all([
          // Projected select: just what the matching helpers need.
          supabase
            .from('profiles')
            .select(
              'id, first_name, second_name, third_name, email, segment, age, available_times',
            )
            .eq('role', 'student')
            .eq('status', 'active'),
          supabase
            .from('profiles')
            .select(
              'id, first_name, second_name, third_name, email, segment, age, available_times',
            )
            .eq('role', 'teacher')
            .eq('status', 'active'),
          // halaqah_members: student_id + halaqah_id so we can both
          // populate the assignment set AND look up which halaqah the
          // student belongs to (drives the new "Halaqah" column).
          supabase
            .from('halaqah_members')
            .select('student_id, halaqah_id')
            .eq('status', 'active'),
          // halaqahs: id + name + teacher_id. `id` and `name` drive
          // the Halaqah column links; `teacher_id` drives the
          // assignment set + per-teacher lookup.
          supabase.from('halaqahs').select('id, name, teacher_id'),
        ]);

      setStudentsPool((studentsRes.data ?? []) as Profile[]);
      setTeachersPool((teachersRes.data ?? []) as Profile[]);

      const memberRows = (membershipsRes.data ?? []) as Array<{
        student_id: string | null;
        halaqah_id: string | null;
      }>;
      setAssignedStudentIds(
        new Set(memberRows.map((m) => m.student_id).filter((id): id is string => !!id)),
      );

      const halaqahRows = (halaqahsRes.data ?? []) as Array<{
        id: string | null;
        name: string | null;
        teacher_id: string | null;
      }>;
      setTeachersWithHalaqah(
        new Set(halaqahRows.map((h) => h.teacher_id).filter((id): id is string => !!id)),
      );

      // Build the per-user halaqah lookup. One id → halaqah map so
      // each membership row resolves in O(1) without another fetch,
      // then two passes: memberships for students, direct
      // teacher_id grouping for teachers. A single Map with both
      // sides keeps the table lookup trivial regardless of role.
      const halaqahById = new Map<string, { id: string; name: string }>();
      for (const h of halaqahRows) {
        if (h.id && h.name) halaqahById.set(h.id, { id: h.id, name: h.name });
      }
      const userToHalaqahs = new Map<string, Array<{ id: string; name: string }>>();
      // Students → resolve halaqah_id through the map.
      for (const m of memberRows) {
        if (!m.student_id || !m.halaqah_id) continue;
        const h = halaqahById.get(m.halaqah_id);
        if (!h) continue;
        const list = userToHalaqahs.get(m.student_id) ?? [];
        list.push(h);
        userToHalaqahs.set(m.student_id, list);
      }
      // Teachers → group halaqahs directly by teacher_id.
      for (const h of halaqahRows) {
        if (!h.teacher_id || !h.id || !h.name) continue;
        const list = userToHalaqahs.get(h.teacher_id) ?? [];
        list.push({ id: h.id, name: h.name });
        userToHalaqahs.set(h.teacher_id, list);
      }
      setHalaqahsByUser(userToHalaqahs);
    } catch (err) {
      console.error('Error fetching pools:', err);
      // Best-effort: a failure leaves the badge counts empty but the
      // main user table still works.
    }
  }, []);

  useEffect(() => {
    void fetchPools();
  }, [fetchPools]);

  // Pre-compute the id sets used by the matching/assignment FILTERS
  // (not the per-row badges — those are derived separately further
  // down). These run client-side from the projected pools so we can
  // push the equivalent constraint into the server query via
  // `.in()` / `.not('id', 'in', ...)` instead of fetching the whole
  // table and filtering in memory.
  const idsWithMatches = useMemo(() => {
    const set = new Set<string>();
    // A student "has matches" when at least one teacher pairs via
    // segmentsCompatible + slot intersection (see lib/matching).
    for (const s of studentsPool) {
      if (findMatches(s, teachersPool).length > 0) set.add(s.id);
    }
    for (const tch of teachersPool) {
      if (findMatches(tch, studentsPool).length > 0) set.add(tch.id);
    }
    return set;
  }, [studentsPool, teachersPool]);

  // ============================================
  // Fetch Users (server-side paginated)
  // ============================================
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      // Build the query incrementally. select('*', {count:'exact'})
      // returns rows + an authoritative total — drives the pager.
      // Same `any` cast as profilesApi.list: the generated UserRoleDb
      // union is narrower than runtime UserRole (extended with
      // halaqah_supervisor + supervisor_manager via 0009; types
      // haven't been regenerated yet).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .neq('role', 'admin');

      if (filters.role !== 'all') query = query.eq('role', filters.role);
      if (filters.status !== 'all') query = query.eq('status', filters.status);
      if (filters.segment !== 'all') query = query.eq('segment', filters.segment);

      // Free-text search across the columns the admin would expect to
      // search by. Sanitized of PostgREST-grammar chars so a comma or
      // paren in the query doesn't fracture the .or() clause.
      const q = searchQuery.trim().replace(/[%,()]/g, '');
      if (q) {
        query = query.or(
          `first_name.ilike.%${q}%,` +
            `second_name.ilike.%${q}%,` +
            `third_name.ilike.%${q}%,` +
            `email.ilike.%${q}%,` +
            `phone.ilike.%${q}%`,
        );
      }

      // Schedule-match filter: pass the precomputed id set.
      // For 'none' we constrain to student/teacher rows because the
      // matching concept doesn't apply to admin/supervisor rows.
      if (filters.matching === 'has') {
        const ids = Array.from(idsWithMatches);
        if (ids.length === 0) {
          // Empty set → no rows can match. Short-circuit to keep the
          // query well-formed (PostgREST .in('id', '()') errors out).
          setUsers([]);
          setTotalCount(0);
          return;
        }
        query = query.in('id', ids);
      } else if (filters.matching === 'none') {
        query = query.in('role', ['student', 'teacher']);
        const ids = Array.from(idsWithMatches);
        if (ids.length > 0) {
          query = query.not('id', 'in', `(${ids.join(',')})`);
        }
      }

      // Halaqah-assignment filter: union both role-specific sets so
      // 'assigned' / 'unassigned' applies symmetrically to students
      // and teachers without two separate queries.
      const assignedIdsUnion = [
        ...assignedStudentIds,
        ...teachersWithHalaqah,
      ];
      if (filters.assignment === 'assigned') {
        if (assignedIdsUnion.length === 0) {
          setUsers([]);
          setTotalCount(0);
          return;
        }
        query = query.in('id', assignedIdsUnion);
      } else if (filters.assignment === 'unassigned') {
        query = query.in('role', ['student', 'teacher']);
        if (assignedIdsUnion.length > 0) {
          query = query.not(
            'id',
            'in',
            `(${assignedIdsUnion.join(',')})`,
          );
        }
      }

      // Order + range. order() must come before range() in PostgREST.
      query = query.order('created_at', { ascending: false });
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching users:', error);
        toast.error(t('errors.generic'));
        return;
      }

      setUsers((data ?? []) as Profile[]);
      setTotalCount(count ?? 0);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [
    filters,
    searchQuery,
    currentPage,
    idsWithMatches,
    assignedStudentIds,
    teachersWithHalaqah,
    toast,
    t,
  ]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Reset to page 0 whenever a filter or search query changes — so
  // narrowing the dataset doesn't strand the user on a now-empty
  // page index. fetchUsers re-runs on the page-state change.
  useEffect(() => {
    setCurrentPage(0);
  }, [
    filters.role,
    filters.status,
    filters.segment,
    filters.matching,
    filters.assignment,
    searchQuery,
  ]);

  // ============================================
  // Update User Status
  // ============================================
  const updateUserStatus = async (userId: string, newStatus: AccountStatus) => {
    if (!allowedToManageStatus) {
      // Hard-fail: no role outside admin/supervisor_manager should
      // ever reach this code path, but if they do (e.g. dev tools
      // calling the function directly), refuse rather than mutate.
      toast.error(t('errors.unauthorized'));
      return;
    }
    setActionLoading(userId);
    try {
      const { error } = await db.profiles.update(userId, { status: newStatus });

      if (error) {
        console.error('Error updating user:', error);
        toast.error(t('errors.generic'));
        return;
      }

      toast.success(t('admin.userUpdated'));

      // Activation automation. Triggers ONLY on transitions to
      // 'active' — re-activating an already-active row is a no-op
      // here, and suspension never spawns side-effects on halaqahs.
      // The mutation logic lives in lib/autoHalaqah; this site just
      // dispatches and surfaces the result.
      if (newStatus === 'active') {
        const target = users.find((u) => u.id === userId);
        if (target?.role === 'teacher') {
          await runTeacherActivationAutomation(target);
        } else if (target?.role === 'student') {
          await runStudentActivationAutomation(target);
        }
      }

      await fetchUsers();
      // Self-suspend by an admin/supervisor_manager: refresh own profile
      // so the centralized active-status guard signs them out
      // immediately instead of waiting for the next visibility change.
      if (userId === currentUser?.id && newStatus !== 'active') {
        await refreshProfile();
      }
    } catch (err) {
      console.error('Error updating user:', err);
      toast.error(t('errors.generic'));
    } finally {
      setActionLoading(null);
    }
  };

  // Auto-create the teacher's halaqahs (one per declared time slot)
  // then sweep the unassigned student pool, slotting each compatible
  // student into the least-full new halaqah.
  const runTeacherActivationAutomation = async (teacher: Profile) => {
    const result = await createHalaqahsForTeacher(teacher);
    if (result.failed.length > 0 && result.created.length === 0) {
      toast.error(t('autoAssign.halaqahsCreateFailed'));
      return;
    }
    if (result.created.length > 0) {
      const name = [teacher.first_name, teacher.second_name]
        .filter(Boolean)
        .join(' ');
      toast.success(
        t('autoAssign.halaqahsCreated')
          .replace('{{n}}', String(result.created.length))
          .replace('{{name}}', name),
      );
    }
    // Sweep unassigned students against the newly-available halaqahs.
    // We fetch a fresh context every sweep so the member counts /
    // assigned set reflect the inserts that just landed.
    await sweepUnassignedStudents();
  };

  // Auto-assign a single student to the best-fitting halaqah.
  // Reuses the shared `loadAssignmentContext` helper so the ranking
  // inputs match the academy-wide sweep one-for-one.
  const runStudentActivationAutomation = async (student: Profile) => {
    const ctx = await loadAssignmentContext();
    const result = await autoAssignStudent(student, ctx);
    if (result.halaqah && result.membership) {
      toast.success(
        t('autoAssign.studentAssigned').replace(
          '{{halaqah}}',
          result.halaqah.name,
        ),
      );
    } else if (result.reason === 'no_compatible_halaqah' || result.reason === 'no_slots') {
      toast.warning(t('autoAssign.studentNoMatch'));
    } else if (result.reason === 'add_failed') {
      toast.error(t('errors.generic'));
    }
    // 'already_assigned' is silent — nothing changed and the admin
    // doesn't need a toast for the no-op case.
  };

  // Academy-wide sweep — delegates to the shared helper so the
  // dashboard's "Re-run matching sweep" button and the post-teacher-
  // activation flow stay in lockstep.
  const sweepUnassignedStudents = async () => {
    const result = await runAssignmentSweep();
    if (result.assigned > 0) {
      toast.success(
        t('autoAssign.scanCompletedAssigned').replace(
          '{{n}}',
          String(result.assigned),
        ),
      );
    } else {
      toast.info(t('autoAssign.scanCompletedNone'));
    }
  };

  // ============================================
  // Update Profile Role
  //
  // Permission rules (enforced both client-side and server-side via RLS):
  //   - admin             → can assign any role except itself to admin
  //                         (we still allow it; server is the safety net)
  //   - supervisor_manager → can assign student / teacher only.
  //                         CANNOT promote to admin.
  //   - everyone else     → cannot reach this code path (page is gated).
  //
  // `halaqah_supervisor` is intentionally NOT a target of this dropdown
  // — supervisor status is relational and managed via halaqah_supervisors
  // (HalaqahDetails). Updating profiles.role here would corrupt that.
  // ============================================
  // Centralized permission check — see lib/permissions.ts.
  const canAssignRole = (target: UserRole): boolean =>
    permsCanAssignRole(viewerRole, target);

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (!canAssignRole(newRole)) {
      toast.error(t('admin.notAuthorizedRoleAssignment'));
      return;
    }
    setActionLoading(userId);
    try {
      const { error } = await db.profiles.update(userId, { role: newRole });
      if (error) {
        console.error('Error updating role:', error);
        toast.error(t('admin.roleUpdateFailed'));
        return;
      }
      toast.success(t('admin.roleUpdated'));
      await fetchUsers();
    } finally {
      setActionLoading(null);
    }
  };

  // ============================================
  // Get User Display Name
  // ============================================
  // Shorter "first + last" form for the dashboard table — keeps the row
  // narrow now that we also surface the matching badge column. `last` is
  // the third (family) name when present; otherwise falls back to the
  // second name so single-or-double-name accounts still render something.
  // Empty fallback is the email so a half-filled profile is still
  // identifiable.
  const getDisplayName = (user: Profile): string => {
    const last = user.third_name || user.second_name || '';
    const parts = [user.first_name, last].filter(Boolean);
    return parts.join(' ') || user.email;
  };

  // ============================================
  // Calculate Stats
  // ============================================
  const stats = {
    total: users.length,
    students: users.filter(u => u.role === 'student').length,
    teachers: users.filter(u => u.role === 'teacher').length,
    pending: users.filter(u => u.status === 'pending').length,
    active: users.filter(u => u.status === 'active').length,
  };

  // Pre-compute schedule matches for every visible student against the
  // teacher pool, and vice versa. Memoized so the badge column doesn't
  // recompute on unrelated state changes (search query, action loading,
  // selection set, etc.). Pool identity changes only on (re)fetch.
  const studentMatches = useMemo(
    () => buildMatchIndex(users.filter((u) => u.role === 'student'), teachersPool),
    [users, teachersPool],
  );
  const teacherMatches = useMemo(
    () => buildMatchIndex(users.filter((u) => u.role === 'teacher'), studentsPool),
    [users, studentsPool],
  );

  /** Per-row match list. Empty for non-student/teacher rows. */
  const matchesFor = useCallback(
    (u: Profile) => {
      if (u.role === 'student') return studentMatches.get(u.id) ?? [];
      if (u.role === 'teacher') return teacherMatches.get(u.id) ?? [];
      return [];
    },
    [studentMatches, teacherMatches],
  );

  // All filtering — role/status/segment/search/matching/assignment —
  // now happens server-side in `fetchUsers`. `users` is already the
  // current page (≤ PAGE_SIZE rows) so we don't run a second filter
  // pass here. The variables below give the JSX the same names it
  // used during the client-side era to keep the diff minimal.
  const visibleUsers = users; // for select-all / counter semantics
  const pagedUsers = users; // for the table body
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ============================================
  // Filter Options
  // ============================================
  const roleOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'student', label: t(uiText.getStudentLabel('mixed', 'plural')) },
    { value: 'teacher', label: t(uiText.getTeacherLabel('mixed', 'plural')) },
  ];

  const statusOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'pending', label: t('status.pending') },
    { value: 'active', label: t('status.active') },
    { value: 'suspended', label: t('status.suspended') },
  ];

  // Language (Arabic / non-Arabic speaker) is a separate profile attribute
  // now — it must not appear in the segment filter. Segment filter is
  // strictly gender/age: all | women | men | children.
  const segmentOptions = [
    { value: 'all',      label: t('common.all') },
    { value: 'women',    label: t('segment.women') },
    { value: 'men',      label: t('segment.men') },
    { value: 'children', label: t('segment.children') },
  ];

  // Schedule-match filter — sits alongside role/status/segment so admins
  // can quickly isolate students with at least one matching teacher
  // (and vice versa) when pairing them into halaqahs.
  const matchingOptions = [
    { value: 'all',  label: t('common.all') },
    { value: 'has',  label: t('matching.hasMatches') },
    { value: 'none', label: t('matching.noMatchesLabel') },
  ];

  // Halaqah-assignment filter — combine with `role` to get either
  // "students not in any halaqah" or "teachers without a halaqah".
  const assignmentOptions = [
    { value: 'all',        label: t('common.all') },
    { value: 'unassigned', label: t('assignment.unassigned') },
    { value: 'assigned',   label: t('assignment.assigned') },
  ];

  // ============================================
  // Render
  // ============================================
  return (
    <DashboardLayout
      title={t('admin.userManagement')}
      subtitle={t('admin.userManagementSubtitle')}
    >
      {/* Stats Row */}
      <div className={styles.statsRow}>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.total}</div>
          <div className={styles.statLabel}>{t('admin.totalUsers')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.students}</div>
          <div className={styles.statLabel}>
            {t(uiText.getStudentLabel('mixed', 'plural'))}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.teachers}</div>
          <div className={styles.statLabel}>
            {t(uiText.getTeacherLabel('mixed', 'plural'))}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.pending}</div>
          <div className={styles.statLabel}>{t('admin.pendingApproval')}</div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('common.search')}
        />
      </div>

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.filterByRole')}:</span>
          <Select
            value={filters.role}
            onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value as FilterRole }))}
            options={roleOptions}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('admin.filterByStatus')}:</span>
          <Select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as FilterStatus }))}
            options={statusOptions}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('segment.label')}:</span>
          <Select
            value={filters.segment}
            onChange={(e) => setFilters(prev => ({ ...prev, segment: e.target.value as FilterSegment }))}
            options={segmentOptions}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('matching.filterLabel')}:</span>
          <Select
            value={filters.matching}
            onChange={(e) => setFilters(prev => ({ ...prev, matching: e.target.value as FilterMatching }))}
            options={matchingOptions}
          />
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{t('assignment.filterLabel')}:</span>
          <Select
            value={filters.assignment}
            onChange={(e) => setFilters(prev => ({ ...prev, assignment: e.target.value as FilterAssignment }))}
            options={assignmentOptions}
          />
        </div>
      </div>

      {/* Bulk action bar — admin only. supervisor_manager cannot delete
          users per spec, so the action bar is hidden for them entirely. */}
      {canDeleteUsers(viewerRole) && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
          <span className="text-sm text-foreground">
            {selectedIds.size} / {visibleUsers.length}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={deleteSelected}
            loading={bulkDeleting}
          >
            {t('admin.deleteSelected')}
          </Button>
        </div>
      )}

      {/* Users Table */}
      <PageSection title={t('admin.usersList')}>
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
          </div>
        ) : users.length === 0 ? (
          <div className={styles.emptyState}>
            {t('common.noData')}
          </div>
        ) : visibleUsers.length === 0 ? (
          <div className={styles.emptyState}>
            {t('admin.noSearchResults')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className={styles.table}>
              <thead className={styles.tableHead}>
                <tr>
                  {canDeleteUsers(viewerRole) && (
                    <th className={styles.tableHeadCell} style={{ width: '2.5rem' }}>
                      <input
                        type="checkbox"
                        aria-label={t('admin.selectAll')}
                        checked={
                          visibleUsers.length > 0 &&
                          visibleUsers.every((u) => selectedIds.has(u.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(visibleUsers.map((u) => u.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className={styles.tableHeadCell}>{t('admin.userName')}</th>
                  <th className={styles.tableHeadCell}>{t('registration.phone')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.role')}</th>
                  <th className={styles.tableHeadCell}>{t('segment.label')}</th>
                  <th className={styles.tableHeadCell}>{t('halaqah.halaqahName')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.status')}</th>
                  <th className={styles.tableHeadCell}>{t('matching.columnHeader')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {pagedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className={`${styles.tableRow} cursor-pointer`}
                    onClick={() => navigate(adminUserDetailPath(user.id))}
                  >
                    {canDeleteUsers(viewerRole) && (
                      <td
                        className={styles.tableCell}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          aria-label={t('admin.selectAll')}
                          checked={selectedIds.has(user.id)}
                          onChange={() => toggleSelected(user.id)}
                        />
                      </td>
                    )}
                    <td className={`${styles.tableCell} ${styles.tableCellName}`}>
                      {getDisplayName(user)}
                    </td>
                    <td
                      className={`${styles.tableCell} ${styles.tableCellMuted}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        // Tap-to-WhatsApp link when the number is dialable;
                        // otherwise plain text / '-'. stopPropagation
                        // keeps the click from triggering the row-level
                        // navigate-to-detail handler.
                        const link = buildWhatsAppLink(user.phone);
                        if (link) {
                          return (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline"
                            >
                              {user.phone}
                            </a>
                          );
                        }
                        return user.phone || '-';
                      })()}
                    </td>
                    <td className={styles.tableCell}>
                      <Badge variant={user.role === 'teacher' ? 'primary' : 'secondary'}>
                        <span className="flex items-center gap-1">
                          {user.role === 'teacher' ? (
                            <TeacherIcon className="w-3 h-3" />
                          ) : (
                            <UsersIcon className="w-3 h-3" />
                          )}
                          {t(segmentationRules.getUserRoleLabel(user))}
                        </span>
                      </Badge>
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>
                      {user.segment
                        ? t(`segment.${user.segment === 'non_arab_speakers' ? 'nonArabSpeakers' : user.segment}`)
                        : '-'}
                    </td>
                    <td
                      className={styles.tableCell}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Halaqah column. Renders one clickable link per
                          halaqah the user belongs to (student side) or
                          owns (teacher side). Empty for admins /
                          supervisor_managers who aren't in the map at
                          all. stopPropagation on the cell keeps the row-
                          level navigate-to-user-detail from firing when
                          the admin taps the link. */}
                      {(() => {
                        const list = halaqahsByUser.get(user.id) ?? [];
                        if (list.length === 0) {
                          return (
                            <span className={styles.tableCellMuted}>
                              {t('halaqah.notAssigned')}
                            </span>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-x-2 gap-y-1">
                            {list.map((h, idx) => (
                              <span key={h.id} className="whitespace-nowrap">
                                <Link
                                  to={halaqahDetailPath(h.id)}
                                  className="text-primary hover:underline"
                                >
                                  {h.name}
                                </Link>
                                {idx < list.length - 1 && (
                                  <span className={styles.tableCellMuted}>،</span>
                                )}
                              </span>
                            ))}
                          </div>
                        );
                      })()}
                    </td>
                    <td className={styles.tableCell}>
                      <StatusBadge status={user.status as 'active' | 'pending' | 'suspended'} />
                    </td>
                    <td
                      className={styles.tableCell}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {user.role === 'student' || user.role === 'teacher' ? (
                        <MatchingBadge
                          matches={matchesFor(user)}
                          subjectRole={user.role}
                          to={adminUserDetailPath}
                        />
                      ) : (
                        <span className={styles.tableCellMuted}>-</span>
                      )}
                    </td>
                    <td
                      className={styles.tableCell}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className={styles.actionsCell}>
                        {/* All three status-mutation buttons share the
                            same min-width + centered content so rows
                            with different statuses (Activate vs Suspend
                            vs Reactivate) align across the column —
                            otherwise the Arabic labels "تفعيل" / "تعليق"
                            / "إعادة تفعيل" produce three different
                            widths and the actions column wobbles. */}
                        {allowedToManageStatus && user.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => updateUserStatus(user.id, 'active')}
                            loading={actionLoading === user.id}
                            className="min-w-[7rem] justify-center"
                          >
                            <CheckIcon className="w-4 h-4" />
                            {t('admin.activate')}
                          </Button>
                        )}
                        {allowedToManageStatus && user.status === 'active' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserStatus(user.id, 'suspended')}
                            loading={actionLoading === user.id}
                            className="min-w-[7rem] justify-center"
                          >
                            {t('admin.suspend')}
                          </Button>
                        )}
                        {allowedToManageStatus && user.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => updateUserStatus(user.id, 'active')}
                            loading={actionLoading === user.id}
                            className="min-w-[7rem] justify-center"
                          >
                            {t('admin.reactivate')}
                          </Button>
                        )}

                        {/* Role-change dropdown. Visible only to viewers
                            who can assign at least one role. Options are
                            filtered to roles the viewer is allowed to
                            grant, so a supervisor_manager never sees
                            'admin' / 'supervisor_manager' in the menu. */}
                        {isAdminOrSupervisorManager(viewerRole) && (
                          <Select
                            aria-label={t('admin.changeRole')}
                            value={user.role}
                            onChange={(e) => {
                              const next = e.target.value as UserRole;
                              if (next !== user.role) {
                                void updateUserRole(user.id, next);
                              }
                            }}
                            options={[
                              { value: 'student', label: t('auth.student') },
                              { value: 'teacher', label: t('auth.teacher') },
                              ...(canAssignRole('admin')
                                ? [{ value: 'admin', label: t('auth.admin') }]
                                : []),
                              ...(canAssignRole('supervisor_manager')
                                ? [
                                    {
                                      value: 'supervisor_manager',
                                      label: t('auth.supervisorManager'),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </PageSection>
    </DashboardLayout>
  );
}

export default AdminUsers;
