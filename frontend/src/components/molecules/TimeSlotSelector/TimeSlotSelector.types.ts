/**
 * TimeSlotSelector Component Types
 */

export interface TimeSlotSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
  multiple?: boolean;
  /**
   * Slot ids the picker should render as disabled + labelled with a
   * reason pill. Semantically used for two cases:
   *   • Teacher registration → admin-marked "temporarily complete"
   *     closures (default label).
   *   • Student registration → admin-marked "not yet available" slots
   *     (label overridden via `completedSlotLabelKey`).
   * Set for O(1) `has()` lookups; already-selected legacy values in
   * `value` are also filtered on next interaction.
   */
  completedSlotIds?: ReadonlySet<string>;
  /**
   * i18n key for the pill rendered on a disabled slot. Defaults to
   * `timeSlot.temporarilyComplete` — matches the teacher-registration
   * wording. Student registration passes `timeSlot.notYetOpen` to
   * signal the different reason ("no halaqah yet").
   */
  completedSlotLabelKey?: string;
}

export interface TimeSlotDisplayProps {
  slots?: string[];
  className?: string;
}
