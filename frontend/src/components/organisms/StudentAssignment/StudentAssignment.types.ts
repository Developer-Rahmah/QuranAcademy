/**
 * StudentAssignment Types
 */
import type { Profile, HalaqahMember, Halaqah } from '../../../types';

export interface StudentAssignmentProps {
  halaqahId: string;
  halaqahName: string;
  /**
   * The halaqah being edited. Used by the assignment rules to decide
   * which students can be selected (see roleRules.canStudentJoinHalaqah).
   * Optional for backward compatibility with callers that haven't yet
   * passed it — when absent, assignments are not blocked, matching the
   * original pre-rules behaviour.
   */
  halaqah?: Pick<Halaqah, 'segment' | 'target_audience'> | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface StudentWithMembership extends Profile {
  membership?: HalaqahMember | null;
  isAssigned: boolean;
}
