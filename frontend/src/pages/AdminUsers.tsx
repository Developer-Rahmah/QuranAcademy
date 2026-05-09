/**
 * Admin Users Page - User management for administrators
 * Allows viewing, activating, and suspending user accounts
 */
import { useState, useEffect, useCallback } from 'react';
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
import { Select } from '../components/atoms/Select';
import { StatusBadge, Badge } from '../components/atoms/Badge';
import { UsersIcon, TeacherIcon, CheckIcon } from '../components/atoms/Icon';
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

interface UserFilters {
  role: FilterRole;
  status: FilterStatus;
  segment: FilterSegment;
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
  const { profile: currentUser } = useAuth();
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
  });

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

      const { data, error } = await db.profiles.getAll(filterParams);

      if (error) {
        console.error('Error fetching users:', error);
        toast.error(t('errors.generic'));
        return;
      }

      // Filter out admin users from the list, then apply the segment filter
      // client-side (kept here rather than pushed into the db facade to avoid
      // re-touching the Supabase layer for this small addition).
      const nonAdminUsers = (data || []).filter((u) => u.role !== 'admin');
      const afterSegment = filters.segment === 'all'
        ? nonAdminUsers
        : nonAdminUsers.filter((u) => u.segment === filters.segment);
      setUsers(afterSegment);
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
  const getDisplayName = (user: Profile): string => {
    const parts = [user.first_name, user.second_name, user.third_name].filter(Boolean);
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
      </div>

      {/* Bulk action bar — admin only. supervisor_manager cannot delete
          users per spec, so the action bar is hidden for them entirely. */}
      {canDeleteUsers(viewerRole) && selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 mb-4 px-4 py-3 rounded-lg bg-secondary/50 border border-border">
          <span className="text-sm text-foreground">
            {selectedIds.size} / {users.length}
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
                          users.length > 0 &&
                          users.every((u) => selectedIds.has(u.id))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIds(new Set(users.map((u) => u.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                      />
                    </th>
                  )}
                  <th className={styles.tableHeadCell}>{t('admin.userName')}</th>
                  <th className={styles.tableHeadCell}>{t('auth.email')}</th>
                  <th className={styles.tableHeadCell}>{t('registration.phone')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.role')}</th>
                  <th className={styles.tableHeadCell}>{t('segment.label')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.status')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {users.map((user) => (
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
                    <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>
                      {user.email}
                    </td>
                    <td className={`${styles.tableCell} ${styles.tableCellMuted}`}>
                      {user.phone || '-'}
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
                      <div className={styles.actionsCell}>
                        {allowedToManageStatus && user.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => updateUserStatus(user.id, 'active')}
                            loading={actionLoading === user.id}
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
