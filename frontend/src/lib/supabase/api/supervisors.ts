/**
 * supervisors api — `halaqah_supervisors` join table.
 *
 * `halaqah_supervisor` is a RELATIONAL role: a user becomes a supervisor
 * of a specific halaqah by inserting a row here, NOT by overwriting their
 * `profiles.role`. So a student can simultaneously be a supervisor of one
 * halaqah and continue to be a student in their assigned halaqah; their
 * profile.role stays `'student'`.
 *
 * This module is the only place that touches the `halaqah_supervisors`
 * table. RLS (migration 0009) restricts:
 *   - read: any authenticated user can read their own supervisor rows;
 *           admin / supervisor_manager can read all;
 *   - write: admin / supervisor_manager only.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import { withTimeout } from '../withTimeout';

/**
 * Row shape — matches `halaqah_supervisors` columns. The `user_id` /
 * `halaqah_id` UNIQUE constraint prevents duplicate assignments at the
 * DB level; the api layer also short-circuits with the same intent.
 */
export interface HalaqahSupervisorRow {
  id: string;
  user_id: string;
  halaqah_id: string;
  created_at: string;
}

/**
 * Joined shape used by the "Halaqah supervisors" list — pulls the basic
 * profile fields needed to render a row.
 */
export interface HalaqahSupervisorWithProfile extends HalaqahSupervisorRow {
  user?: {
    id: string;
    first_name: string;
    second_name: string;
    third_name?: string;
    email: string;
  } | null;
}

interface ListResult<T> {
  data: T[] | null;
  error: Error | PostgrestError | null;
}

interface OneResult<T> {
  data: T | null;
  error: Error | PostgrestError | null;
}

// ---------------------------------------------------------------------

/**
 * All supervisors for a given halaqah (joined with profile basics).
 * Used by the "المشرفون على الحلقة" list and to gate the per-student
 * assign/remove button.
 */
async function listByHalaqah(halaqahId: string): Promise<ListResult<HalaqahSupervisorWithProfile>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client
    .from('halaqah_supervisors')
    .select('*, user:profiles!user_id(id, first_name, second_name, third_name, email)')
    .eq('halaqah_id', halaqahId);
  return { data: (data as HalaqahSupervisorWithProfile[]) ?? null, error };
}

/**
 * All halaqahs supervised by a given user. Used by the post-login picker
 * for `halaqah_supervisor` accounts.
 */
async function listByUser(userId: string): Promise<ListResult<HalaqahSupervisorRow>> {
  // Strict validation per spec — the supervisor data flow is fragile if
  // empty/falsy ids slip through, so we hard-fail rather than issue a
  // query that would return every row's match against an undefined id.
  if (!userId) {
    console.error('listByUser called without userId');
    return { data: null, error: new Error('Invalid userId') };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  console.log('FETCH SUPERVISOR ASSIGNMENTS START', userId);

  // Hard timeout — production saw the dashboard hang for ~30s on this
  // query when supabase-js silently stalled. We'd rather the user see
  // an empty supervisor state immediately than block the whole
  // dashboard render behind a hung fetch.
  let data: HalaqahSupervisorRow[] | null = null;
  let error: PostgrestError | Error | null = null;
  try {
    const queryPromise: Promise<{
      data: unknown;
      error: PostgrestError | null;
    }> = Promise.resolve(
      client.from('halaqah_supervisors').select('*').eq('user_id', userId),
    );
    const res = await withTimeout(
      queryPromise,
      5000,
      `supervisors.listByUser(${userId})`,
    );
    data = (res.data as HalaqahSupervisorRow[]) ?? null;
    error = res.error;
  } catch (err) {
    error = err as Error;
  }

  console.log('FETCH RESULT', { data, error });

  if (error) {
    console.error('FETCH SUPERVISOR ASSIGNMENTS ERROR', error);
  }

  return { data, error };
}

/**
 * Add a (user_id, halaqah_id) supervisor row.
 *
 * This path was historically failing silently. The hardened version:
 *
 *   1. Logs the inputs at start (`ASSIGN SUPERVISOR START`).
 *   2. Pre-checks for an existing row to stay idempotent.
 *   3. Uses the explicit array form `insert([{...}])` per the spec —
 *      and `.select()` so PostgREST returns the inserted row, which
 *      forces RLS errors to surface instead of being swallowed.
 *   4. Logs the raw `{ data, error }` result (`ASSIGN RESULT`).
 *   5. THROWS a real Error on failure so the caller can toast a real
 *      message — no silent `{ data: null, error: null }` returns.
 *   6. After a successful insert, runs a verification SELECT and logs
 *      it (`VERIFY INSERT`) so we have proof in the browser console
 *      that the row landed.
 *
 * Returns the inserted (or pre-existing) row. Caller is expected to
 * try/catch around it and toast the error.message.
 */
async function assign(
  userId: string,
  halaqahId: string,
): Promise<OneResult<HalaqahSupervisorRow>> {
  // Hard-fail on missing inputs — these are the silent-bug magnet.
  if (!userId) {
    console.error('assign() called without userId');
    throw new Error('Invalid userId');
  }
  if (!halaqahId) {
    console.error('assign() called without halaqahId');
    throw new Error('Invalid halaqahId');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  console.log('ASSIGN SUPERVISOR START', { userId, halaqahId });

  // Idempotent pre-check.
  const existing = await client
    .from('halaqah_supervisors')
    .select('id')
    .eq('user_id', userId)
    .eq('halaqah_id', halaqahId)
    .maybeSingle();
  if (existing?.data?.id) {
    console.log('ASSIGN SUPERVISOR — already exists', existing.data);
    return { data: existing.data as HalaqahSupervisorRow, error: null };
  }

  // Explicit array form per spec. `.select().single()` forces PostgREST
  // to return the inserted row, which means an RLS denial bubbles up as
  // a real error rather than an empty success.
  const { data, error } = await client
    .from('halaqah_supervisors')
    .insert([{ user_id: userId, halaqah_id: halaqahId }])
    .select()
    .single();

  console.log('ASSIGN RESULT', { data, error });

  if (error) {
    console.error('SUPERVISOR ASSIGN ERROR', error);
    throw new Error(error.message);
  }

  // Verification — fetch the row(s) for this user immediately after.
  // Useful when debugging RLS: a missing row here while `error` was
  // null is the smoking gun for a silent policy block.
  const { data: check } = await client
    .from('halaqah_supervisors')
    .select('*')
    .eq('user_id', userId);
  console.log('VERIFY INSERT', check);

  return { data: (data as HalaqahSupervisorRow) ?? null, error: null };
}

/** Remove a (user_id, halaqah_id) supervisor row. */
async function remove(
  userId: string,
  halaqahId: string,
): Promise<{ error: Error | PostgrestError | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { error } = await client
    .from('halaqah_supervisors')
    .delete()
    .eq('user_id', userId)
    .eq('halaqah_id', halaqahId);
  return { error };
}

export const supervisorsApi = {
  listByHalaqah,
  listByUser,
  assign,
  remove,
};
