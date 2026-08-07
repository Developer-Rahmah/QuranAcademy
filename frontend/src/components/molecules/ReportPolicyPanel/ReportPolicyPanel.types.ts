/**
 * ReportPolicyPanel — types.
 */
import type { ReportPolicy } from '../../../lib/supabase/api/settings';

export interface ReportPolicyPanelProps {
  /** Draft policy value the parent owns. */
  value: ReportPolicy;
  /** Emitted on every valid mutation. */
  onChange: (next: ReportPolicy) => void;
  /**
   * Emitted whenever the draft transitions between valid and
   * invalid. Parent uses this to disable the save button.
   */
  onValidityChange?: (valid: boolean) => void;
}

/**
 * Preset options exposed by the picker, in the order they render.
 * Any positive integer is legal at the storage layer; the presets
 * are just a UX convenience. "Custom" is signalled by a value of
 * `null` — the panel then swaps in a numeric input.
 */
export const GRACE_PERIOD_PRESET_DAYS: readonly number[] = [
  1, 2, 3, 5, 7, 14, 30,
] as const;
