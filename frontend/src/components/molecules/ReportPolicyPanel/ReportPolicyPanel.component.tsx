/**
 * ReportPolicyPanel — Enable toggle + grace-period selector for the
 * automatic student-suspension policy stored in
 * `settings.report_policy` (see migration 0018).
 *
 * UX contract:
 *   • Enable = OFF freezes the grace-period picker (still visible,
 *     but visually and functionally disabled) so the current draft
 *     is preserved when the admin toggles OFF then back ON later.
 *   • Grace-period presets from `GRACE_PERIOD_PRESET_DAYS`; picking
 *     "Custom" reveals a numeric input.
 *   • Numeric input accepts Arabic-Indic (٠-٩) and Eastern Arabic-
 *     Indic (۰-۹) digits, converts to plain integers via the shared
 *     `normalizeArabicDigits` helper, then rejects zero / negatives
 *     / decimals / text.
 *
 * Validity is bubbled via `onValidityChange` so the parent can gate
 * the save button — the panel never blocks the save itself.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../../locales/i18n';
import { normalizeArabicDigits } from '../../../lib/validators';
import { cn } from '../../../lib/utils';
import { Checkbox } from '../../atoms/Checkbox';
import { Input } from '../../atoms/Input';
import type {
  ReportPolicyPanelProps,
} from './ReportPolicyPanel.types';
import { GRACE_PERIOD_PRESET_DAYS } from './ReportPolicyPanel.types';

/** Sentinel used for the "Custom" preset selection. */
const CUSTOM_SENTINEL = 'custom';

export function ReportPolicyPanel({
  value,
  onChange,
  onValidityChange,
}: ReportPolicyPanelProps) {
  const { t } = useTranslation();

  // A stored `grace_period_days` that matches one of the presets
  // starts on that preset; anything else (or the "Custom" carry-over
  // from a prior draft) starts on Custom.
  const initialPreset = useMemo<number | typeof CUSTOM_SENTINEL>(() => {
    return GRACE_PERIOD_PRESET_DAYS.includes(value.grace_period_days)
      ? value.grace_period_days
      : CUSTOM_SENTINEL;
  }, [value.grace_period_days]);

  const [preset, setPreset] = useState<number | typeof CUSTOM_SENTINEL>(
    initialPreset,
  );
  // `customText` is the raw user input for the custom-days field.
  // Kept as a string so mid-typing partial values ("1", "٠", "") don't
  // reset each other. Validated on every change.
  const [customText, setCustomText] = useState<string>(
    initialPreset === CUSTOM_SENTINEL ? String(value.grace_period_days) : '',
  );
  const [customError, setCustomError] = useState<string | null>(null);

  // Re-sync draft ↔ preset whenever the parent replaces `value` from
  // outside (e.g. after `reload()`). Guard against fighting our own
  // onChange emissions by comparing against the last stored draft.
  const lastEmittedDays = useRef<number>(value.grace_period_days);
  useEffect(() => {
    if (value.grace_period_days === lastEmittedDays.current) return;
    lastEmittedDays.current = value.grace_period_days;
    if (GRACE_PERIOD_PRESET_DAYS.includes(value.grace_period_days)) {
      setPreset(value.grace_period_days);
      setCustomText('');
      setCustomError(null);
    } else {
      setPreset(CUSTOM_SENTINEL);
      setCustomText(String(value.grace_period_days));
    }
  }, [value.grace_period_days]);

  // Emit validity. When policy is OFF the panel is unconditionally
  // valid — the grace-period value doesn't matter because the
  // scheduler exits early.
  useEffect(() => {
    if (!value.enabled) {
      onValidityChange?.(true);
      return;
    }
    if (preset === CUSTOM_SENTINEL) {
      onValidityChange?.(customError === null && customText.trim() !== '');
    } else {
      onValidityChange?.(true);
    }
  }, [value.enabled, preset, customText, customError, onValidityChange]);

  const emitDays = (days: number) => {
    lastEmittedDays.current = days;
    onChange({ ...value, grace_period_days: days });
  };

  const handlePreset = (next: number | typeof CUSTOM_SENTINEL) => {
    setPreset(next);
    if (next === CUSTOM_SENTINEL) {
      // Preserve the last valid custom text so switching back
      // doesn't erase in-progress input.
      if (customText.trim() !== '' && customError === null) {
        const parsed = Number(customText.trim());
        if (Number.isInteger(parsed) && parsed > 0) emitDays(parsed);
      }
      return;
    }
    setCustomError(null);
    setCustomText('');
    emitDays(next);
  };

  const handleCustom = (raw: string) => {
    const normalized = normalizeArabicDigits(raw).trim();
    setCustomText(raw);
    if (normalized === '') {
      setCustomError(t('adminSettings.reportPolicy.errors.required'));
      return;
    }
    // Reject decimals, non-digits, negatives, zero.
    if (!/^\d+$/.test(normalized)) {
      setCustomError(t('adminSettings.reportPolicy.errors.integer'));
      return;
    }
    const n = Number(normalized);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      setCustomError(t('adminSettings.reportPolicy.errors.positive'));
      return;
    }
    setCustomError(null);
    emitDays(n);
  };

  const isCustom = preset === CUSTOM_SENTINEL;
  const disabled = !value.enabled;

  return (
    <div className="space-y-6">
      {/* Enable toggle. Visible label + description so the admin
          understands the ON/OFF consequence before flipping. */}
      <div>
        <Checkbox
          label={t('adminSettings.reportPolicy.enableLabel')}
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
        />
        <p className="mt-1 text-sm text-muted ps-6">
          {t('adminSettings.reportPolicy.enableHint')}
        </p>
      </div>

      {/* Grace-period picker. Rendered even when disabled so the
          admin sees what will be applied once policy is re-enabled. */}
      <fieldset
        disabled={disabled}
        className={cn('space-y-3', disabled && 'opacity-50')}
      >
        <legend className="text-sm font-medium text-foreground">
          {t('adminSettings.reportPolicy.gracePeriodLabel')}
        </legend>
        <p className="text-sm text-muted">
          {t('adminSettings.reportPolicy.gracePeriodHint')}
        </p>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('adminSettings.reportPolicy.gracePeriodLabel')}>
          {GRACE_PERIOD_PRESET_DAYS.map((d) => {
            const active = !isCustom && preset === d;
            return (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => handlePreset(d)}
                className={cn(
                  'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-white text-foreground hover:border-primary/40',
                )}
              >
                {t('adminSettings.reportPolicy.dayPreset').replace(
                  '{{n}}',
                  String(d),
                )}
              </button>
            );
          })}
          <button
            type="button"
            role="radio"
            aria-checked={isCustom}
            onClick={() => handlePreset(CUSTOM_SENTINEL)}
            className={cn(
              'px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20',
              isCustom
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-white text-foreground hover:border-primary/40',
            )}
          >
            {t('adminSettings.reportPolicy.custom')}
          </button>
        </div>

        {isCustom && (
          <div className="max-w-[220px] space-y-1">
            <Input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={customText}
              onChange={(e) => handleCustom(e.target.value)}
              placeholder={t('adminSettings.reportPolicy.customPlaceholder')}
              aria-invalid={customError !== null}
              aria-describedby={customError ? 'report-policy-custom-error' : undefined}
            />
            {customError && (
              <p
                id="report-policy-custom-error"
                className="text-xs text-destructive"
              >
                {customError}
              </p>
            )}
          </div>
        )}
      </fieldset>
    </div>
  );
}

export default ReportPolicyPanel;
