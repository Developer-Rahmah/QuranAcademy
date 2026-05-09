import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DashboardLayout } from "../components/templates/DashboardLayout";
import { ReportForm } from "../components/organisms/ReportForm";
import { Card, CardContent } from "../components/molecules/Card";
import { Button } from "../components/atoms/Button";
import { useReport } from "../hooks/useReports";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTranslation } from "../locales/i18n";

/**
 * Edit Report Page — owner-only edit of a previously submitted report.
 *
 * Wraps the same `ReportForm` used by /report/new but in edit mode.
 * Ownership is enforced two ways:
 *   1. RLS already restricts SELECT on `reports` to the owner / their
 *      teacher / admin, so a non-owner student cannot fetch the row.
 *   2. As a defence-in-depth, we explicitly redirect when the loaded
 *      report's `student_id` doesn't match the current user — handles
 *      the rare case where RLS lets a teacher/admin land here from a
 *      copy-pasted URL.
 */
export function EditReport() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { report, loading, error } = useReport(id);

  // Hard ownership gate. Lets a misrouted teacher/admin bounce to the
  // dashboard instead of seeing a student's edit form.
  useEffect(() => {
    if (loading) return;
    if (!report) return;
    if (profile && report.student_id !== profile.id) {
      toast.error(t("errors.unauthorized"));
      navigate("/dashboard", { replace: true });
    }
  }, [report, loading, profile, navigate, toast, t]);

  if (loading) {
    return (
      <DashboardLayout title={t("report.editPageTitle")}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !report) {
    return (
      <DashboardLayout title={t("report.editPageTitle")}>
        <Card padding="lg">
          <CardContent>
            <p className="text-center text-muted mb-4">
              {error ? t("report.loadFailed") : t("report.notFound")}
            </p>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => navigate("/dashboard")}
              >
                {t("common.backToDashboard")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title={t("report.editPageTitle")}
      subtitle={t("report.editPageSubtitle")}
    >
      <div className="max-w-2xl mx-auto">
        <ReportForm report={report} />
      </div>
    </DashboardLayout>
  );
}

export default EditReport;
