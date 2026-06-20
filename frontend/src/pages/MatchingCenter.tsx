/**
 * MatchingCenter — the academy-wide assignment cockpit.
 *
 * Composes the diagnostic helpers in `lib/autoHalaqah` (no new
 * business rules):
 *   - loadMatchingState()      : single batched snapshot (4 queries).
 *   - computeMatchingStats()   : pure stats over the snapshot.
 *   - analyzeStudent()         : per-student "would-assign | reason".
 *   - buildSweepPreview()      : dry-run of the next sweep.
 *   - commitSweepPlacements()  : write the previewed placements.
 *
 * Performance shape:
 *   - One mount-time fetch. Refresh button re-runs it on demand.
 *   - All derived data (stats, sections, blocked rows, preview) is
 *     memoized off the snapshot, so re-renders don't re-walk the
 *     student list.
 *   - Per-student analysis runs once for the histogram + once per
 *     blocked row render via the memoized cache.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DashboardLayout,
  PageSection,
} from '../components/templates/DashboardLayout';
import { Card, CardContent } from '../components/molecules/Card';
import { StatCard, StatCardRow } from '../components/molecules/StatCard';
import { Button } from '../components/atoms/Button';
import { Badge } from '../components/atoms/Badge';
import { Modal } from '../components/atoms/Modal';
import { useTranslation } from '../locales/i18n';
import { useToast } from '../context/ToastContext';
import { adminUserDetailPath } from '../lib/routes';
import { getDisplayName } from '../lib/utils';
import {
  HALAQAH_TARGET_SIZE,
  analyzeStudent,
  buildSweepPreview,
  commitSweepPlacements,
  computeMatchingStats,
  loadMatchingState,
  unassignmentReasonKey,
  type MatchingState,
  type StudentAnalysis,
  type SweepPreview,
} from '../lib/autoHalaqah';
import type { Halaqah, Profile } from '../types';

const SECTION_LIMIT = 25;

export function MatchingCenter() {
  const { t } = useTranslation();
  const toast = useToast();

  const [state, setState] = useState<MatchingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<SweepPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [committing, setCommitting] = useState(false);

  // ---------------- Data load -----------------------------------------
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadMatchingState();
      setState(next);
    } catch (err) {
      console.error('MatchingCenter: load failed', err);
      toast.error(t('matching.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [toast, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---------------- Derived (memoized) --------------------------------

  // Stats: O(n) once per snapshot. The histogram inside
  // computeMatchingStats also walks analyzeStudent for unassigned
  // students; we accept that cost rather than caching twice.
  const stats = useMemo(
    () => (state ? computeMatchingStats(state) : null),
    [state],
  );

  // Per-student analyses — cached as a Map so the blocked-students
  // section can render reasons without re-walking the matcher.
  const analysesByStudent = useMemo<Map<string, StudentAnalysis>>(() => {
    const map = new Map<string, StudentAnalysis>();
    if (!state) return map;
    for (const s of state.students) {
      if (state.assignedStudentIds.has(s.id)) continue;
      map.set(s.id, analyzeStudent(s, state));
    }
    return map;
  }, [state]);

  // Section: unassigned students (any reason).
  const unassignedStudents = useMemo<Profile[]>(() => {
    if (!state) return [];
    return state.students.filter(
      (s) => !state.assignedStudentIds.has(s.id),
    );
  }, [state]);

  // Section: blocked students = unassigned WITH a concrete reason
  // (i.e. not "would_assign"). Useful to surface action items.
  const blockedStudents = useMemo(() => {
    return unassignedStudents
      .map((s) => ({ student: s, analysis: analysesByStudent.get(s.id) }))
      .filter((row) => row.analysis && row.analysis.proposedHalaqah === null);
  }, [unassignedStudents, analysesByStudent]);

  // Section: teachers with zero active members.
  const teachersWithoutStudents = useMemo<Profile[]>(() => {
    if (!state) return [];
    const teachersWithMembers = new Set<string>();
    for (const h of state.halaqahsActive) {
      if (h.teacher_id && (state.memberCounts.get(h.id) ?? 0) > 0) {
        teachersWithMembers.add(h.teacher_id);
      }
    }
    const result: Profile[] = [];
    for (const t of state.teachersById.values()) {
      if (t.status !== 'active') continue;
      if (!teachersWithMembers.has(t.id)) result.push(t);
    }
    return result;
  }, [state]);

  // Section: halaqahs with capacity (under target).
  const halaqahsWithCapacity = useMemo<Halaqah[]>(() => {
    if (!state) return [];
    return state.halaqahsActive
      .filter((h) => (state.memberCounts.get(h.id) ?? 0) < HALAQAH_TARGET_SIZE)
      .sort(
        (a, b) =>
          (state.memberCounts.get(a.id) ?? 0) -
          (state.memberCounts.get(b.id) ?? 0),
      );
  }, [state]);

  // Section: full halaqahs (at or over target).
  const fullHalaqahs = useMemo<Halaqah[]>(() => {
    if (!state) return [];
    return state.halaqahsActive
      .filter((h) => (state.memberCounts.get(h.id) ?? 0) >= HALAQAH_TARGET_SIZE)
      .sort(
        (a, b) =>
          (state.memberCounts.get(b.id) ?? 0) -
          (state.memberCounts.get(a.id) ?? 0),
      );
  }, [state]);

  // ---------------- Preview + commit ----------------------------------

  const handleOpenPreview = useCallback(() => {
    if (!state) return;
    setPreviewLoading(true);
    try {
      setPreview(buildSweepPreview(state));
    } finally {
      setPreviewLoading(false);
    }
  }, [state]);

  const handleCommit = useCallback(async () => {
    if (!preview) return;
    setCommitting(true);
    try {
      const { ok, failed } = await commitSweepPlacements(preview.placements);
      toast.success(
        t('matching.commitSuccess')
          .replace('{{ok}}', String(ok))
          .replace('{{failed}}', String(failed)),
      );
      setPreview(null);
      await refresh();
    } catch (err) {
      console.error('MatchingCenter: commit failed', err);
      toast.error(t('matching.commitFailed'));
    } finally {
      setCommitting(false);
    }
  }, [preview, refresh, toast, t]);

  // ---------------- Render --------------------------------------------

  return (
    <DashboardLayout
      title={t('matching.centerTitle')}
      subtitle={t('matching.centerSubtitle')}
    >
      {loading || !state || !stats ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              loading={loading}
            >
              {t('matching.refresh')}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenPreview}
              loading={previewLoading}
            >
              {t('matching.runPreview')}
            </Button>
          </div>

          {/* Stats */}
          <StatCardRow>
            <StatCard
              title={t('matching.stats.assignedStudents')}
              value={stats.assignedStudents}
            />
            <StatCard
              title={t('matching.stats.unassignedStudents')}
              value={stats.unassignedStudents}
            />
            <StatCard
              title={t('matching.stats.teachersWithoutStudents')}
              value={stats.teachersWithoutStudents}
            />
            <StatCard
              title={t('matching.stats.halaqahsWithCapacity')}
              value={stats.halaqahsWithCapacity}
            />
          </StatCardRow>
          <StatCardRow>
            <StatCard
              title={t('matching.stats.halaqahsMissingSlot')}
              value={stats.halaqahsMissingSlot}
            />
            <StatCard
              title={t('matching.stats.blockedNoHalaqah')}
              value={stats.blockedNoHalaqah}
            />
            <StatCard
              title={t('matching.stats.blockedAllFull')}
              value={stats.blockedAllFull}
            />
          </StatCardRow>

          {/* Sections */}
          <PageSection title={t('matching.section.unassignedStudents')}>
            <SectionList
              empty={t('matching.empty.unassignedStudents')}
              rows={unassignedStudents.slice(0, SECTION_LIMIT)}
              renderRow={(s) => (
                <PersonRow
                  key={s.id}
                  name={getDisplayName(s)}
                  href={adminUserDetailPath(s.id)}
                  ctaLabel={t('matching.openProfile')}
                />
              )}
              total={unassignedStudents.length}
            />
          </PageSection>

          <PageSection title={t('matching.section.blockedStudents')}>
            <SectionList
              empty={t('matching.empty.blockedStudents')}
              rows={blockedStudents.slice(0, SECTION_LIMIT)}
              renderRow={({ student, analysis }) =>
                analysis ? (
                  <BlockedRow
                    key={student.id}
                    student={student}
                    analysis={analysis}
                    t={t}
                  />
                ) : null
              }
              total={blockedStudents.length}
            />
          </PageSection>

          <PageSection title={t('matching.section.teachersWithoutStudents')}>
            <SectionList
              empty={t('matching.empty.teachersWithoutStudents')}
              rows={teachersWithoutStudents.slice(0, SECTION_LIMIT)}
              renderRow={(teacher) => (
                <PersonRow
                  key={teacher.id}
                  name={getDisplayName(teacher)}
                  href={adminUserDetailPath(teacher.id)}
                  ctaLabel={t('matching.openProfile')}
                />
              )}
              total={teachersWithoutStudents.length}
            />
          </PageSection>

          <PageSection title={t('matching.section.halaqahsWithCapacity')}>
            <SectionList
              empty={t('matching.empty.halaqahsWithCapacity')}
              rows={halaqahsWithCapacity.slice(0, SECTION_LIMIT)}
              renderRow={(h) => (
                <HalaqahRow
                  key={h.id}
                  halaqah={h}
                  count={state.memberCounts.get(h.id) ?? 0}
                  t={t}
                />
              )}
              total={halaqahsWithCapacity.length}
            />
          </PageSection>

          <PageSection title={t('matching.section.fullHalaqahs')}>
            <SectionList
              empty={t('matching.empty.fullHalaqahs')}
              rows={fullHalaqahs.slice(0, SECTION_LIMIT)}
              renderRow={(h) => (
                <HalaqahRow
                  key={h.id}
                  halaqah={h}
                  count={state.memberCounts.get(h.id) ?? 0}
                  t={t}
                />
              )}
              total={fullHalaqahs.length}
            />
          </PageSection>
        </div>
      )}

      {/* Preview modal — dry-run of what the next sweep would do.
          Confirm runs `commitSweepPlacements` which writes one
          membership row per proposed placement. */}
      <Modal
        isOpen={preview !== null}
        onClose={() => !committing && setPreview(null)}
        title={t('matching.previewTitle')}
        size="lg"
      >
        {preview && (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {t('matching.previewSubtitle')
                .replace('{{placements}}', String(preview.placements.length))
                .replace('{{blocked}}', String(preview.blocked.length))}
            </p>

            {preview.placements.length === 0 ? (
              <p className="text-sm text-muted">{t('matching.noPlacements')}</p>
            ) : (
              <Card padding="none">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border max-h-[40vh] overflow-y-auto">
                    {preview.placements.map(({ student, halaqah }) => (
                      <li
                        key={student.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground truncate">
                          {getDisplayName(student)}
                        </span>
                        <span className="text-muted text-xs truncate text-end">
                          → {halaqah.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {preview.blocked.length > 0 && (
              <Card padding="none">
                <CardContent className="p-0">
                  <ul className="divide-y divide-border max-h-[40vh] overflow-y-auto">
                    {preview.blocked.map(({ student, reason }) => (
                      <li
                        key={student.id}
                        className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground truncate">
                          {getDisplayName(student)}
                        </span>
                        <Badge variant="warning" size="sm">
                          {t(unassignmentReasonKey(reason))}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreview(null)}
                disabled={committing}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleCommit}
                loading={committing}
                disabled={preview.placements.length === 0}
              >
                {t('matching.commit')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </DashboardLayout>
  );
}

// ====================================================================
// Local presentation helpers
// ====================================================================

interface SectionListProps<T> {
  rows: T[];
  total: number;
  empty: string;
  renderRow: (row: T) => React.ReactNode;
}

function SectionList<T>({ rows, total, empty, renderRow }: SectionListProps<T>) {
  if (total === 0) {
    return (
      <Card padding="md">
        <p className="text-sm text-muted text-center">{empty}</p>
      </Card>
    );
  }
  return (
    <Card padding="none">
      <CardContent className="p-0">
        <ul className="divide-y divide-border">
          {rows.map((row) => renderRow(row))}
        </ul>
        {total > rows.length && (
          <div className="px-3 py-2 text-xs text-muted text-center border-t border-border">
            …{total - rows.length} more
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PersonRow({
  name,
  href,
  ctaLabel,
}: {
  name: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="text-sm font-medium text-foreground truncate">
        {name}
      </span>
      <Link to={href}>
        <Button size="sm" variant="outline">
          {ctaLabel}
        </Button>
      </Link>
    </li>
  );
}

function HalaqahRow({
  halaqah,
  count,
  t,
}: {
  halaqah: Halaqah;
  count: number;
  t: (k: string) => string;
}) {
  return (
    <li className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">
          {halaqah.name}
        </p>
        <p className="text-xs text-muted">
          {t('matching.capacity')
            .replace('{{n}}', String(count))
            .replace('{{cap}}', String(HALAQAH_TARGET_SIZE))}
        </p>
      </div>
      <Link to={`/halaqah/${halaqah.id}`}>
        <Button size="sm" variant="outline">
          {t('matching.openHalaqah')}
        </Button>
      </Link>
    </li>
  );
}

function BlockedRow({
  student,
  analysis,
  t,
}: {
  student: Profile;
  analysis: StudentAnalysis;
  t: (k: string) => string;
}) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground truncate">
          {getDisplayName(student)}
        </span>
        <Link to={adminUserDetailPath(student.id)}>
          <Button size="sm" variant="outline">
            {t('matching.openProfile')}
          </Button>
        </Link>
      </div>
      {analysis.reason && (
        <Badge variant="warning" size="sm" className="mt-1">
          {t(unassignmentReasonKey(analysis.reason))}
        </Badge>
      )}
    </li>
  );
}

export default MatchingCenter;
