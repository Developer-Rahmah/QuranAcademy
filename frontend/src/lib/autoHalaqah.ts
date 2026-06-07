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

// ---------------- Slot helpers re-exports ----------------------------

/** Convenience re-export so callers can show slot labels too. */
export { sharedSlots, normalizeSlots };
