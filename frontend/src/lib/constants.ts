import type { TimeSlot, Surah, UserRole, StudentType, MemorizationLevel, PreferredAudience, AccountStatus, HalaqahStatus, ReportType } from '../types';

// Total pages in the Quran (Mushaf al-Madinah)
export const TOTAL_QURAN_PAGES = 604;

// Minimum pages for a report entry
export const MIN_PAGES = 0.25;

// User roles
export const ROLES: Record<string, UserRole> = {
  STUDENT: 'student',
  TEACHER: 'teacher',
  ADMIN: 'admin',
};

// Account statuses
export const ACCOUNT_STATUS: Record<string, AccountStatus> = {
  PENDING: 'pending',
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
};

// Halaqah statuses
export const HALAQAH_STATUS: Record<string, HalaqahStatus> = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  COMPLETED: 'completed',
};

// Student types
export const STUDENT_TYPES: Record<string, StudentType> = {
  WOMAN: 'woman',
  CHILD: 'child',
};

// Memorization levels
export const MEMORIZATION_LEVELS: Record<string, MemorizationLevel> = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
};

// Preferred audience (for teachers)
export const PREFERRED_AUDIENCE: Record<string, PreferredAudience> = {
  CHILDREN: 'children',
  WOMEN: 'women',
  BOTH: 'both',
};

// Report types
export const REPORT_TYPES: Record<string, ReportType> = {
  MEMORIZATION: 'memorization',
  REVIEW: 'review',
};

// Available time slots for halaqah sessions
export const TIME_SLOTS: TimeSlot[] = [
  { id: '08-09', label: '8:00 صباحاً - 9:00 صباحاً' },
  { id: '09-10', label: '9:00 صباحاً - 10:00 صباحاً' },
  { id: '10-11', label: '10:00 صباحاً - 11:00 صباحاً' },
  { id: '11-12', label: '11:00 صباحاً - 12:00 ظهراً' },
  { id: '13-14', label: '1:00 ظهراً - 2:00 ظهراً' },
  { id: '14-15', label: '2:00 ظهراً - 3:00 ظهراً' },
  { id: '15-16', label: '3:00 ظهراً - 4:00 ظهراً' },
  { id: '16-17', label: '4:00 ظهراً - 5:00 مساءً' },
  { id: '17-18', label: '5:00 مساءً - 6:00 مساءً' },
  { id: '18-19', label: '6:00 مساءً - 7:00 مساءً' },
  { id: '19-20', label: '7:00 مساءً - 8:00 مساءً' },
  { id: '20-21', label: '8:00 مساءً - 9:00 مساءً' },
];

// List of all Surahs in the Quran
export const SURAHS: Surah[] = [
  { id: 1, name: 'الفاتحة', pages: 1 },
  { id: 2, name: 'البقرة', pages: 48 },
  { id: 3, name: 'آل عمران', pages: 28 },
  { id: 4, name: 'النساء', pages: 29 },
  { id: 5, name: 'المائدة', pages: 22 },
  { id: 6, name: 'الأنعام', pages: 23 },
  { id: 7, name: 'الأعراف', pages: 26 },
  { id: 8, name: 'الأنفال', pages: 10 },
  { id: 9, name: 'التوبة', pages: 20 },
  { id: 10, name: 'يونس', pages: 13 },
  { id: 11, name: 'هود', pages: 14 },
  { id: 12, name: 'يوسف', pages: 13 },
  { id: 13, name: 'الرعد', pages: 7 },
  { id: 14, name: 'إبراهيم', pages: 7 },
  { id: 15, name: 'الحجر', pages: 6 },
  { id: 16, name: 'النحل', pages: 15 },
  { id: 17, name: 'الإسراء', pages: 12 },
  { id: 18, name: 'الكهف', pages: 12 },
  { id: 19, name: 'مريم', pages: 8 },
  { id: 20, name: 'طه', pages: 9 },
  { id: 21, name: 'الأنبياء', pages: 9 },
  { id: 22, name: 'الحج', pages: 10 },
  { id: 23, name: 'المؤمنون', pages: 9 },
  { id: 24, name: 'النور', pages: 10 },
  { id: 25, name: 'الفرقان', pages: 7 },
  { id: 26, name: 'الشعراء', pages: 11 },
  { id: 27, name: 'النمل', pages: 9 },
  { id: 28, name: 'القصص', pages: 11 },
  { id: 29, name: 'العنكبوت', pages: 9 },
  { id: 30, name: 'الروم', pages: 7 },
  { id: 31, name: 'لقمان', pages: 4 },
  { id: 32, name: 'السجدة', pages: 3 },
  { id: 33, name: 'الأحزاب', pages: 10 },
  { id: 34, name: 'سبأ', pages: 7 },
  { id: 35, name: 'فاطر', pages: 6 },
  { id: 36, name: 'يس', pages: 5 },
  { id: 37, name: 'الصافات', pages: 7 },
  { id: 38, name: 'ص', pages: 5 },
  { id: 39, name: 'الزمر', pages: 9 },
  { id: 40, name: 'غافر', pages: 9 },
  { id: 41, name: 'فصلت', pages: 6 },
  { id: 42, name: 'الشورى', pages: 6 },
  { id: 43, name: 'الزخرف', pages: 7 },
  { id: 44, name: 'الدخان', pages: 3 },
  { id: 45, name: 'الجاثية', pages: 4 },
  { id: 46, name: 'الأحقاف', pages: 5 },
  { id: 47, name: 'محمد', pages: 4 },
  { id: 48, name: 'الفتح', pages: 4 },
  { id: 49, name: 'الحجرات', pages: 3 },
  { id: 50, name: 'ق', pages: 3 },
  { id: 51, name: 'الذاريات', pages: 3 },
  { id: 52, name: 'الطور', pages: 3 },
  { id: 53, name: 'النجم', pages: 3 },
  { id: 54, name: 'القمر', pages: 3 },
  { id: 55, name: 'الرحمن', pages: 3 },
  { id: 56, name: 'الواقعة', pages: 3 },
  { id: 57, name: 'الحديد', pages: 4 },
  { id: 58, name: 'المجادلة', pages: 3 },
  { id: 59, name: 'الحشر', pages: 3 },
  { id: 60, name: 'الممتحنة', pages: 2 },
  { id: 61, name: 'الصف', pages: 2 },
  { id: 62, name: 'الجمعة', pages: 1 },
  { id: 63, name: 'المنافقون', pages: 2 },
  { id: 64, name: 'التغابن', pages: 2 },
  { id: 65, name: 'الطلاق', pages: 2 },
  { id: 66, name: 'التحريم', pages: 2 },
  { id: 67, name: 'الملك', pages: 2 },
  { id: 68, name: 'القلم', pages: 2 },
  { id: 69, name: 'الحاقة', pages: 2 },
  { id: 70, name: 'المعارج', pages: 2 },
  { id: 71, name: 'نوح', pages: 2 },
  { id: 72, name: 'الجن', pages: 2 },
  { id: 73, name: 'المزمل', pages: 1 },
  { id: 74, name: 'المدثر', pages: 2 },
  { id: 75, name: 'القيامة', pages: 1 },
  { id: 76, name: 'الإنسان', pages: 2 },
  { id: 77, name: 'المرسلات', pages: 2 },
  { id: 78, name: 'النبأ', pages: 1 },
  { id: 79, name: 'النازعات', pages: 1 },
  { id: 80, name: 'عبس', pages: 1 },
  { id: 81, name: 'التكوير', pages: 1 },
  { id: 82, name: 'الانفطار', pages: 1 },
  { id: 83, name: 'المطففين', pages: 1 },
  { id: 84, name: 'الانشقاق', pages: 1 },
  { id: 85, name: 'البروج', pages: 1 },
  { id: 86, name: 'الطارق', pages: 1 },
  { id: 87, name: 'الأعلى', pages: 1 },
  { id: 88, name: 'الغاشية', pages: 1 },
  { id: 89, name: 'الفجر', pages: 1 },
  { id: 90, name: 'البلد', pages: 1 },
  { id: 91, name: 'الشمس', pages: 1 },
  { id: 92, name: 'الليل', pages: 1 },
  { id: 93, name: 'الضحى', pages: 1 },
  { id: 94, name: 'الشرح', pages: 1 },
  { id: 95, name: 'التين', pages: 1 },
  { id: 96, name: 'العلق', pages: 1 },
  { id: 97, name: 'القدر', pages: 1 },
  { id: 98, name: 'البينة', pages: 1 },
  { id: 99, name: 'الزلزلة', pages: 1 },
  { id: 100, name: 'العاديات', pages: 1 },
  { id: 101, name: 'القارعة', pages: 1 },
  { id: 102, name: 'التكاثر', pages: 1 },
  { id: 103, name: 'العصر', pages: 1 },
  { id: 104, name: 'الهمزة', pages: 1 },
  { id: 105, name: 'الفيل', pages: 1 },
  { id: 106, name: 'قريش', pages: 1 },
  { id: 107, name: 'الماعون', pages: 1 },
  { id: 108, name: 'الكوثر', pages: 1 },
  { id: 109, name: 'الكافرون', pages: 1 },
  { id: 110, name: 'النصر', pages: 1 },
  { id: 111, name: 'المسد', pages: 1 },
  { id: 112, name: 'الإخلاص', pages: 1 },
  { id: 113, name: 'الفلق', pages: 1 },
  { id: 114, name: 'الناس', pages: 1 },
];

// Countries list (Arabic)
export const COUNTRIES: string[] = [
  'المملكة العربية السعودية',
  'الإمارات العربية المتحدة',
  'الكويت',
  'قطر',
  'البحرين',
  'عُمان',
  'مصر',
  'الأردن',
  'فلسطين',
  'لبنان',
  'سوريا',
  'العراق',
  'اليمن',
  'ليبيا',
  'تونس',
  'الجزائر',
  'المغرب',
  'السودان',
  'موريتانيا',
  'جيبوتي',
  'الصومال',
  'جزر القمر',
  'تركيا',
  'إيران',
  'باكستان',
  'أفغانستان',
  'ماليزيا',
  'إندونيسيا',
  'بنغلاديش',
  'الهند',
  'بريطانيا',
  'فرنسا',
  'ألمانيا',
  'الولايات المتحدة',
  'كندا',
  'أستراليا',
  'أخرى',
];

// Arabic labels for roles
export const ROLE_LABELS: Record<UserRole, string> = {
  student: 'طالبة',
  teacher: 'معلمة',
  admin: 'مدير النظام',
};

// Arabic labels for student types
export const STUDENT_TYPE_LABELS: Record<StudentType, string> = {
  woman: 'امرأة',
  child: 'طفل',
};

// Arabic labels for memorization levels
export const LEVEL_LABELS: Record<MemorizationLevel, string> = {
  beginner: 'مبتدئة',
  intermediate: 'متوسطة',
  advanced: 'متقدمة',
};

// Arabic labels for preferred audience
export const AUDIENCE_LABELS: Record<PreferredAudience, string> = {
  children: 'أطفال',
  women: 'نساء',
  both: 'كلاهما',
};

// Arabic labels for report types
export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  memorization: 'حفظ',
  review: 'مراجعة',
};

// Arabic labels for status
export const STATUS_LABELS: Record<AccountStatus, string> = {
  pending: 'معلقة',
  active: 'نشطة',
  suspended: 'موقوفة',
};

// Arabic labels for halaqah status
export const HALAQAH_STATUS_LABELS: Record<HalaqahStatus, string> = {
  active: 'نشطة',
  paused: 'متوقفة مؤقتاً',
  completed: 'مكتملة',
};
