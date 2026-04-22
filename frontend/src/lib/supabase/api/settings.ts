/**
 * settings api — read + write `public.settings` (single row, id=1).
 *
 * Column contract (canonical, matches production):
 *   - academy_name_ar
 *   - academy_name_en
 *   - academy_description_ar
 *   - academy_description_en
 *   - facebook_url
 *   - instagram_url
 *   - whatsapp_number
 *   - email
 *
 * Legacy `contact_*` column names have been retired — this module never
 * reads or writes them. Any field that comes back null is normalized to
 * an empty string so callers can render without null-checks crashing.
 *
 * Never throws on RLS/network errors; returns an empty map.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../client';

/**
 * Flat frontend-facing map. Keys match the DB columns 1:1, which keeps
 * the bridge between the form, the api, and the DB trivial.
 */
export interface SettingsMap {
  facebook_url?: string;
  instagram_url?: string;
  whatsapp_number?: string;
  email?: string;
  academy_name_ar?: string;
  academy_name_en?: string;
  academy_description_ar?: string;
  academy_description_en?: string;
}

const KNOWN_KEYS: ReadonlyArray<keyof SettingsMap> = [
  'facebook_url',
  'instagram_url',
  'whatsapp_number',
  'email',
  'academy_name_ar',
  'academy_name_en',
  'academy_description_ar',
  'academy_description_en',
];

type AnyRow = Record<string, unknown>;

function isKeyValueRow(row: AnyRow): boolean {
  return typeof row.key === 'string' && 'value' in row;
}

/**
 * Backward-safe stringifier: nulls and unknown types collapse to ''.
 * Primitives and JSONB-scalar strings are preserved.
 */
function safeString(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    try {
      const parsed = JSON.parse(JSON.stringify(v));
      if (typeof parsed === 'string') return parsed;
    } catch {
      /* ignore */
    }
  }
  return '';
}

/**
 * Read, normalize, and return the current settings map. Missing rows/columns
 * or RLS failures all yield `{}`. Individual null columns collapse to ''.
 *
 * The table is expected to hold at most one row (singleton settings). We
 * never filter by id here — id is a UUID on the production schema, so
 * hardcoding '1' would blow up. `.limit(1)` plus first-row selection is
 * enough.
 */
async function load(): Promise<SettingsMap> {
  // `settings` isn't in the generated Database types (pre-existing table),
  // so cast the client once at this boundary.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;
  const { data, error } = await client.from('settings').select('*');
  if (error || !data || !Array.isArray(data) || data.length === 0) return {};

  const rows = data as AnyRow[];
  const out: SettingsMap = {};

  if (rows.every(isKeyValueRow)) {
    // Key/value shape — one setting per row. Only recognize canonical keys.
    for (const row of rows) {
      const key = row.key as string;
      if ((KNOWN_KEYS as readonly string[]).includes(key)) {
        out[key as keyof SettingsMap] = safeString(row.value);
      }
    }
    return out;
  }

  // Single-row shape. Settings is a singleton, so just take the first row.
  const canonical = rows[0];

  for (const k of KNOWN_KEYS) {
    out[k] = safeString(canonical[k]);
  }

  return out;
}

/**
 * Patch the settings row.
 *
 * Flow:
 *   1. Look up the existing row id (settings is a singleton). If found,
 *      UPDATE by that id — no hardcoded ids of any kind, so UUID PKs work
 *      just as well as integer PKs.
 *   2. If no row exists yet, INSERT without specifying id — Postgres will
 *      assign one via the column default (uuid / sequence / etc.).
 *
 * Empty strings are sent as NULL so clearing a value in the admin UI
 * actually clears the column.
 */
async function update(
  patch: Partial<SettingsMap>,
): Promise<{ error: Error | PostgrestError | null }> {
  const payload: Record<string, string | number | null> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) continue;
    const normalized =
      value === undefined || (typeof value === 'string' && value.trim() === '')
        ? null
        : value;
    payload[key] = normalized;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabase as any;

  // Step 1: find the singleton row (if any). `maybeSingle` returns data=null
  // on zero rows without surfacing an error, which is exactly the branch
  // we want for the first-ever save.
  const existing = await client
    .from('settings')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (existing.error) {
    return { error: existing.error as PostgrestError };
  }

  if (existing.data?.id !== undefined && existing.data?.id !== null) {
    const { error } = await client
      .from('settings')
      .update(payload)
      .eq('id', existing.data.id);
    return { error };
  }

  // Step 2: first-ever save — INSERT without id so the DB default kicks in.
  const { error } = await client.from('settings').insert(payload);
  return { error };
}

export const settingsApi = {
  load,
  update,
  KNOWN_KEYS,
};
