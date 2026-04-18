import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { Profile, Halaqah, HalaqahMember, Report, ReportItem, ProgressStats, AcademyStats } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Auth helper functions
export const auth = {
  // Sign up with email and password
  signUp: async (email: string, password: string, metadata: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
    return { data, error };
  },

  // Sign in with email and password
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  // Get current session
  getSession: async (): Promise<{ session: Session | null; error: Error | null }> => {
    const { data: { session }, error } = await supabase.auth.getSession();
    return { session, error };
  },

  // Get current user
  getUser: async (): Promise<{ user: User | null; error: Error | null }> => {
    const { data: { user }, error } = await supabase.auth.getUser();
    return { user, error };
  },

  // Reset password
  resetPassword: async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { data, error };
  },

  // Listen to auth state changes
  onAuthStateChange: (callback: (event: string, session: Session | null) => void) => {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// Database helper functions
export const db = {
  // Profiles
  profiles: {
    get: async (userId: string): Promise<{ data: Profile | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      return { data, error };
    },

    create: async (profile: Partial<Profile>): Promise<{ data: Profile | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('profiles')
        .insert(profile)
        .select()
        .single();
      return { data, error };
    },

    update: async (userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
      return { data, error };
    },

    getAll: async (filters: { role?: string; status?: string } = {}): Promise<{ data: Profile[] | null; error: Error | null }> => {
      let query = supabase.from('profiles').select('*');

      if (filters.role) {
        query = query.eq('role', filters.role);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      return { data, error };
    },
  },

  // Halaqahs
  halaqahs: {
    get: async (halaqahId: string): Promise<{ data: Halaqah | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqahs')
        .select(`
          *,
          teacher:profiles!teacher_id(id, first_name, second_name)
        `)
        .eq('id', halaqahId)
        .single();
      return { data, error };
    },

    getAll: async (filters: { teacherId?: string; status?: string } = {}): Promise<{ data: Halaqah[] | null; error: Error | null }> => {
      let query = supabase.from('halaqahs').select(`
        *,
        teacher:profiles!teacher_id(id, first_name, second_name)
      `);

      if (filters.teacherId) {
        query = query.eq('teacher_id', filters.teacherId);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      return { data, error };
    },

    create: async (halaqah: Partial<Halaqah>): Promise<{ data: Halaqah | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqahs')
        .insert(halaqah)
        .select()
        .single();
      return { data, error };
    },

    update: async (halaqahId: string, updates: Partial<Halaqah>): Promise<{ data: Halaqah | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqahs')
        .update(updates)
        .eq('id', halaqahId)
        .select()
        .single();
      return { data, error };
    },

    delete: async (halaqahId: string): Promise<{ error: Error | null }> => {
      const { error } = await supabase
        .from('halaqahs')
        .delete()
        .eq('id', halaqahId);
      return { error };
    },
  },

  // Halaqah Members
  members: {
    getByHalaqah: async (halaqahId: string): Promise<{ data: HalaqahMember[] | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqah_members')
        .select(`
          *,
          student:profiles!student_id(id, first_name, second_name, phone, email)
        `)
        .eq('halaqah_id', halaqahId)
        .eq('status', 'active');
      return { data, error };
    },

    getByStudent: async (studentId: string): Promise<{ data: HalaqahMember | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqah_members')
        .select(`
          *,
          halaqah:halaqahs(*, teacher:profiles!teacher_id(id, first_name, second_name))
        `)
        .eq('student_id', studentId)
        .eq('status', 'active')
        .single();
      return { data, error };
    },

    add: async (halaqahId: string, studentId: string): Promise<{ data: HalaqahMember | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('halaqah_members')
        .insert({ halaqah_id: halaqahId, student_id: studentId })
        .select()
        .single();
      return { data, error };
    },

    remove: async (memberId: string): Promise<{ error: Error | null }> => {
      const { error } = await supabase
        .from('halaqah_members')
        .delete()
        .eq('id', memberId);
      return { error };
    },
  },

  // Reports
  reports: {
    getByStudent: async (studentId: string, limit: number = 10): Promise<{ data: Report[] | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          items:report_items(*)
        `)
        .eq('student_id', studentId)
        .order('report_date', { ascending: false })
        .limit(limit);
      return { data, error };
    },

    getByHalaqah: async (halaqahId: string, limit: number = 50): Promise<{ data: Report[] | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          *,
          student:profiles!student_id(id, first_name, second_name),
          items:report_items(*)
        `)
        .eq('halaqah_id', halaqahId)
        .order('report_date', { ascending: false })
        .limit(limit);
      return { data, error };
    },

    create: async (report: Partial<Report>): Promise<{ data: Report | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('reports')
        .insert(report)
        .select()
        .single();
      return { data, error };
    },

    addItem: async (item: Partial<ReportItem>): Promise<{ data: ReportItem | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('report_items')
        .insert(item)
        .select()
        .single();
      return { data, error };
    },

    addItems: async (items: Partial<ReportItem>[]): Promise<{ data: ReportItem[] | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('report_items')
        .insert(items)
        .select();
      return { data, error };
    },
  },

  // Statistics
  stats: {
    getStudentProgress: async (studentId: string): Promise<{ data: ProgressStats | null; error: Error | null }> => {
      const { data, error } = await supabase
        .from('report_items')
        .select(`
          type,
          pages,
          report:reports!inner(student_id)
        `)
        .eq('report.student_id', studentId);

      if (error) return { data: null, error };

      const items = data as unknown as Array<{ type: string; pages: number }>;

      const memorization = items
        .filter(item => item.type === 'memorization')
        .reduce((sum, item) => sum + parseFloat(String(item.pages)), 0);

      const review = items
        .filter(item => item.type === 'review')
        .reduce((sum, item) => sum + parseFloat(String(item.pages)), 0);

      return {
        data: {
          memorization,
          review,
          progress: Math.round((memorization / 604) * 100 * 100) / 100,
        },
        error: null,
      };
    },

    getAcademyStats: async (): Promise<{ data: AcademyStats; error: Error | null }> => {
      const [studentsRes, teachersRes, halaqahsRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student').eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'teacher').eq('status', 'active'),
        supabase.from('halaqahs').select('id', { count: 'exact' }).eq('status', 'active'),
      ]);

      return {
        data: {
          totalStudents: studentsRes.count || 0,
          totalTeachers: teachersRes.count || 0,
          totalHalaqahs: halaqahsRes.count || 0,
        },
        error: studentsRes.error || teachersRes.error || halaqahsRes.error,
      };
    },
  },
};
