/**
 * SearchableSelect — combobox replacement for the native <Select>.
 *
 * API-compatible drop-in: same `value`, `onChange`, `options`,
 * `placeholder`, `disabled`, `error`, `className`, `name` props as
 * `Select`. `onChange` receives a synthetic event with `target.value`
 * so existing handlers (`(e) => handleChange(e.target.value)`) keep
 * working unchanged.
 *
 * Behaviour:
 *   - Click trigger → popover opens with a search input and the full
 *     option list.
 *   - Type to filter (case-insensitive, label substring).
 *   - Arrow up/down moves the active row, Enter selects, Esc closes.
 *   - Click outside closes without selecting.
 *
 * Why a custom widget instead of `<datalist>` / `<select>`: native
 * `<select>` doesn't support type-to-filter beyond a single keystroke,
 * and `<datalist>` doesn't constrain submission to listed values. Both
 * are wrong for "pick one teacher out of 200".
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { cn } from '../../../lib/utils';
import { useTranslation } from '../../../locales/i18n';
import { selectStyles } from '../Select/Select.style';
import type { SelectOption } from '../Select/Select.types';

export interface SearchableSelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (event: { target: { name?: string; value: string } }) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
  name?: string;
  'aria-label'?: string;
}

export function SearchableSelect({
  options,
  value = '',
  onChange,
  placeholder,
  searchPlaceholder,
  disabled = false,
  error = false,
  className,
  name,
  'aria-label': ariaLabel,
}: SearchableSelectProps) {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const placeholderText = placeholder || t('common.select');
  const searchText = searchPlaceholder || t('common.search');

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  // Reset state when closing; keep active index in range when filtering.
  useEffect(() => {
    if (!open) {
      setQuery('');
      setActiveIndex(0);
      return;
    }
    // Focus the search input on open so typing starts filtering immediately.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (activeIndex >= filtered.length) {
      setActiveIndex(filtered.length > 0 ? filtered.length - 1 : 0);
    }
  }, [filtered.length, activeIndex]);

  // Close on click outside.
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const emit = (nextValue: string) => {
    onChange?.({ target: { name, value: nextValue } });
  };

  const pick = (option: SelectOption) => {
    emit(option.value);
    setOpen(false);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIndex];
      if (target) pick(target);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={cn(selectStyles.wrapper, 'relative')}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={cn(
          selectStyles.select.base,
          selectStyles.select.focus,
          selectStyles.select.disabled,
          error ? selectStyles.select.error : selectStyles.select.normal,
          !selected && selectStyles.select.placeholder,
          'text-start',
          className,
        )}
      >
        {selected ? selected.label : placeholderText}
      </button>
      <div className={selectStyles.icon.wrapper}>
        <svg
          className={selectStyles.icon.svg}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
          <div className="p-2 border-b border-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKey}
              placeholder={searchText}
              className="w-full px-3 py-2 text-base bg-white border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1 text-base"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-muted text-sm">
                {t('admin.noSearchResults')}
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isActive = idx === activeIndex;
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onMouseDown={(e) => {
                      // mousedown (not click) so the option fires before
                      // the document-level "click outside" handler closes
                      // the popover with no selection committed.
                      e.preventDefault();
                      pick(opt);
                    }}
                    className={cn(
                      'px-3 py-2 cursor-pointer text-foreground',
                      isActive ? 'bg-primary/10' : '',
                      isSelected ? 'font-medium' : '',
                    )}
                  >
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
