import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import enTranslations from './en.json';
import taTranslations from './ta.json';
import { getAppSettings, saveAppSettings } from '../db/indexedDB';

export type AppLanguage = 'en' | 'ta';
export type InvoicePrintLanguage = 'en' | 'ta' | 'bilingual';

const dictionaries: Record<AppLanguage, Record<string, any>> = {
  en: enTranslations,
  ta: taTranslations,
};

interface LanguageContextType {
  language: AppLanguage;
  invoicePrintLanguage: InvoicePrintLanguage;
  setLanguage: (lang: AppLanguage) => Promise<void>;
  setInvoicePrintLanguage: (lang: InvoicePrintLanguage) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  getInvoiceLabel: (key: keyof typeof enTranslations.invoice) => string;
  reloadLanguageSettings: () => Promise<void>;
}

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  invoicePrintLanguage: 'en',
  setLanguage: async () => {},
  setInvoicePrintLanguage: async () => {},
  t: (key: string, fallback?: string) => fallback || key,
  getInvoiceLabel: (key) => enTranslations.invoice[key] || key,
  reloadLanguageSettings: async () => {},
});

/**
 * Helper to look up dot-separated translation keys (e.g. "nav.home")
 */
function resolveKey(dict: Record<string, any>, path: string): string | undefined {
  const parts = path.split('.');
  let curr: any = dict;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && p in curr) {
      curr = curr[p];
    } else {
      return undefined;
    }
  }
  return typeof curr === 'string' ? curr : undefined;
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<AppLanguage>('en');
  const [invoicePrintLanguage, setInvoicePrintLanguageState] = useState<InvoicePrintLanguage>('en');

  const reloadLanguageSettings = useCallback(async () => {
    try {
      const settings = await getAppSettings();
      if (settings.language === 'ta' || settings.language === 'en') {
        setLanguageState(settings.language);
      }
      if (
        settings.invoicePrintLanguage === 'en' ||
        settings.invoicePrintLanguage === 'ta' ||
        settings.invoicePrintLanguage === 'bilingual'
      ) {
        setInvoicePrintLanguageState(settings.invoicePrintLanguage);
      }
    } catch {
      // Fallback to English if IndexedDB is unavailable on boot
    }
  }, []);

  useEffect(() => {
    reloadLanguageSettings();
  }, [reloadLanguageSettings]);

  const setLanguage = async (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      await saveAppSettings({ language: lang });
    } catch {
      // Non-fatal
    }
  };

  const setInvoicePrintLanguage = async (lang: InvoicePrintLanguage) => {
    setInvoicePrintLanguageState(lang);
    try {
      await saveAppSettings({ invoicePrintLanguage: lang });
    } catch {
      // Non-fatal
    }
  };

  const t = useCallback(
    (key: string, fallback?: string) => {
      const dict = dictionaries[language] || dictionaries.en;
      const val = resolveKey(dict, key);
      if (val) return val;
      const enVal = resolveKey(dictionaries.en, key);
      return enVal || fallback || key;
    },
    [language]
  );

  // Returns English, Tamil, or Bilingual (EN / தமிழ்) label for invoice printing
  const getInvoiceLabel = useCallback(
    (key: keyof typeof enTranslations.invoice): string => {
      const enVal = enTranslations.invoice[key] || key;
      const taVal = taTranslations.invoice[key] || enVal;

      if (invoicePrintLanguage === 'ta') return taVal;
      if (invoicePrintLanguage === 'bilingual') {
        return enVal === taVal ? enVal : `${enVal} / ${taVal}`;
      }
      return enVal;
    },
    [invoicePrintLanguage]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        invoicePrintLanguage,
        setLanguage,
        setInvoicePrintLanguage,
        t,
        getInvoiceLabel,
        reloadLanguageSettings,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useTranslation = () => useContext(LanguageContext);
