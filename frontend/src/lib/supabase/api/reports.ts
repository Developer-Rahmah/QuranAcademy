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

/**
 * Get a single report (with its items) by id.
 *
 * Used by the edit page to pre-fill the form. RLS already restricts
 * SELECT to the report's owner / their teacher / admin, so a hostile
 * id leaks nothing extra.
 */
async function byId(reportId: string): Promise<Result<Report>> {
  const { data, error } = await supabase
    .from('reports')
    .select(`
      *,
      items:report_items(*)
    `)
    .eq('id', reportId)
    .maybeSingle();
  return { data: (data as unknown as Report) ?? null, error };
}

/**
 * Update a report row (date / notes). Items are managed separately
 * via `replaceItems`.
 *
 * RLS (0014_reports_owner_edit_delete) caps `report_date` at
 * CURRENT_DATE for non-admins, so the DB will reject any future-dated
 * payload regardless of what the client sends.
 */
async function update(
  reportId: string,
  patch: Partial<Pick<Report, 'report_date' | 'notes'>>,
): Promise<Result<Report>> {
  const { data, error } = await supabase
    .from('reports')
    .update(patch as never)
    .eq('id', reportId)
    .select()
    .single();
  return { data: (data as unknown as Report) ?? null, error };
}

/**
 * Replace ALL items of a report with the supplied list.
 *
 * Implemented as delete-then-insert because the form treats items as a
 * value-object set (no stable client ids). Both ops run under the
 * student's session — RLS (0014) authorises both.
 *
 * Items are wrapped in `report_id` here so the caller doesn't have to
 * re-thread it through every map.
 */
async function replaceItems(
  reportId: string,
  items: Array<Pick<ReportItem, 'surah_name' | 'pages' | 'type'>>,
): Promise<ListResult<ReportItem>> {
  const { error: deleteError } = await supabase
    .from('report_items')
    .delete()
    .eq('report_id', reportId);
  if (deleteError) return { data: null, error: deleteError };

  if (items.length === 0) {
    return { data: [], error: null };
  }

  const payload = items.map((item) => ({ ...item, report_id: reportId }));
  const { data, error } = await supabase
    .from('report_items')
    .insert(payload as never)
    .select();
  return { data: (data as unknown as ReportItem[]) ?? null, error };
}

/**
 * Delete a report row. Items cascade via FK ON DELETE CASCADE.
 */
async function remove(reportId: string): Promise<Result<null>> {
  const { error } = await supabase
    .from('reports')
    .delete()
    .eq('id', reportId);
  return { data: null, error };
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
  byId,
  create,
  update,
  remove,
  addItem,
  addItems,
  replaceItems,
  stats: {
    studentProgress,
    academyStats,
  },
};
