/**
 * i18n - Internationalization System
 * Arabic is the default language
 */
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import ar from './ar.json';
import en from './en.json';

// Types
export type Language = 'ar' | 'en';
export type TranslationKey = string;

type NestedKeyOf<T> = T extends object
  ? { [K in keyof T]: K extends string
      ? T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K
      : never
    }[keyof T]
  : never;

export type ValidTranslationKey = NestedKeyOf<typeof ar>;

// Translations map
const translations: Record<Language, typeof ar> = {
  ar,
  en,
};

// Context type
interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  isRTL: boolean;
}

// Default context value
const defaultContext: I18nContextType = {
  language: 'ar',
  setLanguage: () => {},
  t: (key: string) => key,
  isRTL: true,
};

// Create context
const I18nContext = createContext<I18nContextType>(defaultContext);

/**
 * Get nested value from object by dot notation key
 */
function getNestedValue(obj: Record<string, unknown>, key: string): string {
  const keys = key.split('.');
  let result: unknown = obj;

  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k];
    } else {
      return key; // Return key if not found
    }
  }

  return typeof result === 'string' ? result : key;
}

/**
 * Replace parameters in translation string
 */
function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;

  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key]?.toString() ?? `{{${key}}}`;
  });
}

/**
 * I18n Provider Component
 */
interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: Language;
}

export function I18nProvider({ children, defaultLanguage = 'ar' }: I18nProviderProps) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get saved language from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('language') as Language;
      if (saved && (saved === 'ar' || saved === 'en')) {
        return saved;
      }
    }
    return defaultLanguage;
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('language', lang);
      // Update document direction
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = lang;
    }
  }, []);

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const translation = getNestedValue(translations[language] as Record<string, unknown>, key);
    return interpolate(translation, params);
  }, [language]);

  const isRTL = language === 'ar';

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    isRTL,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to use translations
 */
export function useTranslation() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
}

/**
 * Hook to get current language
 */
export function useLanguage() {
  const { language, setLanguage, isRTL } = useTranslation();
  return { language, setLanguage, isRTL };
}

/**
 * Standalone translation function for use outside React components
 * Defaults to Arabic
 */
export function translate(key: string, params?: Record<string, string | number>, lang: Language = 'ar'): string {
  const translation = getNestedValue(translations[lang] as Record<string, unknown>, key);
  return interpolate(translation, params);
}

export { I18nContext };
export default { I18nProvider, useTranslation, useLanguage, translate };
