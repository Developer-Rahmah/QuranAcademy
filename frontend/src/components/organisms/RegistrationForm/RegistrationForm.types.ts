/**
 * RegistrationForm Component Types
 */
import type { StudentType, MemorizationLevel, PreferredAudience } from '../../../types';

export interface StudentFormData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  student_type: StudentType;
  memorization_level: MemorizationLevel | '';
  available_times: string[];
  agreed: boolean;
}

export interface TeacherFormData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  preferred_audience: PreferredAudience;
  teaching_experience: string;
  available_times: string[];
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
