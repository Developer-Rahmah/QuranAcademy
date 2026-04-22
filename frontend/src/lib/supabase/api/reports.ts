/**
 * reports api — typed wrappers around `reports`, `report_items`, and
 * derived statistics.
 *
 * NOTE: `stats.studentProgress` still aggregates client-side for now. This
 * matches the prior behavior so no UI breaks. A later task will move it
 * behind a Postgres RPC.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import type {
  Report,
  ReportItem,
  ProgressStats,
  AcademyStats,
} from '../../../types';
import { TOTAL_QURAN_PAGES } from '../../constants';

interface Result<T> {
  data: T | null;
  error: Error | PostgrestError | null;
}
interface ListResult<T> {
  data: T[] | null;
  error: Error | PostgrestError | null;
}

// --------------- reports ---------------

async function byStudent(studentId: string, limit = 10): Promise<ListResult<Report>> {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      items:report_items(*)
    `)
    .eq('student_id', studentId)
    .order('report_date', { ascending: false })
    .limit(limit);
  return { data: (data as unknown as Report[]) ?? null, error };
}

async function byHalaqah(halaqahId: string, limit = 50): Promise<ListResult<Report>> {
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
  return { data: (data as unknown as Report[]) ?? null, error };
}

async function create(report: Partial<Report>): Promise<Result<Report>> {
  const { data, error } = await supabase
    .from('reports')
    .insert(report as never)
    .select()
    .single();
  return { data: (data as unknown as Report) ?? null, error };
}

async function addItem(item: Partial<ReportItem>): Promise<Result<ReportItem>> {
  const { data, error } = await supabase
    .from('report_items')
    .insert(item as never)
    .select()
    .single();
  return { data: (data as unknown as ReportItem) ?? null, error };
}

async function addItems(items: Partial<ReportItem>[]): Promise<ListResult<ReportItem>> {
  const { data, error } = await supabase
    .from('report_items')
    .insert(items as never)
    .select();
  return { data: (data as unknown as ReportItem[]) ?? null, error };
}

// --------------- stats ---------------

async function studentProgress(studentId: string): Promise<Result<ProgressStats>> {
  const { data, error } = await supabase
    .from('report_items')
    .select(`
      type,
      pages,
      report:reports!inner(student_id)
    `)
    .eq('report.student_id', studentId);

  if (error) return { data: null, error };

  const items = (data ?? []) as unknown as Array<{ type: string; pages: number }>;

  const memorization = items
    .filter((item) => item.type === 'memorization')
    .reduce((sum, item) => sum + parseFloat(String(item.pages)), 0);

  const review = items
    .filter((item) => item.type === 'review')
    .reduce((sum, item) => sum + parseFloat(String(item.pages)), 0);

  return {
    data: {
      memorization,
      review,
      progress: Math.round((memorization / TOTAL_QURAN_PAGES) * 100 * 100) / 100,
    },
    error: null,
  };
}

async function academyStats(): Promise<Result<AcademyStats>> {
  const [studentsRes, teachersRes, halaqahsRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'student').eq('status', 'active'),
    supabase.from('profiles').select('id', { count: 'exact' }).eq('role', 'teacher').eq('status', 'active'),
    supabase.from('halaqahs').select('id', { count: 'exact' }).eq('status', 'active'),
  ]);

  return {
    data: {
      totalStudents:  studentsRes.count  || 0,
      totalTeachers:  teachersRes.count  || 0,
      totalHalaqahs:  halaqahsRes.count  || 0,
    },
    error: studentsRes.error || teachersRes.error || halaqahsRes.error,
  };
}

export const reportsApi = {
  byStudent,
  byHalaqah,
  create,
  addItem,
  addItems,
  stats: {
    studentProgress,
    academyStats,
  },
};
