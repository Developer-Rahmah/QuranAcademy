/**
 * RegistrationForm Component Types
 *
 * Note: `student_type` / `preferred_audience` are typed with the UI-only
 * supersets `StudentTypeUI` / `PreferredAudienceUI` so the forms can
 * carry 'man' / 'men'. Values are coerced to DB-valid literals at submit
 * time via helpers in `lib/segment.ts`.
 */
import type { MemorizationLevel, UserSegment, LanguageType } from '../../../types';
import type { PhoneFieldValue } from '../../molecules/PhoneField';
import type { StudentTypeUI, PreferredAudienceUI } from '../../../lib/segment';

export interface StudentFormData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  /**
   * Structured phone. On submit, `phoneField.country` is written to
   * `profiles.country` (ISO-2) and `toE164(phoneField)` to `profiles.phone`.
   */
  phoneField: PhoneFieldValue;
  email: string;
  password: string;
  student_type: StudentTypeUI;
  memorization_level: MemorizationLevel | '';
  /** Gender/age segment (women | men | children). Language is separate. */
  segment: UserSegment;
  /**
   * Language — matches the DB column `language_type` 1:1. This is the
   * single source of truth; no boolean twin exists.
   */
  language_type: LanguageType;
  /** Flexible riwayah — free text or one of RECITATION_OPTIONS ids. */
  recitation: string;
  available_times: string[];
  agreed: boolean;
}

export interface TeacherFormData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  phoneField: PhoneFieldValue;
  email: string;
  password: string;
  preferred_audience: PreferredAudienceUI;
  teaching_experience: string;
  segment: UserSegment;
  /** Language — matches the DB column `language_type` 1:1. */
  language_type: LanguageType;
  /** Number of Quran parts (1..30) the teacher is qualified to teach. */
  quran_parts_taught: string;
  /** Holds a Quran ijazah certification. */
  is_certified: boolean;
  /** Riwayat the teacher is authorized in (free-form strings). */
  authorized_recitations: string[];
  available_times: string[];
  agreed: boolean;
}

/**
 * Volunteer supervisor registration. A deliberately minimal subset of the
 * student/teacher shapes: supervisors are not matched into halaqahs at
 * signup, so there are no time slots, student_type, recitation, or
 * teaching fields. Gender is carried by `segment` (men | women), exactly
 * like the other forms.
 */
export interface SupervisorFormData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  phoneField: PhoneFieldValue;
  email: string;
  password: string;
  /** Gender segment — only men | women for an adult volunteer supervisor. */
  segment: Extract<UserSegment, 'men' | 'women'>;
  agreed: boolean;
}

export interface FormErrors {
  [key: string]: string;
}

export interface StudentRegistrationFormProps {
  className?: string;
}

export interface TeacherRegistrationFormProps {
  className?: string;
}

export interface SupervisorRegistrationFormProps {
  className?: string;
}
