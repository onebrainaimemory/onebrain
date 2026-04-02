import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Locale, TranslationDictionary } from './types.js';
import { DEFAULT_LOCALE, isValidLocale } from './types.js';

export { DEFAULT_LOCALE, SUPPORTED_LOCALES, isValidLocale } from './types.js';
export type { Locale, TranslationDictionary } from './types.js';

const currentDir = dirname(fileURLToPath(import.meta.url));
const localesDir = join(currentDir, '..', 'locales');

const cache = new Map<Locale, TranslationDictionary>();

export async function loadLocale(locale: Locale): Promise<TranslationDictionary> {
  const cached = cache.get(locale);
  if (cached) {
    return cached;
  }

  const filePath = join(localesDir, `${locale}.json`);
  const content = await readFile(filePath, 'utf-8');
  const translations = JSON.parse(content) as TranslationDictionary;
  cache.set(locale, translations);
  return translations;
}

/**
 * Resolves a pluralized translation key based on count.
 * Looks up `key.zero`, `key.one`, or `key.other` and replaces
 * `{count}` placeholders with the actual number.
 *
 * Pluralization rules:
 *   count === 0 -> key.zero (falls back to key.other)
 *   count === 1 -> key.one  (falls back to key.other)
 *   otherwise   -> key.other
 */
export function tPlural(translations: TranslationDictionary, key: string, count: number): string {
  let suffix: string;
  if (count === 0) {
    suffix = 'zero';
  } else if (count === 1) {
    suffix = 'one';
  } else {
    suffix = 'other';
  }

  const primary = t(translations, `${key}.${suffix}`);
  const resolved = primary !== `${key}.${suffix}` ? primary : t(translations, `${key}.other`);

  if (resolved === `${key}.other`) {
    return key;
  }

  return resolved.replace('{count}', String(count));
}

export function t(translations: TranslationDictionary, key: string): string {
  const parts = key.split('.');
  let current: string | TranslationDictionary = translations;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return key;
    }
    const value: string | TranslationDictionary | undefined = current[part];
    if (value === undefined) {
      return key;
    }
    current = value;
  }

  if (typeof current === 'string') {
    return current;
  }

  return key;
}

export async function getTranslations(locale: string): Promise<TranslationDictionary> {
  const resolvedLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const translations = await loadLocale(resolvedLocale);

  if (resolvedLocale !== DEFAULT_LOCALE) {
    const fallback = await loadLocale(DEFAULT_LOCALE);
    return mergeWithFallback(translations, fallback);
  }

  return translations;
}

function mergeWithFallback(
  primary: TranslationDictionary,
  fallback: TranslationDictionary,
): TranslationDictionary {
  const result: TranslationDictionary = { ...fallback };

  for (const key of Object.keys(primary)) {
    const primaryValue = primary[key];
    const fallbackValue = result[key];

    if (
      typeof primaryValue === 'object' &&
      primaryValue !== null &&
      typeof fallbackValue === 'object' &&
      fallbackValue !== null
    ) {
      result[key] = mergeWithFallback(
        primaryValue as TranslationDictionary,
        fallbackValue as TranslationDictionary,
      );
    } else {
      result[key] = primaryValue as string | TranslationDictionary;
    }
  }

  return result;
}
