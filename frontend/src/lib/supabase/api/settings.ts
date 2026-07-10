/**
 * settings api — read + write `public.settings` (single row).
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
 *   - complaints_telegram_username   ← Legacy field. The in-app
 *                                      complaints/suggestions flow
 *                                      now POSTs to the dedicated
 *                                      backend service (see
 *                                      `backend/complaints-api/`),
 *                                      which holds its own bot token
 *                                      + admin chat ids. This column
 *                                      is still surfaced in the admin
 *                                      settings form for reference /
 *                                      future use.
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
  /**
   * Telegram username (e.g. `@wahdaynak_support`). Legacy — the
   * in-app complaints flow now uses the dedicated backend service,
   * not this field. Kept on the type for backward compatibility with
   * existing rows and the admin settings form.
   */
  complaints_telegram_username?: string;
  /**
   * Canonical time-slot ids (e.g. `['17-19', '19-21']`) the admin has
   * marked as "temporarily complete", partitioned per gender segment.
   * Backed by `settings.completed_slots` (jsonb).
   *
   * Legacy shape support: the column historically held a bare
   * `string[]` — a flat closure list applied to everyone. When we
   * encounter that shape at read-time it's mapped to `{men: arr,
   * women: arr}` (the safest interpretation — a closed slot stays
   * closed for BOTH gender teachers until the admin resaves).
   * Writes always emit the new object shape.
   *
   * Consumers should treat missing/empty as "no closures". Only
   * teacher-registration reads this — student registration is
   * intentionally unaffected.
   */
  completed_slots?: SegmentedSlotMap;
  /**
   * Slot ids marked "not yet available" for STUDENT registration,
   * split per gender segment. Semantically distinct from
   * `completed_slots`:
   *   • `completed_slots` → a slot's halaqahs are FULL (teacher side).
   *   • `unopened_slots`  → no halaqah exists at that slot yet
   *                         (student side); nothing to join.
   *
   * Same `SegmentedSlotMap` shape so the wire, load, and update paths
   * reuse the exact same helpers. Only student registration reads
   * this — teacher registration is intentionally unaffected.
   */
  unopened_slots?: SegmentedSlotMap;
}

/**
 * Per-segment slot lists. Kept as arrays here so the wire shape
 * mirrors the DB column exactly; consumers wrap them in Sets for O(1)
 * membership checks. Shared between `completed_slots` (teacher-side
 * closures) and `unopened_slots` (student-side gating) — the shape is
 * generic, the semantics live at the caller.
 *
 * `children` is populated for `unopened_slots` only. Teacher closures
 * are men/women only (children teachers aren't gated by closures);
 * the shape still carries the field so serialization is uniform.
 */
export interface SegmentedSlotMap {
  men: string[];
  women: string[];
  children: string[];
}


/**
 * String-valued settings (facebook_url, academy_name_*, etc.). The
 * generic `load` / `update` flow treats these uniformly.
 */
const KNOWN_STRING_KEYS = [
  'facebook_url',
  'instagram_url',
  'whatsapp_number',
  'email',
  'academy_name_ar',
  'academy_name_en',
  'academy_description_ar',
  'academy_description_en',
  'complaints_telegram_username',
] as const;

/** Union of all recognised keys — string OR segmented-slot map. */
const KNOWN_KEYS: ReadonlyArray<keyof SettingsMap> = [
  ...KNOWN_STRING_KEYS,
  'completed_slots',
  'unopened_slots',
];

/** Jsonb-shaped settings keys (both use the same segmented-map shape). */
const SEGMENTED_MAP_KEYS = ['completed_slots', 'unopened_slots'] as const;

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
 * Coerce an unknown value into a `string[]`. Handles:
 *   • already-parsed arrays (supabase-js delivers jsonb this way)
 *   • JSON-encoded strings (defensive, e.g. legacy migrations)
 *   • null / undefined / non-array → []
 * Filters non-string entries so downstream never sees a mixed array.
 */
function safeStringArray(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.filter((x): x is string => typeof x === 'string');
  }
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      /* ignore */
    }
  }
  return [];
}

/**
 * Coerce an unknown value into a `SegmentedSlotMap`.
 *
 * Legacy compatibility: rows that were saved before the per-segment
 * split carry a bare `string[]`. Mirror that list into men + women
 * (the safest interpretation for a formerly-flat closure list). The
 * children bucket stays empty since it never applied historically.
 *
 * Object shape: read `men` / `women` / `children` independently.
 * Missing / null / non-array fields collapse to `[]`, so a row saved
 * before the children key existed still loads cleanly.
 */
function safeCompletedSlots(v: unknown): SegmentedSlotMap {
  if (Array.isArray(v)) {
    const arr = v.filter((x): x is string => typeof x === 'string');
    return { men: arr, women: arr, children: [] };
  }
  if (typeof v === 'string' && v.trim().length > 0) {
    try {
      return safeCompletedSlots(JSON.parse(v));
    } catch {
      /* ignore */
    }
  }
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    return {
      men: safeStringArray(obj.men),
      women: safeStringArray(obj.women),
      children: safeStringArray(obj.children),
    };
  }
  return { men: [], women: [], children: [] };
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
      if ((KNOWN_STRING_KEYS as readonly string[]).includes(key)) {
        (out as Record<string, string>)[key] = safeString(row.value);
      } else if ((SEGMENTED_MAP_KEYS as readonly string[]).includes(key)) {
        (out as Record<string, SegmentedSlotMap>)[key] = safeCompletedSlots(row.value);
      }
    }
    return out;
  }

  // Single-row shape. Settings is a singleton, so just take the first row.
  const canonical = rows[0];

  for (const k of KNOWN_STRING_KEYS) {
    (out as Record<string, string>)[k] = safeString(canonical[k]);
  }
  for (const k of SEGMENTED_MAP_KEYS) {
    (out as Record<string, SegmentedSlotMap>)[k] = safeCompletedSlots(canonical[k]);
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
  const payload: Record<string, string | number | null | SegmentedSlotMap> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!(KNOWN_KEYS as readonly string[]).includes(key)) continue;
    if ((SEGMENTED_MAP_KEYS as readonly string[]).includes(key)) {
      // supabase-js serialises the object to JSON automatically when
      // the column is jsonb. An undefined patch entry means "leave
      // column alone"; explicitly persist empty as `{men: [], women: []}`
      // (not null) so downstream never has to branch on missing.
      // Both segmented-map columns (`completed_slots`, `unopened_slots`)
      // share this exact serialization path.
      if (value === undefined) continue;
      const v = (value ?? {}) as Partial<SegmentedSlotMap>;
      payload[key] = {
        men: Array.isArray(v.men) ? v.men.filter((x): x is string => typeof x === 'string') : [],
        women: Array.isArray(v.women) ? v.women.filter((x): x is string => typeof x === 'string') : [],
        children: Array.isArray(v.children) ? v.children.filter((x): x is string => typeof x === 'string') : [],
      };
      continue;
    }
    const normalized =
      value === undefined || (typeof value === 'string' && value.trim() === '')
        ? null
        : (value as string | number);
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
