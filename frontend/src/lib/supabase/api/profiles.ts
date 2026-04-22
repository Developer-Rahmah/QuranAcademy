/**
 * profiles api — typed wrappers around the `profiles` table.
 *
 * `getById` owns the retry loop for the post-signup window where the
 * `handle_new_user` trigger hasn't yet materialized the row. Callers just
 * `await` it — AuthContext stays simple.
 *
 * RLS-recursion errors (`42P17`) are treated as fatal: retrying doesn't help
 * and masks policy bugs, so we return immediately so the caller can surface a
 * real error.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import type { Profile, UserRole, AccountStatus } from '../../../types';

export interface ProfilesFilters {
  role?: UserRole;
  status?: AccountStatus;
}

export interface Result<T> {
  data: T | null;
  error: Error | PostgrestError | null;
}

export interface ListResult<T> {
  data: T[] | null;
  error: Error | PostgrestError | null;
}

const RLS_RECURSION_CODE = '42P17';
const NOT_FOUND_CODE = 'PGRST116';

export interface GetProfileOptions {
  /** Max attempts (default 3). `1` disables retry. */
  retries?: number;
  /** Delay between attempts in ms (default 500). */
  delayMs?: number;
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a profile row by id.
 *
 * Retries only for the "row not yet created" case — after signup there's a
 * small window while the `handle_new_user` trigger runs. Hard errors (RLS
 * recursion, network, auth) short-circuit immediately.
 */
async function getById(
  userId: string,
  { retries = 3, delayMs = 500 }: GetProfileOptions = {},
): Promise<Result<Profile>> {
  if (!userId) {
    return { data: null, error: new Error('profiles.getById called without userId') };
  }

  const attempts = Math.max(1, retries);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Fatal: RLS recursion won't resolve by retrying.
      if ((error as PostgrestError).code === RLS_RECURSION_CODE) {
        return { data: null, error };
      }
      // Fatal network/auth errors — bail after the last attempt.
      if (attempt === attempts) {
        return { data: null, error };
      }
      await wait(delayMs);
      continue;
    }

    if (data) {
      return { data: data as unknown as Profile, error: null };
    }

    // No row yet — might be a trigger race. Retry unless last attempt.
    if (attempt === attempts) {
      return { data: null, error: null };
    }
    await wait(delayMs);
  }

  return { data: null, error: null };
}

async function list(filters: ProfilesFilters = {}): Promise<ListResult<Profile>> {
  let query = supabase.from('profiles').select('*');
  if (filters.role)   query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);
  const { data, error } = await query.order('created_at', { ascending: false });
  return { data: (data as unknown as Profile[]) ?? null, error };
}

async function create(profile: Partial<Profile>): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    // The supabase-js types require a full Insert object; our domain layer
    // supplies Partial<Profile>. Cast once at the boundary.
    .insert(profile as never)
    .select()
    .single();
  return { data: (data as unknown as Profile) ?? null, error };
}

async function update(userId: string, updates: Partial<Profile>): Promise<Result<Profile>> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates as never)
    .eq('id', userId)
    .select()
    .single();
  return { data: (data as unknown as Profile) ?? null, error };
}

export const profilesApi = {
  getById,
  list,
  create,
  update,
  NOT_FOUND_CODE,
};
