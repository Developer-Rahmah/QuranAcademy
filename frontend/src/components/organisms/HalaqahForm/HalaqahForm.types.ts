/**
 * HalaqahForm Types
 */
import type { Halaqah, Profile } from '../../../types';

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
  level: string;
  target_audience: string;
  status: string;
}

export interface HalaqahFormErrors {
  [key: string]: string;
}
