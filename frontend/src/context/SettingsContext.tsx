/**
 * SettingsContext — global, settings-driven UI values.
 *
 * On mount, loads the `settings` table through `api.settings.load()`. Falls
 * back to defaults from `CONTACT_INFO` + i18n keys when a value is missing or
 * the query fails (RLS, offline, etc.), so the UI is never empty.
 *
 * Consumers go through `useSettings()`:
 *
 *   const { contact, academyName, academyDescription, reload } = useSettings();
 *
 * `contact` always exposes strings (possibly empty ''); social-icon
 * components should hide the icon when the string is empty.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from '../lib/supabase';
import type { SettingsMap } from '../lib/supabase/api/settings';
import { CONTACT_INFO } from '../lib/constants';
import { useTranslation } from '../locales/i18n';

export interface ContactSettings {
  facebook: string;
  instagram: string;
  whatsapp: string;
  email: string;
}

interface SettingsContextValue {
  loading: boolean;
  raw: SettingsMap;
  /** Resolved contact info — DB overrides, falling back to CONTACT_INFO. */
  contact: ContactSettings;
  /** Locale-aware academy name (falls back to i18n). */
  academyName: string;
  /** Locale-aware academy description (falls back to i18n). */
  academyDescription: string;
  /** Manually re-pull from the DB (e.g. after an admin saves edits). */
  reload: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { t, language } = useTranslation();
  const [raw, setRaw] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await api.settings.load();
      setRaw(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Resolved values memoized by raw + language so recomputes only happen
  // when something actually changes.
  const value = useMemo<SettingsContextValue>(() => {
    // Canonical column names. settingsApi.load() already collapses nulls
    // to '', so the `||` fallback is what kicks us over to the compile-time
    // CONTACT_INFO defaults when the DB cell is blank.
    const contact: ContactSettings = {
      facebook:  raw.facebook_url    || CONTACT_INFO.facebook,
      instagram: raw.instagram_url   || CONTACT_INFO.instagram,
      whatsapp:  raw.whatsapp_number || CONTACT_INFO.whatsapp,
      email:     raw.email           || CONTACT_INFO.email,
    };

    const isArabic = language === 'ar';
    // `||` (not `??`) so empty DB cells fall back to the i18n default,
    // matching the contact block's behaviour.
    const academyName =
      (isArabic ? raw.academy_name_ar : raw.academy_name_en) || t('academy.title');
    const academyDescription =
      (isArabic ? raw.academy_description_ar : raw.academy_description_en) ||
      t('academy.description');

    return {
      loading,
      raw,
      contact,
      academyName,
      academyDescription,
      reload,
    };
  }, [raw, loading, language, t, reload]);

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}

export default SettingsContext;
