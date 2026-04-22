import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useHalaqahs, useHalaqah } from "../hooks/useHalaqah";
import { db } from "../lib/supabase";
import {
  DashboardLayout,
  PageSection,
} from "../components/templates/DashboardLayout";
import { Card } from "../components/molecules/Card";
import { MeetLinkCard } from "../components/molecules/MeetLinkCard";
import { StudentTable } from "../components/organisms/StudentTable";
import { uiText } from "../lib/uiText";
import { useTranslation } from "../locales/i18n";
import type { StudentWithProgress } from "../types";

/**
 * Teacher Dashboard Page
 */
export function TeacherDashboard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const { halaqahs, loading: loadingHalaqahs } = useHalaqahs({
    teacherId: profile?.id,
  });

  // Get first halaqah (teacher usually has one)
  const teacherHalaqah = halaqahs?.[0];

  const {
    halaqah,
    members,
    loading: loadingHalaqah,
  } = useHalaqah(teacherHalaqah?.id);

  const [students, setStudents] = useState<StudentWithProgress[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);

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
        const studentData = await Promise.all(
          members.map(async (member) => {
            const { data: progressData } = await db.stats.getStudentProgress(
              member.student_id,
            );

            return {
              id: member.student_id,
              ...member.student,
              memorizationPages: progressData?.memorization || 0,
              reviewPages: progressData?.review || 0,
              progress: progressData?.progress || 0,
            } as StudentWithProgress;
          }),
        );

        setStudents(studentData);
      } catch (error) {
        console.error("Error fetching student progress:", error);
      } finally {
        setLoadingStudents(false);
      }
    };

    fetchStudentProgress();
  }, [members]);

  const handleViewReports = (student: StudentWithProgress) => {
    // Could navigate to a reports page or show a modal
    console.log("View reports for:", student);
  };

  const isLoading = loadingHalaqahs || loadingHalaqah;

  return (
    <DashboardLayout
      title={t('dashboard.teacherBlessingFemale')}
      subtitle={t(
        `dashboard.teacherProgressSubtitle${
          halaqah?.segment === 'men' ? 'Male' : halaqah?.segment === 'women' ? 'Female' : 'Neutral'
        }`,
      )}
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !halaqah ? (
        <Card padding="lg">
          <p className="text-center text-muted py-8">
            {t('dashboard.noHalaqahAssigned')}
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Halaqah Info */}
          <PageSection title={t('dashboard.myHalaqah')}>
            <Card padding="md" variant="bordered">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">{t('dashboard.halaqahNameLabel')}</p>
                  <p className="text-lg font-medium text-foreground">
                    {halaqah.name}
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">
                    {t(
                      `dashboard.studentsCountLabel${
                        halaqah?.segment === 'men'
                          ? 'Male'
                          : halaqah?.segment === 'women'
                          ? 'Female'
                          : 'Neutral'
                      }`,
                    )}
                  </p>
                  <p className="text-lg font-medium text-foreground">
                    {students.length}
                  </p>
                </div>
              </div>

              {/* Google Meet Link */}
              <MeetLinkCard link={halaqah.meet_link} />
            </Card>
          </PageSection>

          {/* Students List — title + empty state both derive from the
              halaqah's segment via the uiText single source. */}
          <PageSection title={t(uiText.getStudentLabel(halaqah?.segment, 'plural'))}>
            <StudentTable
              students={students}
              loading={loadingStudents}
              onViewReports={handleViewReports}
              segment={halaqah?.segment}
            />
          </PageSection>
        </div>
      )}
    </DashboardLayout>
  );
}

export default TeacherDashboard;
