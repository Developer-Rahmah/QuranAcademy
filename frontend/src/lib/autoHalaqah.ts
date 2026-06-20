/**
 * autoHalaqah — automation for the post-registration assignment flow.
 *
 * Two entry points the admin UI calls:
 *
 *   1. `createHalaqahsForTeacher(teacher)` — when a teacher is
 *      activated, materialize one halaqah per declared time slot.
 *      Idempotent against the teacher's existing halaqahs: a slot
 *      that already has a halaqah owned by this teacher is skipped.
 *
 *   2. `autoAssignStudent({ student, halaqahs, memberCounts })` —
 *      when a student is activated, pick the best fitting halaqah
 *      (time intersection + gender/audience compatibility) and add
 *      them via the existing `halaqah_members.add` API. Picks the
 *      least-full halaqah among compatible candidates so cohorts
 *      stay roughly balanced.
 *
 * No DB schema changes. Both functions compose existing API methods
 * (`db.halaqahs.create`, `db.members.add`) and existing domain rules
 * (`canStudentJoinHalaqah` for gender/audience, `sharedSlots` for
 * time intersection). Reasoning is centralized here so the wiring
 * sites (AdminUsers row activation handler, AdminUserDetail) just
 * dispatch and surface the result.
 */
import { db } from './supabase';
import { supabase } from './supabase/client';
import { canStudentJoinHalaqah } from './domain/roleRules';
import { sharedSlots, normalizeSlots } from './matching';
import { formatSlotRange } from './time';
import type {
  Halaqah,
  HalaqahMember,
  PreferredAudience,
  Profile,
} from '../types';

// ---------------- Halaqah creation ----------------------------------

/**
 * Extract the teacher's time slots, defensively flattening the legacy
 * object-shaped schedule into the canonical `string[]` form.
 */
function teacherSlots(teacher: Pick<Profile, 'available_times'>): string[] {
  return normalizeSlots(teacher);
}

/**
 * Gendered honorific for the teacher in the auto-generated halaqah
 * name. Mirrors the `segmentationRules` convention:
 *   - segment === 'men'    → المعلم
 *   - segment === 'women'  → المعلمة
 *   - anything else        → المعلم/ة  (neutral; covers `children`,
 *                            `non_arab_speakers`, and unset segments)
 */
function teacherHonorific(segment: Profile['segment']): string {
  if (segment === 'men') return 'المعلم';
  if (segment === 'women') return 'المعلمة';
  return 'المعلم/ة';
}

/**
 * Auto-generated halaqah name.
 *
 * Format: `حلقة <honorific> <name> الساعة <slot label>`
 *   e.g. "حلقة المعلمة رحمة محمود الساعة 7:00 مساءً – 9:00 مساءً"
 *
 * The honorific is gendered from the teacher's segment so a men's
 * teacher reads "حلقة المعلم …" and a women's teacher reads "حلقة
 * المعلمة …". For children/non-Arab-speaker/unset segments we fall
 * back to the neutral "المعلم/ة" form. The slot id renders through
 * `formatSlotRange('ar')` so the time string matches what the admin
 * sees elsewhere in the app.
 *
 * Kept plain text so the `name` column (TEXT NOT NULL) accepts it
 * directly with no escaping.
 */
export function generateHalaqahName(
  teacher: Pick<Profile, 'first_name' | 'second_name' | 'segment'>,
  slot: string,
): string {
  const teacherName = [teacher.first_name, teacher.second_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  const honorific = teacherHonorific(teacher.segment);
  const slotLabel = formatSlotRange(slot, 'ar');
  return teacherName
    ? `حلقة ${honorific} ${teacherName} الساعة ${slotLabel}`
    : `حلقة ${honorific} الساعة ${slotLabel}`;
}

export interface CreateHalaqahsResult {
  /** Halaqahs successfully created (or already-present, see `skipped`). */
  created: Halaqah[];
  /** Slots that already had a halaqah for this teacher; nothing was inserted. */
  skipped: string[];
  /** Slots whose insert failed. The caller surfaces a warning toast. */
  failed: string[];
}

/**
 * For each of the teacher's declared time slots, create a halaqah
 * (if one doesn't already exist for that teacher at that slot).
 *
 * Existing halaqahs are detected by querying `db.halaqahs.list({
 * teacherId })`. We compare against the slot id embedded in
 * `schedule.slot` — that's the convention this module writes.
 *
 * The halaqah row is created with:
 *   - name           : `generateHalaqahName(teacher, slot)`
 *   - teacher_id     : teacher.id
 *   - level          : 'beginner' (the form's default)
 *   - target_audience: teacher.preferred_audience (defaulted to 'both'
 *                      so RLS / NOT NULL constraints don't reject)
 *   - segment        : teacher.segment when set, else undefined; the
 *                      DB defaults to 'women' (per migration 0005),
 *                      but a `children`-segment teacher needs us to
 *                      pass the segment explicitly so the row reflects
 *                      reality. RLS / matching code reads this field.
 *   - schedule       : `{ slot: <slot id> }` — single-slot per halaqah
 *                      keeps the "one halaqah == one weekly session"
 *                      convention the rest of the UI assumes.
 *   - status         : 'active'
 */
export async function createHalaqahsForTeacher(
  teacher: Profile,
): Promise<CreateHalaqahsResult> {
  const slots = teacherSlots(teacher);
  if (slots.length === 0) {
    return { created: [], skipped: [], failed: [] };
  }

  // Fetch any halaqahs the teacher already owns so we don't create
  // duplicates (e.g. on re-activation, or after a manual partial
  // creation).
  const { data: existing } = await db.halaqahs.getAll({ teacherId: teacher.id });
  const occupiedSlots = new Set(
    (existing ?? [])
      .map((h) => readSlotFromSchedule(h.schedule))
      .filter((s): s is string => !!s),
  );

  const created: Halaqah[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const slot of slots) {
    if (occupiedSlots.has(slot)) {
      skipped.push(slot);
      continue;
    }
    const payload: Partial<Halaqah> = {
      name: generateHalaqahName(teacher, slot),
      teacher_id: teacher.id,
      level: 'beginner',
      target_audience: (teacher.preferred_audience ??
        'both') as PreferredAudience,
      schedule: { slot } as unknown as Halaqah['schedule'],
      status: 'active',
    };
    // `segment` is optional on the type but useful for downstream
    // gender filtering. Only set it when the teacher has a gendered
    // segment ('men' / 'women'); a `children`-segment teacher leaves
    // it undefined and the matcher falls through to audience checks.
    if (teacher.segment === 'men' || teacher.segment === 'women') {
      payload.segment = teacher.segment;
    }
    const { data, error } = await db.halaqahs.create(payload);
    if (error || !data) {
      console.warn('autoHalaqah: failed to create halaqah for slot', slot, error);
      failed.push(slot);
      continue;
    }
    created.push(data);
  }
  return { created, skipped, failed };
}

/** Pull the slot id we wrote into `schedule` back out, defensively. */
function readSlotFromSchedule(schedule: Halaqah['schedule']): string | null {
  if (!schedule || typeof schedule !== 'object') return null;
  const raw = (schedule as Record<string, unknown>).slot;
  return typeof raw === 'string' ? raw : null;
}

// ---------------- Student auto-assignment ----------------------------

export interface AutoAssignContext {
  /** Candidate halaqahs to consider — typically all active halaqahs. */
  halaqahs: readonly Halaqah[];
  /** halaqah_id → current active member count, for load balancing. */
  memberCounts: ReadonlyMap<string, number>;
  /** Active members → student ids already in any halaqah. */
  assignedStudentIds: ReadonlySet<string>;
}

export interface AutoAssignResult {
  /** The halaqah the student was added to. null when nothing matched. */
  halaqah: Halaqah | null;
  /** The membership row created by `db.members.add`. */
  membership: HalaqahMember | null;
  /** Why the auto-assignment was skipped. */
  reason?:
    | 'already_assigned'
    | 'no_slots'
    | 'no_compatible_halaqah'
    | 'add_failed';
}

/**
 * Rank candidate halaqahs for a student. Returns the halaqahs that
 * pass BOTH the gender/audience predicate AND the time-intersection
 * predicate, sorted by ascending member count (least-full first) so
 * the caller's auto-assign picks the most balanced option.
 *
 * Halaqahs with a missing/unparsable slot in `schedule` are skipped
 * — we wouldn't know how to match them on time.
 */
export function rankHalaqahsForStudent(
  student: Profile,
  ctx: AutoAssignContext,
): Halaqah[] {
  const studentSlots = new Set(normalizeSlots(student));
  if (studentSlots.size === 0) return [];

  const compatible: Halaqah[] = [];
  for (const halaqah of ctx.halaqahs) {
    // Time gate — the halaqah's slot must be one the student has
    // declared availability for.
    const halaqahSlot = readSlotFromSchedule(halaqah.schedule);
    if (!halaqahSlot || !studentSlots.has(halaqahSlot)) continue;

    // Gender / audience gate — reuses the canonical predicate so the
    // automation and the manual-assign modal stay in lockstep.
    if (!canStudentJoinHalaqah(student, halaqah)) continue;

    compatible.push(halaqah);
  }

  // Stable sort by current member count (least-full first). Tie-break
  // on halaqah id so the same input always produces the same output.
  compatible.sort((a, b) => {
    const ca = ctx.memberCounts.get(a.id) ?? 0;
    const cb = ctx.memberCounts.get(b.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.id.localeCompare(b.id);
  });
  return compatible;
}

/**
 * Convenience: rank + pick + insert. Caller supplies the full ranking
 * context (halaqahs + member counts + already-assigned ids) so we
 * don't make N round-trips per student during a bulk scan.
 *
 * Returns the assignment result so the caller can toast accordingly.
 * `already_assigned` short-circuits without writing — the student is
 * already a member somewhere and we don't move them automatically.
 */
export async function autoAssignStudent(
  student: Profile,
  ctx: AutoAssignContext,
): Promise<AutoAssignResult> {
  if (ctx.assignedStudentIds.has(student.id)) {
    return { halaqah: null, membership: null, reason: 'already_assigned' };
  }
  if (normalizeSlots(student).length === 0) {
    return { halaqah: null, membership: null, reason: 'no_slots' };
  }
  const ranked = rankHalaqahsForStudent(student, ctx);
  if (ranked.length === 0) {
    return { halaqah: null, membership: null, reason: 'no_compatible_halaqah' };
  }
  const pick = ranked[0];
  const { data, error } = await db.members.add(pick.id, student.id);
  if (error || !data) {
    console.warn(
      'autoHalaqah: failed to insert membership for student',
      student.id,
      error,
    );
    return { halaqah: pick, membership: null, reason: 'add_failed' };
  }
  return { halaqah: pick, membership: data };
}

// ---------------- Academy-wide sweep ---------------------------------

/**
 * Build an `AutoAssignContext` from the live data: every active
 * halaqah + every active membership index. Used by the sweep below
 * AND by AdminUsers's per-student activation flow, so both share a
 * single source of truth for the ranking inputs.
 */
export async function loadAssignmentContext(): Promise<AutoAssignContext> {
  const [halaqahsRes, membersRes] = await Promise.all([
    db.halaqahs.getAll({ status: 'active' }),
    supabase
      .from('halaqah_members')
      .select('halaqah_id, student_id')
      .eq('status', 'active'),
  ]);
  const halaqahs = halaqahsRes.data ?? [];
  const memberRows =
    (membersRes.data ?? []) as Array<{ halaqah_id: string; student_id: string }>;
  const memberCounts = new Map<string, number>();
  const assignedStudentIds = new Set<string>();
  for (const m of memberRows) {
    memberCounts.set(m.halaqah_id, (memberCounts.get(m.halaqah_id) ?? 0) + 1);
    assignedStudentIds.add(m.student_id);
  }
  return { halaqahs, memberCounts, assignedStudentIds };
}

export interface AssignmentSweepResult {
  /** Active student rows considered by the sweep. */
  considered: number;
  /** Students newly placed into a halaqah this run. */
  assigned: number;
  /** Students that remained unassigned because no halaqah matched. */
  unmatched: number;
}

/**
 * Walk every active student NOT currently in a halaqah and try to
 * place them via `autoAssignStudent`. Mutates a local copy of the
 * context's maps as it goes so successive placements stay
 * load-balanced. Returns a count summary the caller can toast.
 *
 * Idempotent and safe to re-run — already-assigned students are
 * skipped by the predicate inside autoAssignStudent.
 */
export async function runAssignmentSweep(): Promise<AssignmentSweepResult> {
  const ctx = await loadAssignmentContext();
  const { data: candidates } = await db.profiles.getAll({
    role: 'student',
    status: 'active',
  });
  const memberCounts = new Map(ctx.memberCounts);
  const assignedStudentIds = new Set(ctx.assignedStudentIds);

  let assigned = 0;
  let considered = 0;
  for (const student of candidates ?? []) {
    considered += 1;
    if (assignedStudentIds.has(student.id)) continue;
    const result = await autoAssignStudent(student, {
      halaqahs: ctx.halaqahs,
      memberCounts,
      assignedStudentIds,
    });
    if (result.halaqah && result.membership) {
      memberCounts.set(
        result.halaqah.id,
        (memberCounts.get(result.halaqah.id) ?? 0) + 1,
      );
      assignedStudentIds.add(student.id);
      assigned += 1;
    }
  }
  const unmatched = (candidates ?? []).filter(
    (s) => !assignedStudentIds.has(s.id),
  ).length;
  return { considered, assigned, unmatched };
}

// ---------------- Slot helpers re-exports ----------------------------

/** Convenience re-export so callers can show slot labels too. */
export { sharedSlots, normalizeSlots, readSlotFromSchedule };

// ====================================================================
// MATCHING CENTER — diagnostic + preview infrastructure
// ====================================================================
//
// The "Matching Center" page composes these helpers to answer three
// questions an admin asks every day:
//   1. WHO is unassigned and WHY?
//   2. WHAT would the next sweep do?
//   3. WHERE are the gaps (capacity, missing slots, idle teachers)?
//
// Everything below is built on top of the existing matcher (`findMatches`,
// `rankHalaqahsForStudent`, `canStudentJoinHalaqah`) — no new business
// rules, no DB schema changes. Pure functions are the default; the only
// I/O entry points are `loadMatchingState` (read) and
// `commitSweepPlacements` (write, batched).

/**
 * Soft target for halaqah size. Halaqahs at or above this count are
 * flagged "full" in the matching center; they remain valid auto-assign
 * candidates so the matcher itself never blocks placement on capacity
 * alone (admins can still drop students into a full halaqah by hand).
 *
 * Tunable — adjust here if your academy uses a different rule of thumb.
 */
export const HALAQAH_TARGET_SIZE = 15;

/** Why a student is currently unassigned. Stable, i18n-key-friendly. */
export type UnassignmentReason =
  /** student.status !== 'active' — never auto-assigned. */
  | 'student_inactive'
  /** student.available_times is empty — nothing to match against. */
  | 'no_slots_declared'
  /** No halaqah's `schedule.slot` overlaps any of the student's slots. */
  | 'no_halaqah_at_time'
  /** Halaqahs exist at the time but the gender/audience rule blocks all. */
  | 'segment_mismatch'
  /**
   * A halaqah exists that COULD cover the time but its `schedule.slot`
   * is empty (legacy / manually-created without the field). Backfill
   * the slot via HalaqahDetails and the student becomes matchable.
   */
  | 'halaqah_missing_slot'
  /** All matching halaqahs are at or over `HALAQAH_TARGET_SIZE`. */
  | 'halaqahs_full'
  /** The only matching halaqah's teacher is suspended/inactive. */
  | 'teacher_inactive';

/**
 * Snapshot of every input the Matching Center needs in one place.
 * Built via a single batched fetch (`loadMatchingState`) so the page
 * runs four light queries on mount and zero on interaction.
 *
 *   halaqahsAll       — every halaqah row regardless of status, with the
 *                       teacher relation joined. Lets us detect
 *                       "halaqah_missing_slot" + "teacher_inactive".
 *   halaqahsActive    — subset used for the actual matcher.
 *   memberCounts      — halaqah_id → active member count.
 *   assignedStudentIds — student ids in any active membership.
 *   students          — every active student (matching candidates).
 *   teachersById      — id → teacher profile, for inactive-teacher diagnosis.
 */
export interface MatchingState {
  halaqahsAll: Halaqah[];
  halaqahsActive: Halaqah[];
  memberCounts: ReadonlyMap<string, number>;
  assignedStudentIds: ReadonlySet<string>;
  students: Profile[];
  teachersById: ReadonlyMap<string, Profile>;
}

/**
 * One batched load of everything the Matching Center needs. Four
 * parallel queries; all projected to the columns the page reads. No
 * N+1, no incremental refetch loops.
 */
export async function loadMatchingState(): Promise<MatchingState> {
  const [halaqahsRes, membersRes, studentsRes, teachersRes] = await Promise.all([
    db.halaqahs.getAll({}),
    supabase
      .from('halaqah_members')
      .select('halaqah_id, student_id')
      .eq('status', 'active'),
    db.profiles.getAll({ role: 'student', status: 'active' }),
    supabase
      .from('profiles')
      .select('id, first_name, second_name, third_name, status, segment')
      .eq('role', 'teacher'),
  ]);

  const halaqahsAll = halaqahsRes.data ?? [];
  const halaqahsActive = halaqahsAll.filter((h) => h.status === 'active');

  const memberRows =
    (membersRes.data ?? []) as Array<{ halaqah_id: string; student_id: string }>;
  const memberCounts = new Map<string, number>();
  const assignedStudentIds = new Set<string>();
  for (const m of memberRows) {
    memberCounts.set(m.halaqah_id, (memberCounts.get(m.halaqah_id) ?? 0) + 1);
    assignedStudentIds.add(m.student_id);
  }

  const teachersById = new Map<string, Profile>();
  for (const t of (teachersRes.data ?? []) as Profile[]) {
    teachersById.set(t.id, t);
  }

  return {
    halaqahsAll,
    halaqahsActive,
    memberCounts,
    assignedStudentIds,
    students: studentsRes.data ?? [],
    teachersById,
  };
}

/** Build an `AutoAssignContext` from a `MatchingState`. Cheap. */
export function contextFromState(state: MatchingState): AutoAssignContext {
  return {
    halaqahs: state.halaqahsActive,
    memberCounts: state.memberCounts,
    assignedStudentIds: state.assignedStudentIds,
  };
}

export interface StudentAnalysis {
  studentId: string;
  /** When set: the placement `runAssignmentSweep` would produce. */
  proposedHalaqah: Halaqah | null;
  /** When `proposedHalaqah` is null, the precise reason. */
  reason: UnassignmentReason | null;
  /** All halaqahs whose time slot overlaps the student's (any status). */
  timeMatchingHalaqahs: Halaqah[];
  /** Subset of `timeMatchingHalaqahs` blocked by capacity. */
  fullHalaqahs: Halaqah[];
}

/**
 * Walk the matcher for a single student and explain the outcome.
 * Pure — call as many times as you like; no I/O.
 *
 * Reason precedence (most specific first):
 *   1. student_inactive
 *   2. no_slots_declared
 *   3. would_assign           (proposedHalaqah set, reason null)
 *   4. halaqahs_full          (compatible matches exist but all at cap)
 *   5. teacher_inactive       (matching halaqah but teacher suspended)
 *   6. segment_mismatch       (any halaqah at the time, none pass segment)
 *   7. halaqah_missing_slot   (some halaqah has empty schedule.slot)
 *   8. no_halaqah_at_time     (catch-all)
 */
export function analyzeStudent(
  student: Profile,
  state: MatchingState,
  capacity: number = HALAQAH_TARGET_SIZE,
): StudentAnalysis {
  const baseEmpty: StudentAnalysis = {
    studentId: student.id,
    proposedHalaqah: null,
    reason: null,
    timeMatchingHalaqahs: [],
    fullHalaqahs: [],
  };

  if (student.status !== 'active') {
    return { ...baseEmpty, reason: 'student_inactive' };
  }

  const studentSlots = new Set(normalizeSlots(student));
  if (studentSlots.size === 0) {
    return { ...baseEmpty, reason: 'no_slots_declared' };
  }

  // Pass 1: full ranker (the live matcher's view). If anything ranks,
  // pick the least-full (which is what the sweep would do).
  const ranked = rankHalaqahsForStudent(student, contextFromState(state));

  // Capacity filter — halaqahs at/over target are flagged but kept
  // as candidates so the matcher itself never refuses placement.
  const withinCapacity = ranked.filter(
    (h) => (state.memberCounts.get(h.id) ?? 0) < capacity,
  );
  if (withinCapacity.length > 0) {
    return {
      studentId: student.id,
      proposedHalaqah: withinCapacity[0],
      reason: null,
      timeMatchingHalaqahs: ranked,
      fullHalaqahs: ranked.filter(
        (h) => (state.memberCounts.get(h.id) ?? 0) >= capacity,
      ),
    };
  }
  if (ranked.length > 0) {
    return {
      studentId: student.id,
      proposedHalaqah: null,
      reason: 'halaqahs_full',
      timeMatchingHalaqahs: ranked,
      fullHalaqahs: ranked,
    };
  }

  // Pass 2: no compatible ranked match. Diagnose why.
  // Halaqahs whose time slot overlaps the student, ANY status, regardless
  // of segment compatibility — used to distinguish gaps from misroutes.
  const timeMatches = state.halaqahsAll.filter((h) => {
    const slot = readSlotFromSchedule(h.schedule);
    return slot ? studentSlots.has(slot) : false;
  });

  if (timeMatches.length > 0) {
    // A halaqah covers the time. Why didn't the matcher pick it?
    const anyActive = timeMatches.some((h) => h.status === 'active');
    if (!anyActive) {
      // Halaqahs exist at the time but none are active — could be all
      // suspended/completed. Treat as time gap for the admin's purpose.
      return {
        ...baseEmpty,
        reason: 'no_halaqah_at_time',
        timeMatchingHalaqahs: timeMatches,
      };
    }
    // Any active time-match whose TEACHER is inactive?
    const activeMatches = timeMatches.filter((h) => h.status === 'active');
    const allTeachersInactive = activeMatches.every((h) => {
      if (!h.teacher_id) return true;
      const teacher = state.teachersById.get(h.teacher_id);
      return !teacher || teacher.status !== 'active';
    });
    if (allTeachersInactive) {
      return {
        ...baseEmpty,
        reason: 'teacher_inactive',
        timeMatchingHalaqahs: activeMatches,
      };
    }
    // Time + active teacher but the gender rule blocked them.
    return {
      ...baseEmpty,
      reason: 'segment_mismatch',
      timeMatchingHalaqahs: activeMatches,
    };
  }

  // No halaqah has a recognised slot for this student. Last check: is
  // there a halaqah missing `schedule.slot` that the admin should
  // backfill? (Heuristic — surfaces the legacy-data gap.)
  const missingSlotCount = state.halaqahsAll.filter(
    (h) => h.status === 'active' && !readSlotFromSchedule(h.schedule),
  ).length;
  if (missingSlotCount > 0) {
    return { ...baseEmpty, reason: 'halaqah_missing_slot' };
  }

  return { ...baseEmpty, reason: 'no_halaqah_at_time' };
}

export interface SweepPreview {
  /** Students the next sweep would place + the target halaqah. */
  placements: Array<{ student: Profile; halaqah: Halaqah }>;
  /** Students that would remain unassigned + the precise reason. */
  blocked: Array<{
    student: Profile;
    reason: UnassignmentReason;
    detail?: StudentAnalysis;
  }>;
}

/**
 * Dry-run the sweep over the snapshot. Mirrors `runAssignmentSweep`'s
 * traversal order + load-balancing exactly: each placement updates a
 * local copy of the member counts so successive picks stay balanced.
 * Returns the proposed placements without writing anything.
 *
 * Pure function — caller controls when (or whether) to commit.
 */
export function buildSweepPreview(
  state: MatchingState,
  capacity: number = HALAQAH_TARGET_SIZE,
): SweepPreview {
  const placements: SweepPreview['placements'] = [];
  const blocked: SweepPreview['blocked'] = [];

  const memberCounts = new Map(state.memberCounts);
  const assignedStudentIds = new Set(state.assignedStudentIds);

  for (const student of state.students) {
    if (assignedStudentIds.has(student.id)) continue;

    // Build a transient state with the updated counts so the analyzer
    // sees the placements made by earlier iterations of this sweep.
    const transient: MatchingState = {
      ...state,
      memberCounts,
      assignedStudentIds,
    };
    const analysis = analyzeStudent(student, transient, capacity);
    if (analysis.proposedHalaqah) {
      placements.push({ student, halaqah: analysis.proposedHalaqah });
      memberCounts.set(
        analysis.proposedHalaqah.id,
        (memberCounts.get(analysis.proposedHalaqah.id) ?? 0) + 1,
      );
      assignedStudentIds.add(student.id);
    } else if (analysis.reason) {
      blocked.push({
        student,
        reason: analysis.reason,
        detail: analysis,
      });
    }
  }

  return { placements, blocked };
}

/**
 * Commit a previously-built preview by inserting one membership row
 * per placement. Returns an `{ok, failed}` summary; individual
 * failures are logged but do not abort the loop so partial success
 * still lands cleanly.
 */
export async function commitSweepPlacements(
  placements: SweepPreview['placements'],
): Promise<{ ok: number; failed: number }> {
  let ok = 0;
  let failed = 0;
  for (const { student, halaqah } of placements) {
    const { error } = await db.members.add(halaqah.id, student.id);
    if (error) {
      console.warn('commitSweepPlacements: insert failed', error);
      failed += 1;
      continue;
    }
    ok += 1;
  }
  return { ok, failed };
}

export interface MatchingStats {
  assignedStudents: number;
  unassignedStudents: number;
  teachersWithoutStudents: number;
  halaqahsWithCapacity: number;
  fullHalaqahs: number;
  halaqahsMissingSlot: number;
  blockedNoHalaqah: number;
  blockedAllFull: number;
}

/**
 * Aggregate the snapshot into the dashboard numbers. Pure and O(n) —
 * one pass over students for the reason histogram, one pass over
 * halaqahs for the capacity histogram.
 */
export function computeMatchingStats(
  state: MatchingState,
  capacity: number = HALAQAH_TARGET_SIZE,
): MatchingStats {
  let halaqahsWithCapacity = 0;
  let fullHalaqahs = 0;
  let halaqahsMissingSlot = 0;
  for (const h of state.halaqahsActive) {
    const count = state.memberCounts.get(h.id) ?? 0;
    if (count < capacity) halaqahsWithCapacity += 1;
    else fullHalaqahs += 1;
    if (!readSlotFromSchedule(h.schedule)) halaqahsMissingSlot += 1;
  }

  const teachersWithMembers = new Set<string>();
  for (const h of state.halaqahsActive) {
    if (!h.teacher_id) continue;
    if ((state.memberCounts.get(h.id) ?? 0) > 0) {
      teachersWithMembers.add(h.teacher_id);
    }
  }
  let teachersWithoutStudents = 0;
  for (const t of state.teachersById.values()) {
    if (t.status !== 'active') continue;
    if (!teachersWithMembers.has(t.id)) teachersWithoutStudents += 1;
  }

  let unassignedStudents = 0;
  let blockedNoHalaqah = 0;
  let blockedAllFull = 0;
  for (const s of state.students) {
    if (state.assignedStudentIds.has(s.id)) continue;
    unassignedStudents += 1;
    const a = analyzeStudent(s, state, capacity);
    if (a.reason === 'halaqahs_full') blockedAllFull += 1;
    else if (
      a.reason === 'no_halaqah_at_time' ||
      a.reason === 'halaqah_missing_slot' ||
      a.reason === 'segment_mismatch' ||
      a.reason === 'teacher_inactive'
    ) {
      blockedNoHalaqah += 1;
    }
  }

  const assignedStudents = state.assignedStudentIds.size;
  return {
    assignedStudents,
    unassignedStudents,
    teachersWithoutStudents,
    halaqahsWithCapacity,
    fullHalaqahs,
    halaqahsMissingSlot,
    blockedNoHalaqah,
    blockedAllFull,
  };
}

/**
 * i18n key resolver for a reason. Centralized so the page (and any
 * future toast / report) renders identical text.
 */
export function unassignmentReasonKey(reason: UnassignmentReason): string {
  switch (reason) {
    case 'student_inactive':       return 'matching.reason.studentInactive';
    case 'no_slots_declared':      return 'matching.reason.noSlotsDeclared';
    case 'no_halaqah_at_time':     return 'matching.reason.noHalaqahAtTime';
    case 'segment_mismatch':       return 'matching.reason.segmentMismatch';
    case 'halaqah_missing_slot':   return 'matching.reason.halaqahMissingSlot';
    case 'halaqahs_full':          return 'matching.reason.halaqahsFull';
    case 'teacher_inactive':       return 'matching.reason.teacherInactive';
  }
}
