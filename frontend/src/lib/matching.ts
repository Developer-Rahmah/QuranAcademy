/**
 * matching — pure helpers for "which teachers can take this student" and
 * "which students fit this teacher", based on `profiles.available_times`
 * AND `profiles.segment`.
 *
 * Frontend-only. The DB is never written, never queried for matching —
 * we use rows already fetched by the existing `profiles.getAll` API and
 * compute intersections client-side. No migrations, no schema changes.
 *
 * Matching rule (per spec):
 *   match(a, b) ↔
 *     segmentsCompatible(a, b)
 *     AND a.available_times ∩ b.available_times ≠ ∅
 *
 * `segmentsCompatible` enforces same-gender matching (men↔men,
 * women↔women) and additionally bridges the `children` segment with
 * everything — see its docstring for the rationale. Cross-gender
 * (men↔women) pairings are never returned even if the time slots
 * overlap. The check is centralized here so every UI surface
 * (AdminUsers row badge, AdminUserDetail section, any future matching
 * consumer) inherits it for free.
 *
 * Performance shape:
 *   - `normalizeSlots` reads each profile's `available_times` once and
 *     returns a string[] of slot ids; the caller memoizes the result.
 *   - `findMatches` is O(N·k) per profile where k is the average slot
 *     count (~3-10). For 200 students × 50 teachers that's ~10k
 *     small-set lookups — trivial within a render. The segment check
 *     short-circuits *before* the slot loop, so cross-segment users
 *     don't even pay the intersection cost.
 */
import type { Profile } from '../types';

/**
 * Inclusive upper bound for the "child" age band used by the children
 * bridge. Mom-registers-the-kid-under-`men`-segment is a real shape in
 * production data, so the bridge needs an age gate to avoid surfacing
 * adult men/women in a children teacher's list. 13 matches the
 * academy's spoken classification of "child" vs "young adult".
 */
export const CHILD_MAX_AGE = 13;

/** Profile is a child by AGE — independent of segment. */
function isChildByAge(p: Pick<Profile, 'age'>): boolean {
  return typeof p.age === 'number' && p.age <= CHILD_MAX_AGE;
}

/**
 * Segment-compatibility predicate.
 *
 *   men ↔ men           → true  (gender-equality, no age gate)
 *   women ↔ women       → true  (gender-equality, no age gate)
 *   women ↔ men         → false (gender separation)
 *
 * Anything involving the `children` segment is age-gated, regardless
 * of what's on the other side:
 *
 *   children ↔ anything → true iff at least one side has age ≤ 13
 *
 * Why "at least one":
 *   - children-segment TEACHER (adult, age > 13) ↔ kid (age ≤ 13) → match
 *     (kid satisfies the age gate)
 *   - kid (segment='children', age ≤ 13) ↔ men-TEACHER (adult) → blocked
 *     (only the kid satisfies, but the other side is a men teacher with
 *     non-matching gender — so the equality rule above doesn't apply)
 *   - children-teacher ↔ adult registered as 'children' → blocked
 *     (neither side is a child by age — surfaces nobody by accident)
 *   - kid (segment='men', age ≤ 13) ↔ children-teacher → match
 *     (kid satisfies; this is the common "mom-left-the-default" shape)
 *
 * Result: a `children`-section teacher's matching list contains
 * exactly the students whose age ≤ 13, regardless of the segment the
 * parent chose at signup (`men` / `women` / `children`). Adult
 * profiles never leak in.
 *
 * Missing/unknown segments OR a missing age on a side that needs the
 * gate fail closed — better to under-surface a pairing than to leak.
 */
export function segmentsCompatible(
  a: Pick<Profile, 'segment' | 'age'>,
  b: Pick<Profile, 'segment' | 'age'>,
): boolean {
  if (!a.segment || !b.segment) return false;

  const involvesChildren =
    a.segment === 'children' || b.segment === 'children';

  if (involvesChildren) {
    // Age-gate every children-involved pairing. At least one of the
    // two sides must be a verified child — that's the side the
    // "children section" is actually about.
    return isChildByAge(a) || isChildByAge(b);
  }

  // Non-children-involved pairs: strict same-segment equality.
  return a.segment === b.segment;
}

/**
 * Options for the matchers below. Kept as a small bag so future
 * compatibility rules (e.g. language_type, audience) can be added
 * without changing call signatures across consumers.
 */
export interface MatchOptions {
  /**
   * Enforce `segmentsCompatible(subject, candidate)` before considering
   * the slot intersection. Default `true` — every UI consumer wants
   * segment-aware matches; passing `false` is reserved for tooling or
   * future "show everyone" affordances.
   */
  sameSegmentOnly?: boolean;
}

/**
 * Coerce a profile's `available_times` column into a plain string[].
 *
 * Supabase serializes the column as `Json`. In practice it's stored as
 * an array of slot ids (e.g. `["09-11", "13-15"]`) — but a small set of
 * legacy rows persisted an object-shaped schedule keyed by day. We
 * flatten either shape to a single ordered string[] so the matcher
 * doesn't have to branch.
 */
export function normalizeSlots(profile: Pick<Profile, 'available_times'> | null | undefined): string[] {
  const raw = profile?.available_times as unknown;
  if (Array.isArray(raw)) {
    return raw.filter((s): s is string => typeof s === 'string');
  }
  if (raw && typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>)
      .flatMap((v) => (Array.isArray(v) ? v : [v]))
      .filter((v): v is string => typeof v === 'string');
  }
  return [];
}

/**
 * Return the shared slot ids between two profiles. Order follows `a`'s
 * declared order so the UI surfaces them in a stable sequence.
 */
export function sharedSlots(
  a: Pick<Profile, 'available_times'>,
  b: Pick<Profile, 'available_times'>,
): string[] {
  const set = new Set(normalizeSlots(b));
  return normalizeSlots(a).filter((s) => set.has(s));
}

export interface SlotMatch {
  /** The matched user from the opposite side. */
  user: Profile;
  /** Shared slot ids (intersection). Non-empty by construction. */
  shared: string[];
}

/**
 * For a single subject, return every candidate from `pool` whose
 * `available_times` overlaps AND (by default) whose `segment` matches.
 * Pool is typically all teachers (when subject is a student) or all
 * students (when subject is a teacher).
 *
 * Subjects with no `segment` declared never match anyone under the
 * default policy — see `segmentsCompatible`. Empty `available_times`
 * on either side → zero matches. The caller can surface that as a
 * "no matches" indicator without distinguishing it from "matches but
 * none in pool".
 */
export function findMatches(
  subject: Pick<Profile, 'available_times' | 'segment' | 'age'>,
  pool: readonly Profile[],
  opts: MatchOptions = {},
): SlotMatch[] {
  const sameSegmentOnly = opts.sameSegmentOnly ?? true;

  const subjectSlots = normalizeSlots(subject);
  if (subjectSlots.length === 0) return [];
  const subjectSet = new Set(subjectSlots);

  const out: SlotMatch[] = [];
  for (const user of pool) {
    // Segment gate first — cheap and short-circuits the slot loop for
    // cross-segment candidates. This is the segment-awareness the spec
    // requires: a women's teacher will never surface for a men's
    // student here even if their times overlap.
    if (sameSegmentOnly && !segmentsCompatible(subject, user)) continue;

    const otherSlots = normalizeSlots(user);
    if (otherSlots.length === 0) continue;
    const shared: string[] = [];
    for (const s of otherSlots) {
      if (subjectSet.has(s)) shared.push(s);
    }
    if (shared.length > 0) out.push({ user, shared });
  }
  return out;
}

/**
 * Pre-compute matches for every profile in `subjects` against `pool`.
 * Returns a map keyed by `subject.id` so the table can read each row's
 * match list in O(1) during render.
 *
 * Typical caller: `useMemo` over (students, teachers). Recomputes only
 * when either source array's reference changes. Inherits the segment
 * policy of `findMatches` — default is "same segment only".
 */
export function buildMatchIndex(
  subjects: readonly Profile[],
  pool: readonly Profile[],
  opts: MatchOptions = {},
): Map<string, SlotMatch[]> {
  const index = new Map<string, SlotMatch[]>();
  for (const s of subjects) {
    index.set(s.id, findMatches(s, pool, opts));
  }
  return index;
}
