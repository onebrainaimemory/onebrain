export const SUPPORTED_LOCALES = ['de', 'en', 'es'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export function isValidLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}
