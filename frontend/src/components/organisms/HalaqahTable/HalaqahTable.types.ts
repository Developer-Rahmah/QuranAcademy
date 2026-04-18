/**
 * HalaqahTable Component Types
 */
import type { Profile } from '../../../types';

export interface HalaqahWithStats {
  id: string;
  name: string;
  teacher?: Profile | null;
  studentCount?: number;
  avgProgress?: number;
}

export interface HalaqahTableProps {
  halaqahs?: HalaqahWithStats[];
  loading?: boolean;
  showActions?: boolean;
}
