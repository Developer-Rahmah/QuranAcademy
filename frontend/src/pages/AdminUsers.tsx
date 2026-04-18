/**
 * Admin Users Page - User management for administrators
 * Allows viewing, activating, and suspending user accounts
 */
import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/supabase';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Button } from '../components/atoms/Button';
import { Select } from '../components/atoms/Select';
import { StatusBadge, Badge } from '../components/atoms/Badge';
import { UsersIcon, TeacherIcon, CheckIcon } from '../components/atoms/Icon';
import { useToast } from '../context/ToastContext';
import { useTranslation } from '../locales/i18n';
import type { Profile, UserRole, AccountStatus } from '../types';

// ============================================
// Types
// ============================================
type FilterRole = UserRole | 'all';
type FilterStatus = AccountStatus | 'all';

interface UserFilters {
  role: FilterRole;
  status: FilterStatus;
}

// ============================================
// Styles
// ============================================
const styles = {
  filtersContainer: 'flex flex-wrap gap-4 mb-6',
  filterGroup: 'flex items-center gap-2',
  filterLabel: 'text-sm text-muted',
  table: 'w-full',
  tableHead: 'bg-muted/50',
  tableHeadCell: 'px-4 py-3 text-right text-sm font-medium text-foreground',
  tableBody: 'divide-y divide-border',
  tableRow: 'hover:bg-muted/30 transition-colors',
  tableCell: 'px-4 py-3 text-sm',
  tableCellName: 'font-medium text-foreground',
  tableCellMuted: 'text-muted',
  actionsCell: 'flex gap-2',
  emptyState: 'text-center py-12 text-muted',
  loadingState: 'flex items-center justify-center py-12',
  spinner: 'animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full',
  statsRow: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6',
  statCard: 'bg-card p-4 rounded-lg border border-border text-center',
  statValue: 'text-2xl font-bold text-foreground',
  statLabel: 'text-sm text-muted',
};

// ============================================
// Component
// ============================================
export function AdminUsers() {
  const { t } = useTranslation();
  const toast = useToast();

  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    role: 'all',
    status: 'all',
  });

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

      // Filter out admin users from the list
      const nonAdminUsers = (data || []).filter(u => u.role !== 'admin');
      setUsers(nonAdminUsers);
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
    { value: 'student', label: t('admin.students') },
    { value: 'teacher', label: t('admin.teachers') },
  ];

  const statusOptions = [
    { value: 'all', label: t('common.all') },
    { value: 'pending', label: t('status.pending') },
    { value: 'active', label: t('status.active') },
    { value: 'suspended', label: t('status.suspended') },
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
          <div className={styles.statLabel}>{t('admin.students')}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statValue}>{stats.teachers}</div>
          <div className={styles.statLabel}>{t('admin.teachers')}</div>
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
      </div>

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
                  <th className={styles.tableHeadCell}>{t('admin.userName')}</th>
                  <th className={styles.tableHeadCell}>{t('auth.email')}</th>
                  <th className={styles.tableHeadCell}>{t('registration.phone')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.role')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.status')}</th>
                  <th className={styles.tableHeadCell}>{t('admin.actions')}</th>
                </tr>
              </thead>
              <tbody className={styles.tableBody}>
                {users.map((user) => (
                  <tr key={user.id} className={styles.tableRow}>
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
                        {user.role === 'teacher' ? (
                          <span className="flex items-center gap-1">
                            <TeacherIcon className="w-3 h-3" />
                            {t('auth.teacher')}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <UsersIcon className="w-3 h-3" />
                            {t('auth.student')}
                          </span>
                        )}
                      </Badge>
                    </td>
                    <td className={styles.tableCell}>
                      <StatusBadge status={user.status as 'active' | 'pending' | 'suspended'} />
                    </td>
                    <td className={styles.tableCell}>
                      <div className={styles.actionsCell}>
                        {user.status === 'pending' && (
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
                        {user.status === 'active' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateUserStatus(user.id, 'suspended')}
                            loading={actionLoading === user.id}
                          >
                            {t('admin.suspend')}
                          </Button>
                        )}
                        {user.status === 'suspended' && (
                          <Button
                            size="sm"
                            variant="success"
                            onClick={() => updateUserStatus(user.id, 'active')}
                            loading={actionLoading === user.id}
                          >
                            {t('admin.reactivate')}
                          </Button>
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
