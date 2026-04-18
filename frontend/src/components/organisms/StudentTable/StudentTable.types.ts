/**
 * StudentTable Component Types
 */
import type { Profile } from "../../../types";

export interface StudentWithProgress extends Profile {
  progress?: number;
  memorizationPages?: number;
  reviewPages?: number;
}

export interface StudentTableProps {
  students?: StudentWithProgress[];
  loading?: boolean;
  showReportsButton?: boolean;
  onViewReports?: (student: StudentWithProgress) => void;
}

export interface StudentCardProps {
  student: StudentWithProgress;
  onViewReports?: (student: StudentWithProgress) => void;
}
