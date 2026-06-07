/**
 * AdminDashboard — academy-wide overview + paginated halaqahs table.
 *
 * Fetch shape (no DB changes, no N+1):
 *   - Mount once
 *       · academyStats           — small count-only query (existing hook).
 *       · halaqah_members map    — projected `(halaqah_id, student_id)`
 *                                  for every active membership.
 *       · memorization map       — projected `(pages, report.halaqah_id)`
 *                                  for every memorization report item.
 *     Together these power BOTH the per-row stats AND the academy-wide
 *     "Overall memorization" card. Cached for the rest of the session.
 *   - Per page click / search
 *       · ONE paginated halaqahs SELECT with `count: 'exact'`.
 *
 * The HalaqahTable's built-in search/pagination are disabled
 * (`searchable={false}`) because we're driving both server-side from
 * here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAcademyStats } from '../hooks/useReports';
import { supabase } from '../lib/supabase/client';
import {
  DashboardLayout,
  PageSection,
} from '../components/templates/DashboardLayout';
import { StatCard, StatCardRow } from '../components/molecules/StatCard';
import { HalaqahTable } from '../components/organisms/HalaqahTable';
import { HalaqahForm } from '../components/organisms/HalaqahForm';
import { Pagination } from '../components/molecules/Pagination';
import { Button } from '../components/atoms/Button';
import { Input } from '../components/atoms/Input';
import { Select } from '../components/atoms/Select';
import {
  UsersIcon,
  TeacherIcon,
  BookIcon,
  PlusIcon,
} from '../components/atoms/Icon';
import { useTranslation } from '../locales/i18n';
import { useAuth } from '../context/AuthContext';
import { canManageSettings } from '../lib/permissions';
import { TOTAL_QURAN_PAGES } from '../lib/constants';
import type { Halaqah, HalaqahWithStats } from '../types';

const PAGE_SIZE = 8;

export function AdminDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { stats, loading: loadingStats, refetch: refetchStats } =
    useAcademyStats();

  // -------- pagination state -------------------------------------------
  const [currentPage, setCurrentPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  /**
   * Meet-link filter:
   *   - 'all'    : no filter (default)
   *   - 'with'   : meet_link is set (non-empty)
   *   - 'without': meet_link is null OR empty string
   *
   * Pushed into the server query so it composes correctly with
   * pagination — the `count: 'exact'` total reflects the filter.
   */
  const [meetLinkFilter, setMeetLinkFilter] = useState<'all' | 'with' | 'without'>(
    'all',
  );

  // -------- table state ------------------------------------------------
  const [pageHalaqahs, setPageHalaqahs] = useState<HalaqahWithStats[]>([]);
  const [loadingPage, setLoadingPage] = useState(true);
  const [showHalaqahForm, setShowHalaqahForm] = useState(false);

  // -------- aggregate maps (mount-only) --------------------------------
  // membersByHalaqah[halaqahId] → number of distinct active members.
  // memoByHalaqah[halaqahId]    → sum of memorization pages reported.
  // Two cheap projected queries on mount; reused for both the per-row
  // badges and the academy-wide "Overall memorization" card.
  const [membersByHalaqah, setMembersByHalaqah] = useState<Map<string, number>>(
    new Map(),
  );
  const [memoByHalaqah, setMemoByHalaqah] = useState<Map<string, number>>(
    new Map(),
  );
  const [aggregatesLoaded, setAggregatesLoaded] = useState(false);

  const fetchAggregates = useCallback(async () => {
    setAggregatesLoaded(false);
    try {
      const [membersRes, itemsRes] = await Promise.all([
        // Active memberships only — matches the original semantic of
        // `db.members.getByHalaqah` which filtered to status='active'.
        supabase
          .from('halaqah_members')
          .select('halaqah_id, student_id')
          .eq('status', 'active'),
        // Memorization items joined to their report so we can group by
        // halaqah_id. `!inner` enforces the join — items without a
        // report row are dropped (shouldn't exist, but defensive).
        supabase
          .from('report_items')
          .select('pages, report:reports!inner(halaqah_id)')
          .eq('type', 'memorization'),
      ]);

      const members =
        (membersRes.data ?? []) as Array<{ halaqah_id: string; student_id: string }>;
      const counts = new Map<string, number>();
      for (const m of members) {
        counts.set(m.halaqah_id, (counts.get(m.halaqah_id) ?? 0) + 1);
      }
      setMembersByHalaqah(counts);

      const items = (itemsRes.data ?? []) as Array<{
        pages: number | string;
        report: { halaqah_id: string } | { halaqah_id: string }[];
      }>;
      const memo = new Map<string, number>();
      for (const it of items) {
        // PostgREST can deliver the embedded `report` as either an
        // object or an array depending on the cardinality hint — defend
        // against both shapes.
        const report = Array.isArray(it.report) ? it.report[0] : it.report;
        if (!report?.halaqah_id) continue;
        const pages = parseFloat(String(it.pages));
        if (!Number.isFinite(pages)) continue;
        memo.set(
          report.halaqah_id,
          (memo.get(report.halaqah_id) ?? 0) + pages,
        );
      }
      setMemoByHalaqah(memo);
    } catch (err) {
      console.error('Error fetching aggregates:', err);
    } finally {
      setAggregatesLoaded(true);
    }
  }, []);

  useEffect(() => {
    void fetchAggregates();
  }, [fetchAggregates]);

  // -------- per-page halaqahs fetch -------------------------------------
  const fetchPage = useCallback(async () => {
    setLoadingPage(true);
    try {
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from('halaqahs')
        .select(
          `
          *,
          teacher:profiles!teacher_id(id, first_name, second_name, third_name)
        `,
          { count: 'exact' },
        );

      const q = searchQuery.trim().replace(/[%,()]/g, '');
      if (q) {
        // Server-side name search; teacher-name search would need a
        // join filter so we keep this to halaqah name for now.
        query = query.ilike('name', `%${q}%`);
      }

      // Meet-link filter — "without" matches both NULL and empty-string
      // meet_link values; "with" requires a non-empty value. Pushed
      // server-side so the pager's total reflects the filter.
      if (meetLinkFilter === 'with') {
        query = query.not('meet_link', 'is', null).neq('meet_link', '');
      } else if (meetLinkFilter === 'without') {
        query = query.or('meet_link.is.null,meet_link.eq.');
      }

      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) {
        console.error('Error fetching halaqahs:', error);
        return;
      }
      setTotalCount(count ?? 0);

      const rows = (data ?? []) as Halaqah[];
      setPageHalaqahs(rows.map((h) => attachStats(h, membersByHalaqah, memoByHalaqah)));
    } catch (err) {
      console.error('Error fetching halaqahs:', err);
    } finally {
      setLoadingPage(false);
    }
  }, [currentPage, searchQuery, meetLinkFilter, membersByHalaqah, memoByHalaqah]);

  useEffect(() => {
    void fetchPage();
  }, [fetchPage]);

  // Reset to page 0 when the search query or filter narrows the list,
  // so the user never lands on an empty page index.
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, meetLinkFilter]);

  // -------- overall memorization (derived from aggregate maps) ----------
  // Same formula as before:
  //   memorized  = Σ memorization pages across all halaqahs
  //   percentage = memorized / (totalActiveMembers · TOTAL_QURAN_PAGES) · 100
  // Numerically identical to the previous per-halaqah weighted average.
  const overallMemo = useMemo(() => {
    let memorized = 0;
    for (const v of memoByHalaqah.values()) memorized += v;
    let totalMembers = 0;
    for (const v of membersByHalaqah.values()) totalMembers += v;
    if (totalMembers === 0 || memorized === 0) {
      return { memorized: 0, percentage: 0 };
    }
    const percentage = Math.round(
      (memorized / (totalMembers * TOTAL_QURAN_PAGES)) * 100,
    );
    return { memorized: Math.round(memorized), percentage };
  }, [memoByHalaqah, membersByHalaqah]);

  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const isInitialLoading = loadingStats || (loadingPage && !aggregatesLoaded);

  return (
    <DashboardLayout
      title="السلام عليكم ورحمة الله وبركاته"
      subtitle="نظرة عامة على الأكاديمية"
    >
      {isInitialLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Statistics Cards */}
          <StatCardRow>
            <StatCard
              title={t('academy.totalStudents')}
              value={stats.totalStudents}
              icon={UsersIcon}
            />
            <StatCard
              title={t('academy.totalTeachers')}
              value={stats.totalTeachers}
              icon={TeacherIcon}
            />
            <StatCard
              title={t('academy.totalHalaqahs')}
              value={stats.totalHalaqahs}
              icon={BookIcon}
            />
            <StatCard
              title={t('academy.overallMemorization')}
              value={`${overallMemo.percentage}%`}
              progress={overallMemo.percentage}
              progressLabel={`${overallMemo.memorized} ${t('academy.pagesOutOf')} ${TOTAL_QURAN_PAGES}`}
            />
          </StatCardRow>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button size="lg" onClick={() => setShowHalaqahForm(true)}>
              <PlusIcon className="w-5 h-5" />
              {t('admin.createHalaqah')}
            </Button>
            <Link to="/admin/users">
              <Button size="lg" variant="outline">
                <UsersIcon className="w-5 h-5" />
                {t('admin.viewUsers')}
              </Button>
            </Link>
            {canManageSettings(profile?.role) && (
              <Link to="/admin/settings">
                <Button size="lg" variant="outline">
                  {t('adminSettings.title')}
                </Button>
              </Link>
            )}
          </div>

          {/* Halaqahs Table — server-paginated. The table's built-in
              search/pagination are disabled so the parent owns both. */}
          <PageSection title={t('halaqah.title')}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[200px]">
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('common.search')}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base text-muted whitespace-nowrap">
                  {t('halaqah.meetLinkFilterLabel')}:
                </span>
                <Select
                  value={meetLinkFilter}
                  onChange={(e) =>
                    setMeetLinkFilter(e.target.value as 'all' | 'with' | 'without')
                  }
                  options={[
                    { value: 'all', label: t('common.all') },
                    { value: 'without', label: t('halaqah.meetLinkMissing') },
                    { value: 'with', label: t('halaqah.meetLinkPresent') },
                  ]}
                />
              </div>
            </div>
            <HalaqahTable
              halaqahs={pageHalaqahs}
              loading={loadingPage}
              searchable={false}
            />
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setCurrentPage}
            />
          </PageSection>
        </div>
      )}

      {/* Create Halaqah Modal */}
      <HalaqahForm
        isOpen={showHalaqahForm}
        onClose={() => setShowHalaqahForm(false)}
        onSuccess={() => {
          // Refresh both the aggregates (new halaqah → empty membership
          // and memo for it, but it appears in the count) and the
          // visible page.
          void fetchAggregates();
          void fetchPage();
          refetchStats?.();
        }}
      />
    </DashboardLayout>
  );
}

function attachStats(
  h: Halaqah,
  members: Map<string, number>,
  memo: Map<string, number>,
): HalaqahWithStats {
  const studentCount = members.get(h.id) ?? 0;
  const totalMem = memo.get(h.id) ?? 0;
  const avgMem = studentCount > 0 ? totalMem / studentCount : 0;
  const avgProgress = Math.round((avgMem / TOTAL_QURAN_PAGES) * 100);
  return { ...h, studentCount, avgProgress };
}

export default AdminDashboard;
