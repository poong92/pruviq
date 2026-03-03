import { en, type TranslationKey } from './en';
import { ko } from './ko';

const translations = { en, ko } as const;

export type Lang = keyof typeof translations;

export function getLangFromUrl(url: URL): Lang {
  const [, lang] = url.pathname.split('/');
  if (lang === 'ko') return 'ko';
  return 'en';
}

export function useTranslations(lang: Lang) {
  return function t(key: TranslationKey): string {
    return translations[lang][key] || translations.en[key] || key;
  };
}

export function getLocalizedPath(path: string, lang: Lang): string {
  // Remove leading /ko/ if present to get the base path
  const basePath = path.replace(/^\/ko/, '') || '/';
  if (lang === 'en') return basePath;
  return `/ko${basePath === '/' ? '' : basePath}`;
}

export function getAlternateLang(lang: Lang): Lang {
  return lang === 'en' ? 'ko' : 'en';
}

export function getAlternatePath(path: string, lang: Lang): string {
  const altLang = getAlternateLang(lang);
  return getLocalizedPath(path, altLang);
}

// Get the base path (without /ko prefix)
export function getBasePath(path: string): string {
  return path.replace(/^\/ko/, '') || '/';
}
