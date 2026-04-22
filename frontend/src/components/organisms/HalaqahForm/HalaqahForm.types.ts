/**
 * HalaqahForm Types
 */
import type { Halaqah, MemorizationLevel, HalaqahStatus, UserSegment } from '../../../types';
import type { PreferredAudienceUI } from '../../../lib/segment';

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
  /**
   * Audience uses the UI superset so the form can expose a 'men' option
   * for men's halaqahs. At submit time the value is coerced to a DB-valid
   * literal via `submitPreferredAudience`; the `segment` column on the
   * halaqah carries the gender authoritatively.
   */
  target_audience: PreferredAudienceUI;
  status: HalaqahStatus;
  /**
   * Gender segment of the halaqah. Only men/women are allowed here; the
   * children/non-Arabic-speakers distinctions are orthogonal (set on the
   * teacher/student profiles, not on the halaqah itself).
   */
  segment: Extract<UserSegment, 'men' | 'women'>;
}

export interface HalaqahFormErrors {
  [key: string]: string;
}
