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
  /**
   * When true, renders a "Contact" cell with the student's full
   * three-part name + a WhatsApp button (resolves to wa.me/<phone>).
   * Driven by `permissions.canContactStudents(viewerRole)` at the
   * call site so students don't see contact info for each other.
   */
  showContact?: boolean;
  /**
   * When true, renders an Activate / Deactivate button per student
   * row. Visibility is driven by
   * `permissions.canManageStudentActivation(viewerRole, opts)` at the
   * call site — pass `opts.isSupervisor: true` for relational
   * supervisors (profile.role often = 'student', but a row exists in
   * `halaqah_supervisors`). The actual per-student scope check runs
   * server-side in the `set_student_status` RPC — this prop only
   * controls UI affordance.
   */
  showActivation?: boolean;
  /**
   * Invoked when the activation button is clicked. The handler is
   * responsible for deciding the next status (typically the inverse of
   * the row's current status) and calling the backend RPC.
   */
  onToggleActivation?: (student: StudentWithProgress) => void;
  /**
   * Id of the student whose activation mutation is currently in flight,
   * so the table can render a per-row loading spinner.
   */
  activationLoadingId?: string | null;
  onViewReports?: (student: StudentWithProgress) => void;
  /**
   * Gender context for the table. Drives the empty-state copy via
   * `uiText.getEmptyStateText('student', segment)`. Optional — when
   * omitted the neutral copy is shown.
   */
  segment?: string | null;
  /**
   * Renders a built-in search input above the table that filters rows by
   * name / phone / email. Defaults to `true` — pass `false` only if the
   * caller already filters upstream or the list is guaranteed tiny.
   */
  searchable?: boolean;
}

export interface StudentCardProps {
  student: StudentWithProgress;
  onViewReports?: (student: StudentWithProgress) => void;
}
