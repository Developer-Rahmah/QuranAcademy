/**
 * ReportList Component Types
 */
import type { Report, ReportItem } from '../../../types';

export interface ReportWithItems extends Report {
  items?: ReportItem[];
}

export interface ReportListProps {
  reports?: ReportWithItems[];
  loading?: boolean;
}

export interface ReportCardProps {
  report: ReportWithItems;
}

export interface ReportSummaryProps {
  reports?: ReportWithItems[];
}
