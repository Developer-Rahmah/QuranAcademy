import { DashboardLayout } from '../components/templates/DashboardLayout';
import { ReportForm } from '../components/organisms/ReportForm';

/**
 * Add Report Page - Form to submit a new daily report
 */
export function AddReport() {
  return (
    <DashboardLayout
      title="رفع تقرير جديد"
      subtitle="سجلي تقدمك اليومي في حفظ ومراجعة القرآن الكريم"
    >
      <div className="max-w-2xl mx-auto">
        <ReportForm />
      </div>
    </DashboardLayout>
  );
}

export default AddReport;
