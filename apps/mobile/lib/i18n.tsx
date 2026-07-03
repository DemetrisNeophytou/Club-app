import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import type { AppLang } from "@portal/shared";
import { translations, type Translation } from "@portal/shared/i18n";

const STORAGE_KEY = "portal.lang";

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
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === "el" || stored === "en") setLangState(stored);
    });
  }, []);

  const setLang = (next: AppLang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
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
