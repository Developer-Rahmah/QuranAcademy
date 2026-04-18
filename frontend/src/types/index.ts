// ============================================
// Type Definitions for Quran Academy
// ============================================

// Database Enums
export type UserRole = 'student' | 'teacher' | 'admin';
export type StudentType = 'woman' | 'child';
export type MemorizationLevel = 'beginner' | 'intermediate' | 'advanced';
export type PreferredAudience = 'children' | 'women' | 'both';
export type AccountStatus = 'pending' | 'active' | 'suspended';
export type HalaqahStatus = 'active' | 'paused' | 'completed';
export type ReportType = 'memorization' | 'review';

// Profile
export interface Profile {
  id: string;
  email: string;
  first_name: string;
  second_name: string;
  third_name: string;
  phone: string;
  age?: number;
  country?: string;
  role: UserRole;
  student_type?: StudentType;
  memorization_level?: MemorizationLevel;
  teaching_experience?: string;
  preferred_audience?: PreferredAudience;
  available_times: string[];
  status: AccountStatus;
  created_at: string;
  updated_at: string;
}

// Halaqah
export interface Halaqah {
  id: string;
  name: string;
  teacher_id?: string;
  teacher?: Pick<Profile, 'id' | 'first_name' | 'second_name'>;
  meet_link?: string;
  level?: MemorizationLevel;
  target_audience?: StudentType;
  schedule?: Record<string, unknown>;
  status: HalaqahStatus;
  created_at: string;
  updated_at: string;
  // Computed fields
  studentCount?: number;
  avgProgress?: number;
}

// Halaqah Member
export interface HalaqahMember {
  id: string;
  halaqah_id: string;
  student_id: string;
  student?: Pick<Profile, 'id' | 'first_name' | 'second_name' | 'phone' | 'email'>;
  halaqah?: Halaqah;
  joined_at: string;
  status: AccountStatus;
}

// Report
export interface Report {
  id: string;
  student_id: string;
  halaqah_id: string;
  report_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: ReportItem[];
  student?: Pick<Profile, 'id' | 'first_name' | 'second_name'>;
}

// Report Item
export interface ReportItem {
  id: string;
  report_id: string;
  surah_name: string;
  pages: number;
  type: ReportType;
  created_at: string;
}

// Student with Progress
export interface StudentWithProgress extends Pick<Profile, 'id' | 'first_name' | 'second_name'> {
  memorizationPages: number;
  reviewPages: number;
  progress: number;
}

// Progress Stats
export interface ProgressStats {
  memorization: number;
  review: number;
  progress: number;
}

// Academy Stats
export interface AcademyStats {
  totalStudents: number;
  totalTeachers: number;
  totalHalaqahs: number;
}

// Time Slot
export interface TimeSlot {
  id: string;
  label: string;
}

// Surah
export interface Surah {
  id: number;
  name: string;
  pages: number;
}

// Form Data Types
export interface StudentRegistrationData {
  first_name: string;
  second_name: string;
  third_name: string;
  age: string;
  country: string;
  phone: string;
  email: string;
  password: string;
  student_type: StudentType;
  memorization_level: string;
  available_times: string[];
  agreed: boolean;
}

export interface TeacherRegistrationData {
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

export interface LoginData {
  email: string;
  password: string;
}

// Report Form Types
export interface ReportItemFormData {
  id: string;
  surah_name: string;
  pages: string;
}

// Component Props Types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'full';
  loading?: boolean;
  children: React.ReactNode;
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value'> {
  options: SelectOption[];
  error?: boolean;
  value?: string;
}

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline' | 'muted';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export interface CardProps {
  variant?: 'default' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export interface ProgressBarProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

export interface IconProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Auth Context Types
export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signUp: (email: string, password: string, profileData: Partial<Profile>) => Promise<AuthResult>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<AuthResult>;
  updatePassword: (password: string) => Promise<AuthResult>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ data: Profile | null; error: Error | null }>;
  refreshProfile: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  isAdmin: () => boolean;
  isTeacher: () => boolean;
  isStudent: () => boolean;
  isAuthenticated: boolean;
  isActive: boolean;
  isRecoverySession: boolean;
}

export interface User {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface AuthResult {
  data: unknown;
  error: Error | null;
}

// Supabase Response Types
export interface SupabaseResponse<T> {
  data: T | null;
  error: Error | null;
}
