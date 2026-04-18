import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useStudentHalaqah } from "../hooks/useHalaqah";
import { useStudentReports, useStudentProgress } from "../hooks/useReports";
import {
  DashboardLayout,
  PageSection,
} from "../components/templates/DashboardLayout";
import { Card } from "../components/molecules/Card";
import { StatCard, StatCardRow } from "../components/molecules/StatCard";
import { MeetLinkCard } from "../components/molecules/MeetLinkCard";
import { Button } from "../components/atoms/Button";
import { SaveIcon, RefreshIcon, PlusIcon } from "../components/atoms/Icon";
import { getDisplayName } from "../lib/utils";
import { TOTAL_QURAN_PAGES } from "../lib/constants";
import { ReportList } from "@/components/organisms";

/**
 * Student Dashboard Page
 */
export function StudentDashboard() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { halaqah, loading: loadingHalaqah } = useStudentHalaqah(profile?.id);
  const { reports, loading: loadingReports } = useStudentReports(profile?.id);
  const { progress, loading: loadingProgress } = useStudentProgress(
    profile?.id,
  );

  const isLoading = loadingHalaqah || loadingReports || loadingProgress;

  return (
    <DashboardLayout
      title="وفقك الله لحفظ كتابه الكريم"
      subtitle="تابعي تقدمك في رحلة حفظ القرآن"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Halaqah Info */}
          <PageSection title="حلقتي">
            <Card padding="md" variant="bordered">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">اسم الحلقة</p>
                  <p className="text-lg font-medium text-foreground">
                    {halaqah?.name || "غير محددة"}
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">اسم المعلمة</p>
                  <p className="text-lg font-medium text-foreground">
                    {halaqah?.teacher
                      ? `أ. ${getDisplayName(halaqah.teacher)}`
                      : "غير محددة"}
                  </p>
                </div>
              </div>

              {/* Google Meet Link */}
              <MeetLinkCard link={halaqah?.meet_link} />
            </Card>
          </PageSection>

          {/* Progress Summary */}
          <PageSection title="ملخص التقدم">
            <StatCardRow>
              <StatCard
                title="صفحات الحفظ"
                value={progress.memorization}
                icon={SaveIcon}
                subtitle="صفحة"
                variant="primary"
              />
              <StatCard
                title="صفحات المراجعة"
                value={progress.review}
                icon={RefreshIcon}
                subtitle="صفحة"
              />
              <StatCard
                title="نسبة الإنجاز الكلية"
                value={`${progress.progress}%`}
                progress={progress.progress}
                progressLabel={`${progress.memorization} من ${TOTAL_QURAN_PAGES} صفحة`}
              />
            </StatCardRow>
          </PageSection>

          {/* Add Report Button */}
          <div className="flex justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/report/new")}
              className="px-8"
            >
              <PlusIcon className="w-5 h-5" />
              رفع تقرير جديد
            </Button>
          </div>

          {/* Recent Reports */}
          <PageSection title="التقارير الأخيرة">
            <ReportList reports={reports} loading={loadingReports} />
          </PageSection>
        </div>
      )}
    </DashboardLayout>
  );
}

export default StudentDashboard;
