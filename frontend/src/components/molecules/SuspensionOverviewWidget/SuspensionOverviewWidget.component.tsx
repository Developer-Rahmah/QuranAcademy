/**
 * SuspensionOverviewWidget — quick suspension-policy overview for
 * the admin dashboard.
 *
 * Reads three counters via `api.audit.quickStats()` + one from
 * `api.audit.approachingSuspensionCount()`. Each is a HEAD query
 * (`count: 'exact'`) against an indexed column, so the total
 * network cost is four small round-trips regardless of academy
 * size.
 *
 * The widget is intentionally a molecule (not an organism): it
 * doesn't own any layout — the caller decides where it sits on
 * the dashboard. Navigation to the audit page is a prop so the
 * widget stays route-agnostic.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../Card';
import { useTranslation } from '../../../locales/i18n';
import { api } from '../../../lib/supabase';
import type { SuspensionOverviewWidgetProps } from './SuspensionOverviewWidget.types';

interface Counters {
  suspendedToday: number;
  automaticLast7: number;
  manualLast7: number;
  approaching: number | null;
  loading: boolean;
}

const INITIAL: Counters = {
  suspendedToday: 0,
  automaticLast7: 0,
  manualLast7: 0,
  approaching: null,
  loading: true,
};

export function SuspensionOverviewWidget({
  auditHref,
  approachingWithinDays,
  policyEnabled = true,
}: SuspensionOverviewWidgetProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<Counters>(INITIAL);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stats = await api.audit.quickStats();
      let approaching: number | null = null;
      if (policyEnabled && typeof approachingWithinDays === 'number') {
        const res = await api.audit.approachingSuspensionCount(approachingWithinDays);
        approaching = res.count;
      }
      if (cancelled) return;
      setState({
        suspendedToday: stats.suspendedToday,
        automaticLast7: stats.automaticSuspensionsLast7Days,
        manualLast7: stats.manualSuspensionsLast7Days,
        approaching,
        loading: false,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [policyEnabled, approachingWithinDays]);

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-4 gap-3">
        <h3 className="text-base font-semibold text-foreground">
          {t('suspensionWidget.title')}
        </h3>
        <Link
          to={auditHref}
          className="text-sm text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-primary/20 rounded"
        >
          {t('suspensionWidget.viewAudit')}
        </Link>
      </div>

      {state.loading ? (
        <div className="flex items-center justify-center py-6">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricTile
            label={t('suspensionWidget.suspendedToday')}
            value={state.suspendedToday}
            tone={state.suspendedToday > 0 ? 'warning' : 'muted'}
          />
          <MetricTile
            label={t('suspensionWidget.automaticLast7')}
            value={state.automaticLast7}
            tone={state.automaticLast7 > 0 ? 'warning' : 'muted'}
          />
          <MetricTile
            label={t('suspensionWidget.manualLast7')}
            value={state.manualLast7}
            tone="muted"
          />
          {state.approaching !== null && (
            <MetricTile
              label={t('suspensionWidget.approaching').replace(
                '{{n}}',
                String(approachingWithinDays ?? 0),
              )}
              value={state.approaching}
              tone={state.approaching > 0 ? 'warning' : 'muted'}
            />
          )}
        </div>
      )}
    </Card>
  );
}

interface MetricTileProps {
  label: string;
  value: number;
  tone: 'warning' | 'muted';
}

function MetricTile({ label, value, tone }: MetricTileProps) {
  return (
    <div className="rounded-lg border border-border p-3 bg-white">
      <div
        className={
          tone === 'warning'
            ? 'text-2xl font-bold text-warning'
            : 'text-2xl font-bold text-foreground'
        }
      >
        {value}
      </div>
      <div className="text-xs text-muted mt-1 leading-tight">{label}</div>
    </div>
  );
}

export default SuspensionOverviewWidget;
