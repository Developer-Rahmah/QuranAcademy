import { DashboardLayout } from "../components/templates/DashboardLayout";
import { ReportForm } from "../components/organisms/ReportForm";
import { useTranslation } from "../locales/i18n";

/**
 *  Add Report Page - Form to submit a new daily report
 */
export function AddReport() {
  const { t } = useTranslation();

  return (
    <DashboardLayout
      title={t("report.addReport")}
      subtitle={t("report.addReportSubtitle")}
    >
      <div className="max-w-2xl mx-auto">
        <ReportForm />
      </div>
    </DashboardLayout>
  );
}

export default AddReport;
