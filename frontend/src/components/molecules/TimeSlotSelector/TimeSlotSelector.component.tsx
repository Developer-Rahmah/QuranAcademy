/**
 * TimeSlotSelector — multi-select grid for choosing availability slots.
 *
 * Renders the `TIME_SLOTS` grid (2-hour blocks, see `lib/constants.ts`)
 * and labels each button via `formatSlotRange(slot.id, language)` so the
 * visible text is the localized 12h Arabic / English range — never the
 * raw 24h id. Storage stays on the `HH-HH` slot id; only the rendered
 * label is locale-aware.
 *
 * `TimeSlotDisplay` reads ANY HH-HH id (not only those currently in
 * `TIME_SLOTS`), so legacy 1-hour selections from older profiles still
 * render correctly even after the move to 2-hour slots.
 */
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { TIME_SLOTS } from '../../../lib/constants';
import { formatSlotRange } from '../../../lib/time';
import { timeSlotSelectorStyles, timeSlotDisplayStyles } from './TimeSlotSelector.style';
import type { TimeSlotSelectorProps, TimeSlotDisplayProps } from './TimeSlotSelector.types';

/**
 * TimeSlotSelector - Multi-select grid for choosing time slots
 */
export function TimeSlotSelector({
  value = [],
  onChange,
  disabled = false,
  error,
  className,
}: TimeSlotSelectorProps) {
  const { language } = useTranslation();

  const handleToggle = (slotId: string) => {
    if (disabled) return;

    const newValue = value.includes(slotId)
      ? value.filter((id) => id !== slotId)
      : [...value, slotId];

    onChange?.(newValue);
  };

  return (
    <div className={className}>
      <div className={timeSlotSelectorStyles.grid}>
        {TIME_SLOTS.map((slot) => {
          const isSelected = value.includes(slot.id);

          return (
            <button
              key={slot.id}
              type="button"
              disabled={disabled}
              onClick={() => handleToggle(slot.id)}
              className={cn(
                timeSlotSelectorStyles.slot.base,
                timeSlotSelectorStyles.slot.focus,
                isSelected
                  ? timeSlotSelectorStyles.slot.selected
                  : timeSlotSelectorStyles.slot.unselected,
                disabled && timeSlotSelectorStyles.slot.disabled
              )}
            >
              {formatSlotRange(slot.id, language)}
            </button>
          );
        })}
      </div>

      {error && (
        <p className={timeSlotSelectorStyles.error}>{error}</p>
      )}
    </div>
  );
}

/**
 * TimeSlotDisplay - Display selected time slots as badges.
 *
 * Resilient to legacy data: renders ANY `HH-HH` id directly via the
 * formatter, so a profile that was saved with the previous 1-hour
 * grid (e.g. "09-10") still shows up as "9:00 صباحًا – 10:00 صباحًا"
 * instead of disappearing because the id is no longer in `TIME_SLOTS`.
 */
export function TimeSlotDisplay({ slots = [], className }: TimeSlotDisplayProps) {
  const { t, language } = useTranslation();

  if (slots.length === 0) {
    return <span className={timeSlotDisplayStyles.empty}>{t('registration.selectAvailableTimes')}</span>;
  }

  return (
    <div className={cn(timeSlotDisplayStyles.container, className)}>
      {slots.map((slotId) => (
        <span key={slotId} className={timeSlotDisplayStyles.badge}>
          {formatSlotRange(slotId, language)}
        </span>
      ))}
    </div>
  );
}

export default TimeSlotSelector;
