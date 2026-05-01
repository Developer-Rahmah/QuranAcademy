/**
 * DashboardViewSwitcher — segmented toggle for dual-role accounts
 * (student + halaqah supervisor) to flip between dashboards without
 * logging out.
 *
 * Renders nothing when:
 *   - context is missing (rendered outside DashboardViewProvider), or
 *   - `canSwitch` is false (pure student / pure supervisor).
 *
 * Reads view + setter from `useDashboardView()` and translates labels
 * via the project's i18n.
 */
import { ToggleGroup } from './ToggleGroup';
import { useDashboardView } from '../../context/DashboardViewContext';
import { useTranslation } from '../../locales/i18n';

export function DashboardViewSwitcher() {
  const { t } = useTranslation();
  const ctx = useDashboardView();
  if (!ctx || !ctx.canSwitch) return null;

  return (
    <div className="flex items-center justify-end gap-3 mb-4">
      <span className="text-sm text-muted">{t('supervisor.switcherLabel')}:</span>
      <ToggleGroup
        size="sm"
        value={ctx.view}
        options={[
          { value: 'student', label: t('supervisor.switchToStudent') },
          { value: 'supervisor', label: t('supervisor.switchToSupervisor') },
        ]}
        onChange={(v) => {
          if (typeof v === 'string' && (v === 'student' || v === 'supervisor')) {
            ctx.switchTo(v);
          }
        }}
      />
    </div>
  );
}
