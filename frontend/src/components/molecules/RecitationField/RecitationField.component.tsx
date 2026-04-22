/**
 * RecitationField — flexible riwayah input.
 *
 * Single-mode (student's current recitation): select + "other" free text.
 * Multi-mode (teacher's authorized recitations): checkbox list of common
 * riwayat + "other" chip that reveals an editable free-text row of custom
 * entries.
 *
 * The DB no longer enforces an enum (migration 0005: profiles.recitation is
 * TEXT, profiles.authorized_recitations is JSONB). Values passed in and out
 * are plain strings — either one of `RECITATION_OPTIONS[].value` (stable id)
 * or the user's typed free-form text.
 */
import { useEffect, useState } from 'react';
import { FormField } from '../FormField';
import { Checkbox } from '../../atoms/Checkbox';
import { Label, ErrorText } from '../../atoms/Text';
import { useTranslation } from '../../../locales/i18n';
import { RECITATION_OPTIONS, RECITATION_OTHER } from '../../../lib/constants';

// ---------------- single (student) ----------------

interface SingleProps {
  mode?: 'single';
  label?: string;
  name?: string;
  required?: boolean;
  /** Currently-selected value. '' / undefined means "no selection". */
  value: string;
  /** Full final value the caller should persist (never includes the "other" sentinel). */
  onChange: (value: string) => void;
  error?: string;
}

export function RecitationField(props: SingleProps): JSX.Element;
export function RecitationField(props: MultiProps): JSX.Element;
export function RecitationField(props: SingleProps | MultiProps): JSX.Element {
  if (props.mode === 'multi') return <MultiRecitation {...props} />;
  return <SingleRecitation {...(props as SingleProps)} />;
}

function SingleRecitation({ label, name, required, value, onChange, error }: SingleProps) {
  const { t } = useTranslation();
  const isKnown = RECITATION_OPTIONS.some((o) => o.value === value);

  // Visibility of the free-text input is controlled by local state so it
  // stays open even while the committed `value` is briefly '' (right after
  // picking "Other", before the user types).
  const [isOther, setIsOther] = useState<boolean>(
    value !== '' && !isKnown,
  );

  // Sync local "Other" state with externally-changed value (e.g. form reset).
  useEffect(() => {
    if (value && isKnown) setIsOther(false);
    if (value && !isKnown) setIsOther(true);
  }, [value, isKnown]);

  const selectValue = isOther ? RECITATION_OTHER : value;

  const handleSelectChange = (next: string) => {
    if (next === RECITATION_OTHER) {
      // Open the free-text field synchronously, BEFORE notifying the parent.
      // We don't wipe the parent's value — if they had typed a free-text
      // value previously, it stays so the user can edit instead of retype.
      setIsOther(true);
      if (isKnown) onChange('');
    } else {
      setIsOther(false);
      onChange(next);
    }
  };

  const options = [
    { value: '', label: t('recitation.selectRecitation') },
    ...RECITATION_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) })),
    { value: RECITATION_OTHER, label: t('recitation.other') },
  ];

  return (
    <div className="space-y-2">
      <FormField
        label={label ?? t('recitation.label')}
        name={name ?? 'recitation'}
        type="select"
        required={required}
        options={options}
        value={selectValue}
        onChange={(e) => handleSelectChange((e.target as HTMLSelectElement).value)}
        error={!isOther && !value ? error : ''}
      />

      {isOther && (
        <FormField
          label={t('recitation.otherLabel')}
          name={`${name ?? 'recitation'}_other`}
          type="text"
          required
          placeholder={t('recitation.otherLabel')}
          value={value}
          onChange={(e) => onChange((e.target as HTMLInputElement).value)}
          error={!value.trim() ? error : ''}
        />
      )}
    </div>
  );
}

// ---------------- multi (teacher) ----------------

interface MultiProps {
  mode: 'multi';
  label?: string;
  required?: boolean;
  /** Array of known ids (from RECITATION_OPTIONS) and/or free-text entries. */
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
}

function MultiRecitation({ label, required, value, onChange, error }: MultiProps) {
  const { t } = useTranslation();

  const known = new Set(RECITATION_OPTIONS.map((o) => o.value));
  const selectedKnown = value.filter((v) => known.has(v));
  const customItems = value.filter((v) => !known.has(v));
  const [showCustom, setShowCustom] = useState(customItems.length > 0);
  const [draft, setDraft] = useState('');

  const toggleKnown = (id: string, checked: boolean) => {
    const next = checked ? [...value, id] : value.filter((v) => v !== id);
    onChange(next);
  };

  const addCustom = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (value.includes(trimmed)) {
      setDraft('');
      return;
    }
    onChange([...value, trimmed]);
    setDraft('');
  };

  const removeCustom = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

  return (
    <div className="space-y-2">
      <Label required={required}>{label ?? t('recitation.authorizedIn')}</Label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 border border-border rounded-lg bg-white">
        {RECITATION_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={selectedKnown.includes(o.value)}
              onChange={(e) => toggleKnown(o.value, e.target.checked)}
            />
            <span className="text-sm text-foreground">{t(o.labelKey)}</span>
          </label>
        ))}

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={showCustom}
            onChange={(e) => {
              setShowCustom(e.target.checked);
              if (!e.target.checked) {
                // Drop any previously-added custom entries so state is clean.
                onChange(selectedKnown);
                setDraft('');
              }
            }}
          />
          <span className="text-sm text-foreground">{t('recitation.other')}</span>
        </label>
      </div>

      {showCustom && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={t('recitation.otherLabel')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              className="flex-1 px-3 py-2 bg-white border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <button
              type="button"
              onClick={addCustom}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              {t('common.add')}
            </button>
          </div>

          {customItems.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {customItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-2 px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-full"
                >
                  <span>{item}</span>
                  <button
                    type="button"
                    onClick={() => removeCustom(item)}
                    className="text-secondary-foreground/70 hover:text-destructive"
                    aria-label={t('common.delete')}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export default RecitationField;
