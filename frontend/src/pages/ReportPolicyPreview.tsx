/**
 * ReportPolicyPreview — /admin/report-policy-preview
 *
 * Read-only preview: which students WOULD be automatically
 * suspended today under the CURRENT report policy? Nothing on this
 * page ever calls a mutation — the only DB touch is a SELECT from
 * `report_policy_evaluation` via `api.audit.previewSuspensions`.
 *
 * Access: admin + supervisor_manager only (route-guarded in App.tsx).
 * The view itself is SECURITY INVOKER so RLS on `profiles`,
 * `halaqahs`, `reports` still narrows rows for non-privileged
 * callers — this route just adds another layer.
 *
 * Two modes:
 *   • "will suspend today" (default) — only rows the scheduler
 *     would actually flip if run right now.
 *   • "all classifications" — full evaluation set, filterable by
 *     `reason`, useful for debugging why a specific student isn't
 *     appearing in the "will suspend" list.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card } from '../components/molecules/Card';
import { Select } from '../components/atoms/Select';
import { Badge } from '../components/atoms/Badge';
import { Pagination } from '../components/molecules/Pagination';
import { useTranslation } from '../locales/i18n';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/supabase';
import {
  POLICY_EVALUATION_REASONS,
  type PolicyEvaluationReason,
  type PolicyEvaluationRow,
} from '../lib/supabase/api/audit';
import { adminUserDetailPath, halaqahDetailPath } from '../lib/routes';

const PAGE_SIZE = 20;
const ALL = 'all' as const;

const reasonKey = (r: PolicyEvaluationReason): string =>
  `reportPolicyPreview.reason.${r}`;

export function ReportPolicyPreview() {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [onlyWillSuspend, setOnlyWillSuspend] = useState<boolean>(true);
  const [reason, setReason] = useState<PolicyEvaluationReason | typeof ALL>(ALL);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<PolicyEvaluationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Reset paging when filters change.
  useEffect(() => {
    setPage(0);
  }, [onlyWillSuspend, reason]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.audit.previewSuspensions({
        page,
        pageSize: PAGE_SIZE,
        onlyWillSuspend,
        reason: reason === ALL ? undefined : reason,
      });
      if (res.error) {
        console.error('preview fetch error', res.error);
        toast.error(t('errors.generic'));
        return;
      }
      setRows(res.rows);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  }, [page, onlyWillSuspend, reason, toast, t]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reasonOptions = useMemo(
    () => [
      { value: ALL, label: t('common.all') },
      ...POLICY_EVALUATION_REASONS.map((r) => ({
        value: r,
        label: t(reasonKey(r)),
      })),
    ],
    [t],
  );

  const modeOptions = useMemo(
    () => [
      {
        value: 'onlySuspend',
        label: t('reportPolicyPreview.modeOnlySuspend'),
      },
      {
        value: 'all',
        label: t('reportPolicyPreview.modeAll'),
      },
    ],
    [t],
  );

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      return new Intl.DateTimeFormat(language === 'ar' ? 'ar' : 'en', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  };

  return (
    <DashboardLayout
      title={t('reportPolicyPreview.title')}
      subtitle={t('reportPolicyPreview.subtitle')}
    >
      {/* Explicit read-only badge so the operator sees at a glance
          that nothing on this page mutates data. */}
      <div className="mb-4">
        <Badge variant="secondary">
          {t('reportPolicyPreview.readOnlyBadge')}
        </Badge>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-muted">
            {t('reportPolicyPreview.mode')}
          </label>
          <Select
            value={onlyWillSuspend ? 'onlySuspend' : 'all'}
            onChange={(e) =>
              setOnlyWillSuspend(e.target.value === 'onlySuspend')
            }
            options={modeOptions}
          />
        </div>
        {!onlyWillSuspend && (
          <div className="flex flex-col gap-1">
            <label className="text-sm text-muted">
              {t('reportPolicyPreview.reasonFilter')}
            </label>
            <Select
              value={reason}
              onChange={(e) =>
                setReason(e.target.value as PolicyEvaluationReason | typeof ALL)
              }
              options={reasonOptions}
            />
          </div>
        )}
      </div>

      <PageSection
        title={
          onlyWillSuspend
            ? t('reportPolicyPreview.wouldSuspendCount').replace(
                '{{n}}',
                String(total),
              )
            : t('reportPolicyPreview.allCount').replace(
                '{{n}}',
                String(total),
              )
        }
      >
        <Card padding="none">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-center text-muted py-8">
              {onlyWillSuspend
                ? t('reportPolicyPreview.emptyWouldSuspend')
                : t('common.noData')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.student')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.halaqah')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.teacher')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.lastReport')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.referenceDate')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.daysSince')}
                    </th>
                    <th className="px-4 py-3 text-start text-sm font-medium text-foreground">
                      {t('reportPolicyPreview.columns.reason')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr
                      key={row.student_id}
                      className="hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-foreground">
                        <Link
                          to={adminUserDetailPath(row.student_id)}
                          className="text-primary hover:underline"
                        >
                          {row.student_name || row.student_email}
                        </Link>
                        {row.student_name && row.student_email && (
                          <div className="text-xs text-muted">
                            {row.student_email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.halaqah_id ? (
                          <Link
                            to={halaqahDetailPath(row.halaqah_id)}
                            className="text-primary hover:underline"
                          >
                            {row.halaqah_name || row.halaqah_id}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.teacher_name || <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {fmtDate(row.last_report_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {fmtDate(row.reference_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {row.days_since_reference !== null
                          ? row.days_since_reference
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            row.will_suspend
                              ? 'warning'
                              : row.reason === 'ALREADY_SUSPENDED'
                                ? 'destructive'
                                : 'muted'
                          }
                          size="sm"
                        >
                          {t(reasonKey(row.reason))}
                        </Badge>
                      </td>
                    </tr>
                  ))}
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

export default ReportPolicyPreview;
