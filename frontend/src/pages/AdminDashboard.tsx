import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useHalaqahs } from '../hooks/useHalaqah';
import { useAcademyStats } from '../hooks/useReports';
import { db } from '../lib/supabase';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { StatCard, StatCardRow } from '../components/molecules/StatCard';
import { HalaqahTable } from '../components/organisms/HalaqahTable';
import { HalaqahForm } from '../components/organisms/HalaqahForm';
import { Button } from '../components/atoms/Button';
import { UsersIcon, TeacherIcon, BookIcon, PlusIcon } from '../components/atoms/Icon';
import { useTranslation } from '../locales/i18n';
import { TOTAL_QURAN_PAGES } from '../lib/constants';
import type { HalaqahWithStats } from '../types';

/**
 * Admin Dashboard Page
 */
export function AdminDashboard() {
  const { t } = useTranslation();
  const { stats, loading: loadingStats, refetch: refetchStats } = useAcademyStats();
  const { halaqahs: rawHalaqahs, loading: loadingHalaqahs, refetch: refetchHalaqahs } = useHalaqahs();

  const [halaqahs, setHalaqahs] = useState<HalaqahWithStats[]>([]);
  const [loadingHalaqahStats, setLoadingHalaqahStats] = useState(true);
  const [totalProgress, setTotalProgress] = useState({ memorized: 0, percentage: 0 });
  const [showHalaqahForm, setShowHalaqahForm] = useState(false);

  // Fetch halaqah statistics
  useEffect(() => {
    const fetchHalaqahStats = async () => {
      if (!rawHalaqahs || rawHalaqahs.length === 0) {
        setHalaqahs([]);
        setLoadingHalaqahStats(false);
        return;
      }

      setLoadingHalaqahStats(true);

      try {
        // Get member counts and progress for each halaqah
        const halaqahsWithStats = await Promise.all(
          rawHalaqahs.map(async (halaqah) => {
            // Get members
            const { data: members } = await db.members.getByHalaqah(halaqah.id);
            const studentCount = members?.length || 0;

            // Calculate average progress (simplified)
            let totalMemorization = 0;
            if (members && members.length > 0) {
              const progressData = await Promise.all(
                members.map(async (member) => {
                  const { data } = await db.stats.getStudentProgress(member.student_id);
                  return data?.memorization || 0;
                })
              );
              totalMemorization = progressData.reduce((sum, p) => sum + p, 0);
            }

            const avgMemorization = studentCount > 0 ? totalMemorization / studentCount : 0;
            const avgProgress = Math.round((avgMemorization / TOTAL_QURAN_PAGES) * 100);

            return {
              ...halaqah,
              studentCount,
              avgProgress,
            } as HalaqahWithStats;
          })
        );

        setHalaqahs(halaqahsWithStats);

        // Calculate total academy progress
        const totalMem = halaqahsWithStats.reduce(
          (sum, h) => sum + ((h.avgProgress ?? 0) * (h.studentCount ?? 0)),
          0
        );
        const totalStudents = halaqahsWithStats.reduce(
          (sum, h) => sum + (h.studentCount ?? 0),
          0
        );
        const academyAvg = totalStudents > 0 ? Math.round(totalMem / totalStudents) : 0;

        setTotalProgress({
          memorized: Math.round((academyAvg / 100) * TOTAL_QURAN_PAGES * totalStudents),
          percentage: academyAvg,
        });
      } catch (error) {
        console.error('Error fetching halaqah stats:', error);
      } finally {
        setLoadingHalaqahStats(false);
      }
    };

    fetchHalaqahStats();
  }, [rawHalaqahs]);

  const isLoading = loadingStats || loadingHalaqahs || loadingHalaqahStats;

  return (
    <DashboardLayout
      title="السلام عليكم ورحمة الله وبركاته"
      subtitle="نظرة عامة على الأكاديمية"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Statistics Cards */}
          <StatCardRow>
            <StatCard
              title="إجمالي الطلاب"
              value={stats.totalStudents}
              icon={UsersIcon}
            />
            <StatCard
              title="إجمالي المعلمين"
              value={stats.totalTeachers}
              icon={TeacherIcon}
            />
            <StatCard
              title="إجمالي الحلقات"
              value={stats.totalHalaqahs}
              icon={BookIcon}
            />
            <StatCard
              title="نسبة الحفظ الإجمالية"
              value={`${totalProgress.percentage}%`}
              progress={totalProgress.percentage}
              progressLabel={`${totalProgress.memorized} من ${TOTAL_QURAN_PAGES} صفحة`}
            />
          </StatCardRow>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <Button
              size="lg"
              onClick={() => setShowHalaqahForm(true)}
            >
              <PlusIcon className="w-5 h-5" />
              {t('admin.createHalaqah')}
            </Button>
            <Link to="/admin/users">
              <Button size="lg" variant="outline">
                <UsersIcon className="w-5 h-5" />
                {t('admin.viewUsers')}
              </Button>
            </Link>
          </div>

          {/* Halaqahs Table */}
          <PageSection title={t('halaqah.title')}>
            <HalaqahTable halaqahs={halaqahs} loading={loadingHalaqahStats} />
          </PageSection>
        </div>
      )}

      {/* Create Halaqah Modal */}
      <HalaqahForm
        isOpen={showHalaqahForm}
        onClose={() => setShowHalaqahForm(false)}
        onSuccess={() => {
          refetchHalaqahs?.();
          refetchStats?.();
        }}
      />
    </DashboardLayout>
  );
}

export default AdminDashboard;
