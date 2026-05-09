/**
 * ReportList Component Types
 */
import type { Report, ReportItem } from '../../../types';

export interface ReportWithItems extends Report {
  items?: ReportItem[];
}

export interface ReportActionHandlers {
  /** Called when the user clicks the per-row edit button. */
  onEdit?: (report: ReportWithItems) => void;
  /** Called when the user clicks the per-row delete button. */
  onDelete?: (report: ReportWithItems) => void;
}

export interface ReportListProps extends ReportActionHandlers {
  reports?: ReportWithItems[];
  loading?: boolean;
}

export interface ReportCardProps extends ReportActionHandlers {
  report: ReportWithItems;
}

export interface ReportSummaryProps {
  reports?: ReportWithItems[];
}
