/**
 * StudentTable Component Types
 *
 * StudentWithProgress is defined centrally in src/types so every surface
 * (StudentTable, TeacherDashboard, etc.) shares one source of truth.
 */
import type { StudentWithProgress } from "../../../types";

export type { StudentWithProgress };

export interface StudentTableProps {
  students?: StudentWithProgress[];
  loading?: boolean;
  showReportsButton?: boolean;
  onViewReports?: (student: StudentWithProgress) => void;
  /**
   * Gender context for the table. Drives the empty-state copy via
   * `uiText.getEmptyStateText('student', segment)`. Optional — when
   * omitted the neutral copy is shown.
   */
  segment?: string | null;
}

export interface StudentCardProps {
  student: StudentWithProgress;
  onViewReports?: (student: StudentWithProgress) => void;
}
