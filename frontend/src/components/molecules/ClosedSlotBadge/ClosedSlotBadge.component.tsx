/**
 * ClosedSlotBadge — small "Temporarily complete" pill.
 *
 * Renders NOTHING unless the halaqah's canonical `schedule.slot` is in
 * the admin-managed `completed_slots` set from SettingsContext. Meant
 * to be dropped inline next to a halaqah name/title wherever the app
 * surfaces halaqahs (tables, cards, detail page), so viewers can spot
 * at a glance which halaqahs sit at a closed time slot.
 */
import { readSlotFromSchedule } from '../../../lib/autoHalaqah';
import { useSettings } from '../../../context/SettingsContext';
import { useTranslation } from '../../../locales/i18n';
import { Badge } from '../../atoms/Badge';
import type { ClosedSlotBadgeProps } from './ClosedSlotBadge.types';

export function ClosedSlotBadge({
  schedule,
  segment,
  size = 'sm',
  className,
}: ClosedSlotBadgeProps) {
  const { t } = useTranslation();
  const { completedSlots } = useSettings();

  const slot = readSlotFromSchedule(schedule);
  if (!slot) return null;

  // Pick the segment-specific closure set. Halaqahs whose segment is
  // unset fall back to the union — the badge still shows if the slot
  // is closed for anyone, which is the safest default for legacy rows.
  const isClosed =
    segment === 'men'
      ? completedSlots.men.has(slot)
      : segment === 'women'
        ? completedSlots.women.has(slot)
        : completedSlots.men.has(slot) || completedSlots.women.has(slot);

  if (!isClosed) return null;

  return (
    <Badge variant="warning" size={size} className={className}>
      {t('timeSlot.temporarilyComplete')}
    </Badge>
  );
}

export default ClosedSlotBadge;
