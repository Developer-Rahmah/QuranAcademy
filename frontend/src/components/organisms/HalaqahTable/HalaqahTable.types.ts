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
  /**
   * Renders a built-in search input above the table that filters rows by
   * halaqah name and teacher name. Defaults to `true`.
   */
  searchable?: boolean;
}
