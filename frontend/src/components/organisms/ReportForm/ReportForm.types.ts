/**
 * ReportForm Component Types
 */
import type { Report } from '../../../types';

export interface ReportItem {
  id: string;
  surah_name: string;
  pages: string;
}

export interface FormErrors {
  [key: string]: string;
}

export interface ReportFormProps {
  className?: string;
  /**
   * When provided, the form switches to edit mode: pre-fills the
   * fields from the report and patches it on submit instead of
   * creating a new row. Caller is responsible for fetching the report
   * (or passing whatever the API returned) and for navigating away
   * after a successful update — the form just renders the editor.
   */
  report?: Report | null;
}
