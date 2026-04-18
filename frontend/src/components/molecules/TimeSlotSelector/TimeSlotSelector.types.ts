/**
 * TimeSlotSelector Component Types
 */

export interface TimeSlotSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export interface TimeSlotDisplayProps {
  slots?: string[];
  className?: string;
}
