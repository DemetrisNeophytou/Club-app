"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { AppLang } from "@portal/shared";
import { translations, type Translation } from "@portal/shared/i18n";

const STORAGE_KEY = "portal.venues.lang";

interface I18nContextValue {
  lang: AppLang;
  t: Translation;
  setLang: (lang: AppLang) => void;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "el",
  t: translations.el,
  setLang: () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLang>("el");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "el" || stored === "en") setLangState(stored);
  }, []);

  const setLang = (next: AppLang) => {
    setLangState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <I18nContext.Provider value={{ lang, t: translations[lang], setLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
