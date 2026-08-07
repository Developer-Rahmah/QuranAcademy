/**
 * audit api — read `public.status_change_audit`.
 *
 * All writes go through `apply_student_status_change` inside the DB
 * (migration 0020) — this file NEVER inserts into the audit table.
 * The RLS policy denies direct writes anyway; keeping the client
 * strictly read-only makes the boundary obvious.
 *
 * Reads use server-side pagination + PostgREST embedded joins to
 * pull the student + actor profiles alongside each audit row in a
 * single round-trip. Filters (source, reason, new_status, date
 * range) push down as `.eq()` / `.gte()` / `.lte()` so pagination
 * counts stay accurate.
 *
 * Free-text search over student name uses PostgREST's `!inner`
 * embedded filter — matching rows are those whose joined student
 * profile hits any of first/second/third_name or email.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';
import type { AccountStatus } from '../../../types';
import type { AuditSource, AuditReason } from '../../audit/constants';

/**
 * One audit row plus the hydrated profiles for the student and
 * the actor (when present). Both joined profiles project only the
 * name / email fields the UI renders — keep the payload small.
 */
export interface StatusChangeAudit {
  id: string;
  student_id: string;
  previous_status: AccountStatus;
  new_status: AccountStatus;
  changed_by: string | null;
  changed_by_role: string | null;
  source: AuditSource;
  reason: AuditReason;
  details: Record<string, unknown>;
  created_at: string;
  student: AuditProfileSlice | null;
  changed_by_profile: AuditProfileSlice | null;
}

export interface AuditProfileSlice {
  id: string;
  first_name: string;
  second_name: string;
  third_name: string;
  email: string;
}

export interface AuditListFilters {
  /** ISO date (YYYY-MM-DD) inclusive lower bound on created_at. */
  from?: string;
  /** ISO date (YYYY-MM-DD) inclusive upper bound on created_at. */
  to?: string;
  source?: AuditSource;
  reason?: AuditReason;
  newStatus?: AccountStatus;
  /**
   * Free-text search across the joined student's names + email.
   * Sanitised of PostgREST-grammar chars so a comma / paren in the
   * query can't fracture the `.or()` clause.
   */
  studentQuery?: string;
}

export interface AuditListParams extends AuditListFilters {
  /** 0-based page index. */
  page: number;
  pageSize: number;
}

export interface AuditListResult {
  rows: StatusChangeAudit[];
  total: number;
  error: PostgrestError | Error | null;
}

/**
 * Fetch a paginated audit page. Never throws — errors flow through
 * the result envelope so callers render a toast without a try/catch.
 */
async function list(params: AuditListParams): Promise<AuditListResult> {
  // `status_change_audit` isn't in the generated Database types.
  // Cast once at this boundary; downstream stays typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  let query = client
    .from('status_change_audit')
    .select(
      // Embedded joins: `!fk_column` disambiguates when a table has
      // multiple FKs to the same target (student_id vs changed_by
      // both point at profiles). `!inner` on the student side would
      // narrow but we want NULL actors (scheduler) to show up too,
      // so student uses !inner (student never null), actor uses left.
      [
        '*',
        'student:profiles!status_change_audit_student_id_fkey(id,first_name,second_name,third_name,email)',
        'changed_by_profile:profiles!status_change_audit_changed_by_fkey(id,first_name,second_name,third_name,email)',
      ].join(','),
      { count: 'exact' },
    )
    .order('created_at', { ascending: false });

  if (params.from) query = query.gte('created_at', params.from);
  if (params.to) {
    // `to` is a date; make the upper bound end-of-day so the filter
    // is inclusive as advertised.
    query = query.lte('created_at', `${params.to}T23:59:59.999Z`);
  }
  if (params.source) query = query.eq('source', params.source);
  if (params.reason) query = query.eq('reason', params.reason);
  if (params.newStatus) query = query.eq('new_status', params.newStatus);

  const q = (params.studentQuery ?? '').trim().replace(/[%,()]/g, '');
  if (q) {
    // Push the search into the embedded student table via a
    // PostgREST `foreignTable` .or() so PostgREST returns only
    // audit rows whose joined student matches.
    query = query.or(
      `first_name.ilike.%${q}%,second_name.ilike.%${q}%,third_name.ilike.%${q}%,email.ilike.%${q}%`,
      { foreignTable: 'student' },
    );
  }

  const from = params.page * params.pageSize;
  const to = from + params.pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    return { rows: [], total: 0, error };
  }
  return {
    rows: (data ?? []) as StatusChangeAudit[],
    total: count ?? 0,
    error: null,
  };
}

/**
 * Quick summary counters for the dashboard widget. One request
 * per counter is fine because each hits an indexed column with
 * a HEAD-only query (`head: true`) so no rows come back — just
 * the count.
 */
export interface AuditQuickStats {
  suspendedToday: number;
  automaticSuspensionsLast7Days: number;
  manualSuspensionsLast7Days: number;
  error: PostgrestError | Error | null;
}

async function quickStats(): Promise<AuditQuickStats> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  const todayStartIso = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();
  const sevenDaysAgoIso = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString();
  })();

  try {
    const [suspendedTodayRes, autoLast7Res, manualLast7Res] = await Promise.all([
      client
        .from('status_change_audit')
        .select('id', { count: 'exact', head: true })
        .eq('new_status', 'suspended')
        .gte('created_at', todayStartIso),
      client
        .from('status_change_audit')
        .select('id', { count: 'exact', head: true })
        .eq('reason', 'automatic_suspension')
        .gte('created_at', sevenDaysAgoIso),
      client
        .from('status_change_audit')
        .select('id', { count: 'exact', head: true })
        .eq('reason', 'manual_suspension')
        .gte('created_at', sevenDaysAgoIso),
    ]);

    return {
      suspendedToday: suspendedTodayRes.count ?? 0,
      automaticSuspensionsLast7Days: autoLast7Res.count ?? 0,
      manualSuspensionsLast7Days: manualLast7Res.count ?? 0,
      error: suspendedTodayRes.error || autoLast7Res.error || manualLast7Res.error || null,
    };
  } catch (err) {
    return {
      suspendedToday: 0,
      automaticSuspensionsLast7Days: 0,
      manualSuspensionsLast7Days: 0,
      error: err as Error,
    };
  }
}

/**
 * Extension-point read: how many active students are approaching
 * automatic suspension. Backed by the `report_policy_evaluation`
 * view from migration 0021.
 *
 * Filters to `reason ∈ {NO_REPORTS_YET, HAS_REPORTS}` so students
 * that are already ineligible (pending, already-suspended, no
 * halaqah, inactive halaqah) never show up as "approaching". Those
 * students have non-actionable `days_until_suspension` values and
 * would otherwise inflate the count.
 *
 * `withinDays` is inclusive: e.g. withinDays=3 → students who will
 * be suspended in 0..3 days.
 */
async function approachingSuspensionCount(
  withinDays: number,
): Promise<{ count: number; error: PostgrestError | Error | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { count, error } = await client
    .from('report_policy_evaluation')
    .select('student_id', { count: 'exact', head: true })
    .in('reason', ['NO_REPORTS_YET', 'HAS_REPORTS'])
    .lte('days_until_suspension', withinDays)
    .gte('days_until_suspension', 0);
  return { count: count ?? 0, error: error ?? null };
}

/**
 * Bucketed classification used by the preview page + the
 * `report_policy_evaluation` view. Kept as an exact enum union so
 * frontend switch statements stay exhaustive.
 */
export const POLICY_EVALUATION_REASONS = [
  'ALREADY_SUSPENDED',
  'PENDING',
  'NO_HALAQAH',
  'INACTIVE_HALAQAH',
  'NO_REPORTS_YET',
  'HAS_REPORTS',
] as const;

export type PolicyEvaluationReason =
  (typeof POLICY_EVALUATION_REASONS)[number];

/**
 * One row of `report_policy_evaluation`. Every field is nullable at
 * the DB level because the view LEFT JOINs — e.g. a student with
 * no halaqah has null halaqah_id / halaqah_name / teacher_name and
 * null reference_date / days_since_reference.
 */
export interface PolicyEvaluationRow {
  student_id: string;
  student_name: string | null;
  student_email: string;
  halaqah_id: string | null;
  halaqah_name: string | null;
  halaqah_status: 'active' | 'paused' | 'completed' | null;
  teacher_id: string | null;
  teacher_name: string | null;
  /**
   * Join date of the student's CURRENT active membership (latest
   * join among active rows). Purely a display / debugging field
   * — the countdown anchor uses `first_joined_at` below.
   */
  joined_halaqah_at: string | null;
  last_report_date: string | null;
  reference_date: string | null;
  days_since_reference: number | null;
  grace_period_days: number | null;
  days_until_suspension: number | null;
  reason: PolicyEvaluationReason;
  will_suspend: boolean;
  /**
   * MIN(joined_at) across ALL of the student's halaqah_members
   * rows regardless of hm.status. This is the countdown anchor
   * for students who have never submitted a report — chosen so
   * transferring the student between halaqahs never resets the
   * grace period. Once the student submits their first report,
   * the reference date switches to `last_report_date` and this
   * field is purely informational.
   */
  first_joined_at: string | null;
}

export interface PreviewSuspensionsParams {
  page: number;
  pageSize: number;
  /**
   * Restrict to a specific classification bucket. Omit for the
   * "would suspend today" default (server-side filters
   * `will_suspend = true`).
   */
  reason?: PolicyEvaluationReason;
  /**
   * `true` (default) → only rows where `will_suspend = true`.
   * `false` → return the whole evaluation set (all reasons),
   * useful for the admin debugging tab.
   */
  onlyWillSuspend?: boolean;
}

export interface PreviewSuspensionsResult {
  rows: PolicyEvaluationRow[];
  total: number;
  error: PostgrestError | Error | null;
}

/**
 * Read-only preview: which students WOULD be suspended today under
 * the current policy? Backs the AdminReportPolicyPreview page and
 * writes NOTHING. The scheduler function is unrelated to this call
 * — the caller can invoke it any number of times without side
 * effects.
 */
async function previewSuspensions(
  params: PreviewSuspensionsParams,
): Promise<PreviewSuspensionsResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  let query = client
    .from('report_policy_evaluation')
    .select('*', { count: 'exact' })
    // Highest days_since_reference first: worst offenders on top so
    // the admin's eye lands on the most urgent cases.
    .order('days_since_reference', { ascending: false, nullsFirst: false });

  if (params.onlyWillSuspend ?? true) {
    query = query.eq('will_suspend', true);
  }
  if (params.reason) {
    query = query.eq('reason', params.reason);
  }

  const from = params.page * params.pageSize;
  const to = from + params.pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    return { rows: [], total: 0, error };
  }
  return {
    rows: (data ?? []) as PolicyEvaluationRow[],
    total: count ?? 0,
    error: null,
  };
}

export const auditApi = {
  list,
  quickStats,
  approachingSuspensionCount,
  previewSuspensions,
};
