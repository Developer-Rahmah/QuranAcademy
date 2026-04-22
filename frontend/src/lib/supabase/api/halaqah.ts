/**
 * halaqah api — typed wrappers around the `halaqahs` and `halaqah_members`
 * tables, plus the joined reads that the dashboard pages need.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import type { Halaqah, HalaqahMember, HalaqahStatus } from '../../../types';

export interface HalaqahsFilters {
  teacherId?: string;
  status?: HalaqahStatus;
}

export interface Result<T> {
  data: T | null;
  error: Error | PostgrestError | null;
}

export interface ListResult<T> {
  data: T[] | null;
  error: Error | PostgrestError | null;
}

const NOT_FOUND_CODE = 'PGRST116';

// --------------- halaqahs ---------------

async function getById(halaqahId: string): Promise<Result<Halaqah>> {
  const { data, error } = await supabase
    .from('halaqahs')
    .select(`
      *,
      teacher:profiles!teacher_id(id, first_name, second_name)
    `)
    .eq('id', halaqahId)
    .single();
  return { data: (data as unknown as Halaqah) ?? null, error };
}

async function list(filters: HalaqahsFilters = {}): Promise<ListResult<Halaqah>> {
  let query = supabase.from('halaqahs').select(`
    *,
    teacher:profiles!teacher_id(id, first_name, second_name)
  `);

  if (filters.teacherId) query = query.eq('teacher_id', filters.teacherId);
  if (filters.status)    query = query.eq('status', filters.status);

  const { data, error } = await query.order('created_at', { ascending: false });
  return { data: (data as unknown as Halaqah[]) ?? null, error };
}

async function create(halaqah: Partial<Halaqah>): Promise<Result<Halaqah>> {
  const { data, error } = await supabase
    .from('halaqahs')
    .insert(halaqah as never)
    .select()
    .single();
  return { data: (data as unknown as Halaqah) ?? null, error };
}

async function update(halaqahId: string, updates: Partial<Halaqah>): Promise<Result<Halaqah>> {
  const { data, error } = await supabase
    .from('halaqahs')
    .update(updates as never)
    .eq('id', halaqahId)
    .select()
    .single();
  return { data: (data as unknown as Halaqah) ?? null, error };
}

async function remove(halaqahId: string): Promise<{ error: Error | PostgrestError | null }> {
  const { error } = await supabase.from('halaqahs').delete().eq('id', halaqahId);
  return { error };
}

// --------------- halaqah_members ---------------

async function membersByHalaqah(halaqahId: string): Promise<ListResult<HalaqahMember>> {
  const { data, error } = await supabase
    .from('halaqah_members')
    .select(`
      *,
      student:profiles!student_id(id, first_name, second_name, phone, email)
    `)
    .eq('halaqah_id', halaqahId)
    .eq('status', 'active');
  return { data: (data as unknown as HalaqahMember[]) ?? null, error };
}

async function membershipForStudent(studentId: string): Promise<Result<HalaqahMember>> {
  const { data, error } = await supabase
    .from('halaqah_members')
    .select(`
      *,
      halaqah:halaqahs(*, teacher:profiles!teacher_id(id, first_name, second_name))
    `)
    .eq('student_id', studentId)
    .eq('status', 'active')
    .maybeSingle();
  return { data: (data as unknown as HalaqahMember) ?? null, error };
}

async function addMember(halaqahId: string, studentId: string): Promise<Result<HalaqahMember>> {
  const { data, error } = await supabase
    .from('halaqah_members')
    .insert({ halaqah_id: halaqahId, student_id: studentId } as never)
    .select()
    .single();
  return { data: (data as unknown as HalaqahMember) ?? null, error };
}

async function removeMember(memberId: string): Promise<{ error: Error | PostgrestError | null }> {
  const { error } = await supabase.from('halaqah_members').delete().eq('id', memberId);
  return { error };
}

export const halaqahApi = {
  getById,
  list,
  create,
  update,
  remove,
  members: {
    byHalaqah: membersByHalaqah,
    forStudent: membershipForStudent,
    add: addMember,
    remove: removeMember,
  },
  NOT_FOUND_CODE,
};
