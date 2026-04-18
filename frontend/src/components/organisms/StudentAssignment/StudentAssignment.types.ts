/**
 * StudentAssignment Types
 */
import type { Profile, HalaqahMember } from '../../../types';

export interface StudentAssignmentProps {
  halaqahId: string;
  halaqahName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface StudentWithMembership extends Profile {
  membership?: HalaqahMember | null;
  isAssigned: boolean;
}
