import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useHalaqah } from '../hooks/useHalaqah';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/supabase';
import { DashboardLayout, PageSection } from '../components/templates/DashboardLayout';
import { Card } from '../components/molecules/Card';
import { StatCard, StatCardRow } from '../components/molecules/StatCard';
import { MeetLinkCard } from '../components/molecules/MeetLinkCard';
import { StudentTable } from '../components/organisms/StudentTable';
import { HalaqahForm } from '../components/organisms/HalaqahForm';
import { StudentAssignment } from '../components/organisms/StudentAssignment';
import { ProgressBar } from '../components/atoms/ProgressBar';
import { Button } from '../components/atoms/Button';
import { ChartIcon, UsersIcon, SaveIcon, PlusIcon } from '../components/atoms/Icon';
import { useTranslation } from '../locales/i18n';
import { getDisplayName } from '../lib/utils';
import { TOTAL_QURAN_PAGES } from '../lib/constants';
import type { StudentWithProgress } from '../types';

interface HalaqahStats {
  totalMemorization: number;
  avgMemorization: number;
  avgProgress: number;
}

/**
 * Halaqah Details Page - Shows detailed info about a halaqah
 */
export function HalaqahDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { halaqah, members, loading: loadingHalaqah, refetch } = useHalaqah(id);

  const [students, setStudents] = useState<StudentWithProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [halaqahStats, setHalaqahStats] = useState<HalaqahStats>({
    totalMemorization: 0,
    avgMemorization: 0,
    avgProgress: 0,
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showStudentAssignment, setShowStudentAssignment] = useState(false);

  // Fetch student progress data
  useEffect(() => {
    const fetchStudentProgress = async () => {
      if (!members || members.length === 0) {
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      setLoadingStudents(true);

      try {
        let totalMem = 0;

        const studentData = await Promise.all(
          members.map(async (member) => {
            const { data: progressData } = await db.stats.getStudentProgress(
              member.student_id
            );

            const memPages = progressData?.memorization || 0;
            totalMem += memPages;

            return {
              id: member.student_id,
              ...member.student,
              memorizationPages: memPages,
              reviewPages: progressData?.review || 0,
              progress: progressData?.progress || 0,
            } as StudentWithProgress;
          })
        );

        setStudents(studentData);

        // Calculate halaqah stats
        const avgMem = studentData.length > 0 ? totalMem / studentData.length : 0;
        const avgProg = Math.round((avgMem / TOTAL_QURAN_PAGES) * 100);

        setHalaqahStats({
          totalMemorization: Math.round(totalMem),
          avgMemorization: Math.round(avgMem),
          avgProgress: avgProg,
        });
      } catch (error) {
        console.error('Error fetching student progress:', error);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentProgress();
  }, [members]);

  const isLoading = loadingHalaqah;

  if (isLoading) {
    return (
      <DashboardLayout title="تفاصيل الحلقة">
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!halaqah) {
    return (
      <DashboardLayout title="تفاصيل الحلقة">
        <Card padding="lg">
          <p className="text-center text-muted py-8">الحلقة غير موجودة</p>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="تفاصيل الحلقة"
      subtitle="معلومات شاملة عن أداء الحلقة"
    >
      <div className="space-y-8">
        {/* Admin Actions */}
        {isAdmin() && (
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setShowEditForm(true)} variant="outline">
              {t('admin.editHalaqah')}
            </Button>
            <Button onClick={() => setShowStudentAssignment(true)}>
              <PlusIcon className="w-4 h-4" />
              {t('admin.manageStudents')}
            </Button>
          </div>
        )}

        {/* Halaqah Info */}
        <Card padding="md" variant="bordered">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="text-center md:text-right">
              <p className="text-sm text-muted mb-1">{t('halaqah.halaqahName')}</p>
              <p className="text-lg font-medium text-foreground">
                {halaqah.name}
              </p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-muted mb-1">{t('halaqah.teacherName')}</p>
              <p className="text-lg font-medium text-foreground">
                {halaqah.teacher
                  ? `${getDisplayName(halaqah.teacher)}`
                  : t('halaqah.notAssigned')}
              </p>
            </div>
          </div>

          {/* Google Meet Link */}
          <MeetLinkCard link={halaqah.meet_link} />
        </Card>

        {/* Progress Card */}
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-muted">نسبة التقدم الإجمالية للحلقة</span>
            <ChartIcon className="w-5 h-5 text-primary" />
          </div>
          <ProgressBar value={halaqahStats.avgProgress} size="lg" showLabel />
          <p className="text-sm text-muted mt-2 text-center">
            متوسط الحفظ: {halaqahStats.avgMemorization} صفحة لكل طالبة
          </p>
        </Card>

        {/* Statistics */}
        <StatCardRow>
          <StatCard
            title="إجمالي الصفحات المحفوظة"
            value={halaqahStats.totalMemorization}
            icon={SaveIcon}
            subtitle="صفحة"
            variant="primary"
          />
          <StatCard
            title="متوسط الحفظ للطالبة"
            value={halaqahStats.avgMemorization}
            icon={ChartIcon}
            subtitle="صفحة"
          />
          <StatCard
            title="عدد الطالبات"
            value={students.length}
            icon={UsersIcon}
          />
        </StatCardRow>

        {/* Students Table */}
        <PageSection title={`${t('student.title')} (${students.length})`}>
          <StudentTable
            students={students}
            loading={loadingStudents}
            showReportsButton={false}
          />
        </PageSection>
      </div>

      {/* Edit Halaqah Modal */}
      {isAdmin() && (
        <>
          <HalaqahForm
            halaqah={halaqah}
            isOpen={showEditForm}
            onClose={() => setShowEditForm(false)}
            onSuccess={() => refetch?.()}
          />
          <StudentAssignment
            halaqahId={halaqah.id}
            halaqahName={halaqah.name}
            isOpen={showStudentAssignment}
            onClose={() => setShowStudentAssignment(false)}
            onSuccess={() => refetch?.()}
          />
        </>
      )}
    </DashboardLayout>
  );
}

export default HalaqahDetails;
