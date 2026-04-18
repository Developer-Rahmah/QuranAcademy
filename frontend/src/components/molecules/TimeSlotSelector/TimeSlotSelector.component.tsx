/**
 * TimeSlotSelector Component
 * Multi-select grid for choosing time slots
 */
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { TIME_SLOTS } from '../../../lib/constants';
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
              {slot.label}
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
 * TimeSlotDisplay - Display selected time slots as badges
 */
export function TimeSlotDisplay({ slots = [], className }: TimeSlotDisplayProps) {
  const { t } = useTranslation();
  const selectedSlots = TIME_SLOTS.filter((slot) => slots.includes(slot.id));

  if (selectedSlots.length === 0) {
    return <span className={timeSlotDisplayStyles.empty}>{t('registration.selectAvailableTimes')}</span>;
  }

  return (
    <div className={cn(timeSlotDisplayStyles.container, className)}>
      {selectedSlots.map((slot) => (
        <span key={slot.id} className={timeSlotDisplayStyles.badge}>
          {slot.label}
        </span>
      ))}
    </div>
  );
}

export default TimeSlotSelector;
