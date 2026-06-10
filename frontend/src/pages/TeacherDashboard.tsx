/**
 * TeacherDashboard
 *
 * Lists EVERY halaqah owned by the signed-in teacher (one per declared
 * time slot, since `lib/autoHalaqah.createHalaqahsForTeacher` now
 * materializes one halaqah per slot at activation time). Each card
 * shows enough at-a-glance info — name, segment, student count, meet
 * link presence — and clicks through to the existing
 * `/halaqah/:id` details page where members, reports, supervisors,
 * and the meet link itself live.
 *
 * Why this page is a list-of-cards instead of an embedded student
 * table: with multiple halaqahs the in-page table can't show ALL the
 * teacher's students at once without conflating halaqahs. Drilling
 * into `HalaqahDetails` gives the teacher the full per-halaqah view
 * the existing page already renders for admins/supervisors.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useHalaqahs } from '../hooks/useHalaqah';
import { supabase } from '../lib/supabase/client';
import {
  DashboardLayout,
  PageSection,
} from '../components/templates/DashboardLayout';
import { Card } from '../components/molecules/Card';
import { Badge } from '../components/atoms/Badge';
import { Button } from '../components/atoms/Button';
import { UsersIcon, VideoIcon } from '../components/atoms/Icon';
import { useTranslation } from '../locales/i18n';
import { segmentationRules } from '../lib/segmentationRules';

export function TeacherDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { halaqahs, loading } = useHalaqahs({ teacherId: profile?.id });

  // Per-halaqah active member count. One projected query over every
  // halaqah the teacher owns — no N+1, no extra round-trip per card.
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [countsLoading, setCountsLoading] = useState(true);

  useEffect(() => {
    if (!halaqahs || halaqahs.length === 0) {
      setCounts(new Map());
      setCountsLoading(false);
      return;
    }
    let cancelled = false;
    const ids = halaqahs.map((h) => h.id);
    setCountsLoading(true);
    supabase
      .from('halaqah_members')
      .select('halaqah_id')
      .eq('status', 'active')
      .in('halaqah_id', ids)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // Soft-fail: cards still render with "0" counts; the
          // teacher can drill in to see the real list.
          console.warn('TeacherDashboard: member-count fetch failed', error);
          setCounts(new Map());
        } else {
          const m = new Map<string, number>();
          for (const row of (data ?? []) as Array<{ halaqah_id: string }>) {
            m.set(row.halaqah_id, (m.get(row.halaqah_id) ?? 0) + 1);
          }
          setCounts(m);
        }
        setCountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [halaqahs]);

  // Single "segment" across all halaqahs — feeds the page-level
  // gendered subtitle. When the teacher's halaqahs aren't all the
  // same segment (unusual but possible after manual edits) we fall
  // through to the neutral subtitle.
  const sharedSegment =
    halaqahs && halaqahs.length > 0
      ? halaqahs.every((h) => h.segment === halaqahs[0].segment)
        ? halaqahs[0].segment
        : null
      : null;
  const ui = segmentationRules.getGenderedUI({
    role: 'teacher',
    segment: sharedSegment,
  });
  const subtitleSuffix =
    ui.pronoun === 'male'
      ? 'Male'
      : ui.pronoun === 'female'
        ? 'Female'
        : 'Neutral';

  const isLoading = loading || countsLoading;

  return (
    <DashboardLayout
      title={t('dashboard.teacherBlessingFemale')}
      subtitle={t(`dashboard.teacherProgressSubtitle${subtitleSuffix}`)}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !halaqahs || halaqahs.length === 0 ? (
        <Card padding="lg">
          <p className="text-center text-muted py-8">
            {t('dashboard.noHalaqahAssigned')}
          </p>
        </Card>
      ) : (
        <PageSection
          title={`${t('dashboard.myHalaqahs')} (${halaqahs.length})`}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {halaqahs.map((halaqah) => {
              const count = counts.get(halaqah.id) ?? 0;
              const segmentKey =
                halaqah.segment === 'men'
                  ? 'segment.men'
                  : halaqah.segment === 'women'
                    ? 'segment.women'
                    : '';
              const hasLink = Boolean(halaqah.meet_link?.trim());
              return (
                <Link
                  key={halaqah.id}
                  to={`/halaqah/${halaqah.id}`}
                  className="block focus:outline-none focus:ring-2 focus:ring-primary/40 rounded-2xl"
                >
                  <Card
                    padding="md"
                    variant="bordered"
                    className="hover:shadow-md transition-shadow cursor-pointer h-full"
                  >
                    <div className="flex flex-col gap-3 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold text-foreground leading-snug">
                          {halaqah.name}
                        </h3>
                        {segmentKey && (
                          <Badge variant="secondary" size="sm">
                            {t(segmentKey)}
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
                        <span className="inline-flex items-center gap-1">
                          <UsersIcon className="w-4 h-4" />
                          {count} {t('halaqah.studentCount')}
                        </span>
                        {hasLink ? (
                          <span className="inline-flex items-center gap-1 text-success">
                            <VideoIcon className="w-4 h-4" />
                            {t('halaqah.meetLinkPresent')}
                          </span>
                        ) : (
                          <Badge variant="warning" size="sm">
                            {t('halaqah.meetLinkMissing')}
                          </Badge>
                        )}
                      </div>

                      <div className="mt-auto flex justify-end">
                        <Button size="sm" variant="outline">
                          {t('dashboard.viewHalaqahDetails')}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </PageSection>
      )}
    </DashboardLayout>
  );
}

export default TeacherDashboard;
