/**
 * ClosedSlotBadge — types.
 */
import type { Halaqah } from '../../../types';

export interface ClosedSlotBadgeProps {
  /**
   * Halaqah schedule blob. The badge inspects `schedule.slot` (via
   * `readSlotFromSchedule`) and renders only when the slot is in the
   * admin-managed `completed_slots` set for the given segment. Accepts
   * any Halaqah schedule shape (legacy included).
   */
  schedule?: Halaqah['schedule'];
  /**
   * Halaqah gender segment. Determines which side of the per-segment
   * `completed_slots` map is consulted:
   *   • `men`   → men's closures only
   *   • `women` → women's closures only
   *   • unset  → union of both (defensive; legacy halaqahs without a
   *              segment still show the badge if the slot is closed
   *              anywhere).
   */
  segment?: Halaqah['segment'];
  /**
   * Compact badge for tight rows (e.g. table cells) vs. medium for card
   * headers. Defaults to `sm`.
   */
  size?: 'sm' | 'md';
  className?: string;
}
