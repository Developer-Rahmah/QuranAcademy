/**
 * AdminAudit — /admin/audit
 *
 * Read-only browser for the `status_change_audit` table. Every
 * activation / deactivation across the academy lands here — manual
 * actions from AdminUsers / HalaqahDetails / SupervisorDashboard,
 * plus the automatic suspension scheduler (0021).
 *
 * Access: admin + supervisor_manager only (route-guarded in App.tsx,
 * and the audit table's RLS policy is the ultimate authority).
 *
 * Server-side pagination + filters (date range, source, reason,
 * new status, student name search). Sort is created_at DESC — the
 * activity log is chronological by convention.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DashboardLayout,
  PageSection,
} from '../components/templates/DashboardLayout';
import { Card } from '../components/molecules/Card';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import { StatusBadge } from '../components/atoms/Badge';
import { Pagination } from '../components/molecules/Pagination';
import { useTranslation } from '../locales/i18n';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/supabase';
import { adminUserDetailPath } from '../lib/routes';
import { AUDIT_SOURCES, AUDIT_REASONS, auditSourceKey, auditReasonKey } from '../lib/audit/constants';
import type { AuditSource, AuditReason } from '../lib/audit/constants';
import type { StatusChangeAudit, AuditProfileSlice } from '../lib/supabase/api/audit';
import type { AccountStatus } from '../types';

const PAGE_SIZE = 20;
const ALL = 'all' as const;

interface Filters {
  from: string;
  to: string;
  source: AuditSource | typeof ALL;
  reason: AuditReason | typeof ALL;
  newStatus: AccountStatus | typeof ALL;
  studentQuery: string;
}

const EMPTY_FILTERS: Filters = {
  from: '',
  to: '',
  source: ALL,
  reason: ALL,
  newStatus: ALL,
  studentQuery: '',
};

function displayName(p: AuditProfileSlice | null | undefined): string {
  if (!p) return '';
  const parts = [p.first_name, p.second_name, p.third_name].filter(Boolean);
  return parts.join(' ') || p.email || '';
}

export function AdminAudit() {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [rows, setRows] = useState<StatusChangeAudit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  // Reset to page 0 whenever any filter changes — narrowing the
  // dataset should never strand the user on an empty page index.
  useEffect(() => {
    setPage(0);
  }, [
    filters.from,
    filters.to,
    filters.source,
    filters.reason,
    filters.newStatus,
    filters.studentQuery,
  ]);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, total, error } = await api.audit.list({
        page,
        pageSize: PAGE_SIZE,
        from: filters.from || undefined,
        to: filters.to || undefined,
        source: filters.source === ALL ? undefined : filters.source,
        reason: filters.reason === ALL ? undefined : filters.reason,
        newStatus: filters.newStatus === ALL ? undefined : filters.newStatus,
        studentQuery: filters.studentQuery || undefined,
      });
      if (error) {
        console.error('audit list error', error);
        toast.error(t('errors.generic'));
        return;
      }
      setRows(rows);
      setTotal(total);
    } finally {
      setLoading(false);
    }
  }, [page, filters, toast, t]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sourceOptions = useMemo(
    () => [
      { value: ALL, label: t('common.all') },
      ...AUDIT_SOURCES.map((s) => ({ value: s, label: t(auditSourceKey(s)) })),
    ],
    [t],
  );

  const reasonOptions = useMemo(
    () => [
      { value: ALL, label: t('common.all') },
      ...AUDIT_REASONS.map((r) => ({ value: r, label: t(auditReasonKey(r)) })),
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: ALL, label: t('common.all') },
      { value: 'pending', label: t('status.pending') },
      { value: 'active', label: t('status.active') },
      { value: 'suspended', label: t('status.suspended') },
    ],
    [t],
  );

  // Locale-aware timestamp — kept inline so the audit page doesn't
  // depend on a heavyweight date library. Falls back to ISO on any
  // Intl error.
  const fmtDate = (iso: string): string => {
    try {
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <DashboardLayout
      title={t('adminAudit.title')}
      subtitle={t('adminAudit.subtitle')}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.from')}</label>
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.to')}</label>
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.student')}</label>
          <Input
            type="text"
            placeholder={t('common.search')}
            value={filters.studentQuery}
            onChange={(e) => setFilters((f) => ({ ...f, studentQuery: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.source')}</label>
          <Select
            value={filters.source}
            onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value as Filters['source'] }))}
            options={sourceOptions}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.reason')}</label>
          <Select
            value={filters.reason}
            onChange={(e) => setFilters((f) => ({ ...f, reason: e.target.value as Filters['reason'] }))}
            options={reasonOptions}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">{t('adminAudit.filters.newStatus')}</label>
          <Select
            value={filters.newStatus}
            onChange={(e) => setFilters((f) => ({ ...f, newStatus: e.target.value as Filters['newStatus'] }))}
            options={statusOptions}
          />
        </div>
      </div>

      <PageSection title={t('adminAudit.entries')}>
        <Card padding="none">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted py-8">
              {t('common.noData')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.at')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.student')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.transition')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.source')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.reason')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('adminAudit.columns.changedBy')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const studentName = displayName(row.student);
                    const actorName = row.changed_by_profile
                      ? displayName(row.changed_by_profile)
                      : row.source === 'automatic_scheduler'
                        ? t('adminAudit.actorScheduler')
                        : t('adminAudit.actorUnknown');
                    return (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-muted whitespace-nowrap">
                          {fmtDate(row.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {row.student ? (
                            <Link
                              to={adminUserDetailPath(row.student.id)}
                              className="text-primary hover:underline"
                            >
                              {studentName || row.student_id}
                            </Link>
                          ) : (
                            <span className="text-muted">{row.student_id}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="inline-flex items-center gap-2">
                            <StatusBadge status={row.previous_status as 'active' | 'pending' | 'suspended'} />
                            <span aria-hidden="true" className="text-muted">→</span>
                            <StatusBadge status={row.new_status as 'active' | 'pending' | 'suspended'} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {t(auditSourceKey(row.source))}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          {t(auditReasonKey(row.reason))}
                        </td>
                        <td className="px-4 py-3 text-sm text-foreground">
                          <div className="flex flex-col">
                            <span>{actorName}</span>
                            {row.changed_by_role && (
                              <span className="text-xs text-muted">{row.changed_by_role}</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
              />
            </div>
          )}
        </Card>
      </PageSection>
    </DashboardLayout>
  );
}

export default AdminAudit;
