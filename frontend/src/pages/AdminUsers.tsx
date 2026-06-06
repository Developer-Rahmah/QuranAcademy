/**
 * Admin Users Page - User management for administrators
 * Allows viewing, activating, and suspending user accounts
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/supabase';
import { supabase } from '../lib/supabase/client';
import { adminUserDetailPath } from '../lib/routes';
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
import { buildMatchIndex } from '../lib/matching';
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
  // Both are derived from a single SELECT per source table on load.
  // No N+1, no per-row queries.
  const [assignedStudentIds, setAssignedStudentIds] = useState<Set<string>>(new Set());
  const [teachersWithHalaqah, setTeachersWithHalaqah] = useState<Set<string>>(new Set());
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
  // Fetch Users
  // ============================================
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const filterParams: { role?: string; status?: string } = {};
      if (filters.role !== 'all') {
        filterParams.role = filters.role;
      }
      if (filters.status !== 'all') {
        filterParams.status = filters.status;
      }

      // Fetch the filtered list (drives the table) AND both full active
      // pools (drive the matching badges) AND the two assignment
      // indexes (drive the new "Assignment" filter). All parallel —
      // no N+1, no per-row queries.
      //
      // halaqah_members: minimal projection (student_id only) since we
      // only need the Set of assigned ids. Filtered to active
      // memberships so a soft-suspended membership doesn't count.
      //
      // halaqahs: full list via the existing facade; we extract
      // teacher_ids client-side. Any status counts — a paused halaqah
      // still means the teacher is engaged, which is the triage signal
      // an admin cares about ("who has nothing to do?").
      const [usersRes, studentsRes, teachersRes, membershipsRes, halaqahsRes] =
        await Promise.all([
          db.profiles.getAll(filterParams),
          db.profiles.getAll({ role: 'student', status: 'active' }),
          db.profiles.getAll({ role: 'teacher', status: 'active' }),
          supabase
            .from('halaqah_members')
            .select('student_id')
            .eq('status', 'active'),
          db.halaqahs.getAll({}),
        ]);

      if (usersRes.error) {
        console.error('Error fetching users:', usersRes.error);
        toast.error(t('errors.generic'));
        return;
      }

      // Filter out admin users from the list, then apply the segment filter
      // client-side (kept here rather than pushed into the db facade to avoid
      // re-touching the Supabase layer for this small addition).
      const nonAdminUsers = (usersRes.data || []).filter((u) => u.role !== 'admin');
      const afterSegment = filters.segment === 'all'
        ? nonAdminUsers
        : nonAdminUsers.filter((u) => u.segment === filters.segment);
      setUsers(afterSegment);

      // Pool fetches are best-effort. A failure leaves the badge counts
      // empty rather than blocking the whole users table — the admin
      // can still manage statuses / roles.
      setStudentsPool(studentsRes.data ?? []);
      setTeachersPool(teachersRes.data ?? []);

      // Derive the two assignment indexes. Each is a Set for O(1)
      // membership tests during the per-row filter pass below.
      //
      // halaqah_members rows where `student_id` is unexpectedly null
      // (data corruption) are filtered out — Set never accepts a falsy
      // id silently. Same for halaqahs without a teacher (unassigned
      // halaqah is its own thing; doesn't make any teacher "engaged").
      const memberRows = (membershipsRes.data ?? []) as Array<{ student_id: string | null }>;
      setAssignedStudentIds(
        new Set(memberRows.map((m) => m.student_id).filter((id): id is string => !!id)),
      );

      const halaqahsList = halaqahsRes.data ?? [];
      setTeachersWithHalaqah(
        new Set(
          halaqahsList
            .map((h) => h.teacher_id)
            .filter((id): id is string => !!id),
        ),
      );
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error(t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [filters, toast, t]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

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

  // Full three-part name + email, used ONLY by the search filter so the
  // admin can still find a user by middle/family name or email even
  // though those columns are no longer rendered in the table.
  const getSearchHaystack = (user: Profile): string =>
    [user.first_name, user.second_name, user.third_name, user.email]
      .filter(Boolean)
      .join(' ');

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

  // Apply the free-text search + matching filter on top of the
  // role/status/segment filters already baked into `users`. Stats above
  // stay against the filter-only list so the summary cards reflect
  // "matches in this filter selection", not "matches in this query".
  const visibleUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (q) {
        // Search across the full three-part name + email + phone, not the
        // shortened display name — so admins can still find someone by
        // their middle/family name or email even though those columns
        // are no longer rendered.
        const haystack = getSearchHaystack(u).toLowerCase();
        const phone = (u.phone || '').toLowerCase();
        if (!(haystack.includes(q) || phone.includes(q))) {
          return false;
        }
      }
      if (filters.matching !== 'all') {
        const hasMatches = matchesFor(u).length > 0;
        if (filters.matching === 'has' && !hasMatches) return false;
        if (filters.matching === 'none' && hasMatches) return false;
      }
      if (filters.assignment !== 'all') {
        // Role-aware test: a student is "assigned" iff they appear in an
        // active membership; a teacher is "assigned" iff they own any
        // halaqah. The filter is silently a no-op for other roles —
        // assignment isn't meaningful for an admin or a supervisor, so
        // a non-student-non-teacher row passes through regardless.
        let isAssigned: boolean | null = null;
        if (u.role === 'student') isAssigned = assignedStudentIds.has(u.id);
        else if (u.role === 'teacher') isAssigned = teachersWithHalaqah.has(u.id);
        if (isAssigned !== null) {
          if (filters.assignment === 'assigned' && !isAssigned) return false;
          if (filters.assignment === 'unassigned' && isAssigned) return false;
        }
      }
      return true;
    });
  }, [
    users,
    searchQuery,
    filters.matching,
    filters.assignment,
    matchesFor,
    assignedStudentIds,
    teachersWithHalaqah,
  ]);

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
                  <th className={styles.tableHeadCell}>{t('admin.status')}</th>
                  <th className={styles.tableHeadCell}>{t('matching.columnHeader')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {visibleUsers.map((user) => (
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
          </div>
        )}
      </PageSection>
    </DashboardLayout>
  );
}

export default AdminUsers;
