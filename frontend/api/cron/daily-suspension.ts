/**
 * Vercel Cron endpoint — daily student-suspension trigger.
 *
 * Wiring:
 *   • `frontend/vercel.json` schedules this URL once a day.
 *   • Vercel sends `Authorization: Bearer $CRON_SECRET` when it
 *     invokes a cron job — the env-var value is injected verbatim.
 *   • This handler validates that header, initialises a
 *     server-only Supabase client with the service-role key, and
 *     calls the `run_daily_student_suspension` RPC (migration 0021).
 *
 * The RPC contains ALL the business logic — this endpoint is the
 * dumb trigger. Never expand the logic here; every rule (policy
 * enabled, grace period, per-student iteration, audit writes) is
 * enforced in the database.
 *
 * Environment variables (set on Vercel):
 *   CRON_SECRET                  — random secret; Vercel Cron
 *                                   sends it as `Authorization: Bearer`
 *   SUPABASE_URL                 — same URL as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY    — Supabase service-role key (server only)
 *
 * All three MUST be set — the handler fails closed with 500 if any
 * are missing so a misconfigured deploy is loud, not silent.
 *
 * Idempotency: the DB function is idempotent (no-op on unchanged
 * status, one audit row per real transition). Vercel may retry this
 * endpoint on failure without producing duplicate suspensions.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Vercel Cron sends GET on a scheduled fire. Reject anything else
 * so this URL cannot be abused as a mutation trigger over the wire
 * — even with the CRON_SECRET, GET is the only accepted verb.
 */
const ALLOWED_METHOD = 'GET';

/**
 * Shape returned by `run_daily_student_suspension()` (0021). Kept
 * loose — new fields would be forward-compatible.
 */
interface ScheduleRunResult {
  processed: number;
  suspended: number;
  skipped: number;
  enabled: boolean;
  grace_period: number | null;
  run_at: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== ALLOWED_METHOD) {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }

  // ---------------- 1. Auth ----------------------------------------
  // Vercel Cron injects `Authorization: Bearer <CRON_SECRET>`.
  // Fail closed on any mismatch so a leaked URL alone isn't enough
  // to trigger suspensions.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Misconfiguration should be LOUD, not silent — emitting 500
    // means the Vercel Cron log flags the failure.
    res.status(500).json({ ok: false, error: 'missing_cron_secret' });
    return;
  }
  const authHeader = req.headers['authorization'];
  const expected = `Bearer ${cronSecret}`;
  if (authHeader !== expected) {
    res.status(401).json({ ok: false, error: 'unauthorized' });
    return;
  }

  // ---------------- 2. Supabase client -----------------------------
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ ok: false, error: 'missing_supabase_env' });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Never persist or refresh — this is a single-shot server call.
      // Persistence pulls in localStorage-like behaviour that
      // doesn't exist in a Vercel function anyway.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  // ---------------- 3. Invoke the scheduler RPC --------------------
  const rpcResult = await supabase.rpc('run_daily_student_suspension');
  const { data, error } = rpcResult as {
    data: ScheduleRunResult | null;
    error: { message: string } | null;
  };

  if (error) {
    // Return 500 so Vercel logs the failure and retries per its
    // default schedule. The DB function is idempotent, so a retry
    // is safe.
    res.status(500).json({ ok: false, error: error.message });
    return;
  }

  res.status(200).json({ ok: true, result: data });
}

/**
 * Serverless function config — pin to the Node.js runtime so
 * `@vercel/node` types resolve correctly and `@supabase/supabase-js`
 * runs against the standard fetch runtime.
 */
export const config = {
  runtime: 'nodejs20.x',
} as const;
