import { en, type TranslationKey } from "./en";
import { ko } from "./ko";
import { COINS_ANALYZED } from "../config/site-stats";

const translations = { en, ko } as const;

/** Global placeholders auto-replaced in all t() calls */
const GLOBAL_VARS: Record<string, string> = {
  "{coins}": String(COINS_ANALYZED),
};

export type Lang = keyof typeof translations;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split("/");
  if (lang === "ko") return "ko";
  return "en";
}

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    let val = translations[lang][key] || translations.en[key] || key;
    for (const [placeholder, replacement] of Object.entries(GLOBAL_VARS)) {
      if (val.includes(placeholder))
        val = val.replaceAll(placeholder, replacement);
    }
    return val;
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove leading /ko/ if present to get the base path
  const basePath = path.replace(/^\/ko/, "") || "/";
  if (lang === "en") return basePath;
  return `/ko${basePath === "/" ? "" : basePath}`;
}

export function getAlternateLang(lang: Lang): Lang {
  return lang === "en" ? "ko" : "en";
}

export function getAlternatePath(path: string, lang: Lang): string {
  const altLang = getAlternateLang(lang);
  return getLocalizedPath(path, altLang);
}

// Get the base path (without /ko prefix)
export function getBasePath(path: string): string {
  return path.replace(/^\/ko/, "") || "/";
}
