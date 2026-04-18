/**
 * HalaqahForm Types
 */
import type { Halaqah, MemorizationLevel, HalaqahStatus, PreferredAudience } from '../../../types';

export interface HalaqahFormProps {
  halaqah?: Halaqah | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export interface HalaqahFormData {
  name: string;
  teacher_id: string;
  meet_link: string;
  level: MemorizationLevel;
  target_audience: PreferredAudience;
  status: HalaqahStatus;
}

export interface HalaqahFormErrors {
  [key: string]: string;
}
