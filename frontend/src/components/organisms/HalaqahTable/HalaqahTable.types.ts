/**
 * HalaqahTable Component Types
 *
 * HalaqahWithStats is defined centrally in src/types so every surface
 * (AdminDashboard, HalaqahTable, etc.) shares one source of truth.
 */
import type { HalaqahWithStats } from '../../../types';

export type { HalaqahWithStats };

export interface HalaqahTableProps {
  halaqahs?: HalaqahWithStats[];
  loading?: boolean;
  showActions?: boolean;
}
