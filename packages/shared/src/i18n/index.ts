import { el } from "./el";
import { en } from "./en";
import type { AppLang } from "../types";

export const translations = { el, en } as const;

export type Translation = typeof el;

export function t(lang: AppLang): Translation {
  return translations[lang];
}

export { el, en };
