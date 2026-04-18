/**
 * ReportForm Component Types
 */
import type { ReportType } from '../../../types';

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
}
