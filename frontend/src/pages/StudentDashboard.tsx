import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useStudentHalaqah } from "../hooks/useHalaqah";
import {
  useStudentReports,
  useStudentProgress,
  useDeleteReport,
} from "../hooks/useReports";
import {
  DashboardLayout,
  PageSection,
} from "../components/templates/DashboardLayout";
import { Card } from "../components/molecules/Card";
import { StatCard, StatCardRow } from "../components/molecules/StatCard";
import { MeetLinkCard } from "../components/molecules/MeetLinkCard";
import { DashboardViewSwitcher } from "../components/molecules/DashboardViewSwitcher";
import { ConfirmDialog } from "../components/molecules/ConfirmDialog";
import { ShareReportDialog } from "../components/molecules/ShareReportDialog";
import { Button } from "../components/atoms/Button";
import { SaveIcon, RefreshIcon, PlusIcon } from "../components/atoms/Icon";
import { getDisplayName } from "../lib/utils";
import { getErrorMessage } from "../lib/errorHandler";
import { TOTAL_QURAN_PAGES } from "../lib/constants";
import { useTranslation } from "../locales/i18n";
import { uiText } from "../lib/uiText";
import {
  formatReportForSharing,
  shareReportViaWhatsapp,
} from "../lib/reportSharing";
import { useSettings } from "../context/SettingsContext";
import { ReportList } from "@/components/organisms";
import type { ReportWithItems } from "@/components/organisms";

/**
 * Student Dashboard Page
 */
export function StudentDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { academyName } = useSettings();
  const { halaqah, loading: loadingHalaqah } = useStudentHalaqah(profile?.id);
  const {
    reports,
    loading: loadingReports,
    refetch: refetchReports,
  } = useStudentReports(profile?.id);
  const { progress, loading: loadingProgress, refetch: refetchProgress } =
    useStudentProgress(profile?.id);
  const { deleteReport, loading: deleting } = useDeleteReport();

  // Confirmation modal state for the delete flow.
  const [pendingDelete, setPendingDelete] = useState<ReportWithItems | null>(
    null,
  );

  // Share preview dialog state. The dashboard's per-row share now
  // routes through the same preview surface the ReportForm uses, so
  // the message format and the editable affordance are identical
  // across the two entry points.
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareDraftText, setShareDraftText] = useState('');
  const [sharing, setSharing] = useState(false);

  const isLoading = loadingHalaqah || loadingReports || loadingProgress;

  const handleEdit = (report: ReportWithItems) => {
    navigate(`/report/${report.id}/edit`);
  };

  // Open the share preview for a saved report. The dialog's confirm
  // handler dispatches the share — the report itself is already
  // persisted at this point (the dashboard list only shows saved
  // rows), so there's no save step to chain.
  const handleShare = (report: ReportWithItems) => {
    const text = formatReportForSharing(report, {
      studentName: profile ? getDisplayName(profile) : '',
      halaqahName: halaqah?.name,
      academyName,
    });
    setShareDraftText(text);
    setShareDialogOpen(true);
  };

  const handleShareConfirm = async (text: string) => {
    setSharing(true);
    try {
      const outcome = await shareReportViaWhatsapp({
        text,
        halaqahLink: halaqah?.meet_link,
      });
      switch (outcome) {
        case 'shared':
          break;
        case 'copied_and_opened':
          toast.success(t('report.shareCopiedAndOpened'));
          break;
        case 'copied':
          toast.info(t('report.shareCopiedNoLink'));
          break;
        case 'unavailable':
          toast.error(t('report.shareUnavailable'));
          break;
      }
      setShareDialogOpen(false);
    } finally {
      setSharing(false);
    }
  };

  const handleDeleteRequest = (report: ReportWithItems) => {
    setPendingDelete(report);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete) return;

    const { error } = await deleteReport(pendingDelete.id);
    if (error) {
      toast.error(getErrorMessage(error) || t("report.deleteFailed"));
      return;
    }

    setPendingDelete(null);
    toast.success(t("report.deleteSuccess"));
    // Refetch list + progress so the deleted row + its pages are gone
    // from both surfaces immediately.
    await Promise.all([refetchReports(), refetchProgress()]);
  };

  return (
    <DashboardLayout
      title={t('dashboard.studentWelcome')}
      subtitle={t('dashboard.studentSubtitle')}
    >
      {/* Dual-role accounts (student + supervisor) get a top-level
          view switcher. Renders nothing for pure students. */}
      <DashboardViewSwitcher />
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Halaqah Info */}
          <PageSection title={t('dashboard.myHalaqah')}>
            <Card padding="md" variant="bordered">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">{t('dashboard.halaqahNameLabel')}</p>
                  <p className="text-lg font-medium text-foreground">
                    {halaqah?.name || t('halaqah.notAssigned')}
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-sm text-muted mb-1">
                    {t(uiText.getTeacherLabel(halaqah?.segment, 'singular'))}
                  </p>
                  <p className="text-lg font-medium text-foreground">
                    {halaqah?.teacher
                      ? getDisplayName(halaqah.teacher)
                      : t('halaqah.notAssigned')}
                  </p>
                </div>
              </div>

              {/* Google Meet Link */}
              <MeetLinkCard link={halaqah?.meet_link} />
            </Card>
          </PageSection>

          {/* Progress Summary */}
          <PageSection title={t('progress.summary')}>
            <StatCardRow>
              <StatCard
                title={t('progress.memorizationPages')}
                value={progress.memorization}
                icon={SaveIcon}
                subtitle={t('common.page')}
                variant="primary"
              />
              <StatCard
                title={t('progress.reviewPages')}
                value={progress.review}
                icon={RefreshIcon}
                subtitle={t('common.page')}
              />
              <StatCard
                title={t('progress.totalProgress')}
                value={`${progress.progress}%`}
                progress={progress.progress}
                progressLabel={`${progress.memorization} ${t('progress.ofTotal')} ${TOTAL_QURAN_PAGES} ${t('common.page')}`}
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
              {t('report.addReport')}
            </Button>
          </div>

          {/* Recent Reports */}
          <PageSection title={t('report.recentReports')}>
            <ReportList
              reports={reports}
              loading={loadingReports}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              // Share button is offered only when the halaqah carries
              // a WhatsApp group link (or any link) — otherwise the
              // student has nowhere to send the message.
              onShare={halaqah?.meet_link ? handleShare : undefined}
            />
          </PageSection>
        </div>
      )}
      <ConfirmDialog
        isOpen={!!pendingDelete}
        onClose={() => (deleting ? undefined : setPendingDelete(null))}
        onConfirm={handleDeleteConfirm}
        title={t("report.deleteConfirmTitle")}
        body={t("report.deleteConfirmBody")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        loading={deleting}
      />
      <ShareReportDialog
        isOpen={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        defaultText={shareDraftText}
        onSend={handleShareConfirm}
        loading={sharing}
      />
    </DashboardLayout>
  );
}

export default StudentDashboard;
