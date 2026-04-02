import { describe, it, expect } from 'vitest';
import { t, tPlural, loadLocale } from '@onebrain/i18n';
import type { TranslationDictionary } from '@onebrain/i18n';

describe('tPlural', () => {
  const translations: TranslationDictionary = {
    memory_count: {
      zero: 'No Memories',
      one: '1 Memory',
      other: '{count} Memories',
    },
    entity_count: {
      zero: 'No Entities',
      one: '1 Entity',
      other: '{count} Entities',
    },
    only_other: {
      other: '{count} items',
    },
  };

  describe('basic pluralization', () => {
    it('should return zero form for count 0', () => {
      expect(tPlural(translations, 'memory_count', 0)).toBe('No Memories');
    });

    it('should return one form for count 1', () => {
      expect(tPlural(translations, 'memory_count', 1)).toBe('1 Memory');
    });

    it('should return other form for count > 1', () => {
      expect(tPlural(translations, 'memory_count', 5)).toBe('5 Memories');
    });

    it('should replace {count} placeholder with actual number', () => {
      expect(tPlural(translations, 'memory_count', 42)).toBe('42 Memories');
    });

    it('should handle large numbers', () => {
      expect(tPlural(translations, 'memory_count', 1000)).toBe('1000 Memories');
    });
  });

  describe('fallback behavior', () => {
    it('should fall back to other when zero is missing', () => {
      expect(tPlural(translations, 'only_other', 0)).toBe('0 items');
    });

    it('should fall back to other when one is missing', () => {
      expect(tPlural(translations, 'only_other', 1)).toBe('1 items');
    });

    it('should return key when translation is missing', () => {
      expect(tPlural(translations, 'nonexistent', 5)).toBe('nonexistent');
    });
  });

  describe('different keys', () => {
    it('should work with entity_count', () => {
      expect(tPlural(translations, 'entity_count', 0)).toBe('No Entities');
      expect(tPlural(translations, 'entity_count', 1)).toBe('1 Entity');
      expect(tPlural(translations, 'entity_count', 10)).toBe('10 Entities');
    });
  });

  describe('with loaded locale files', () => {
    it('should work with English locale', async () => {
      const en = await loadLocale('en');
      expect(tPlural(en, 'memory_count', 0)).toBe('No Memories');
      expect(tPlural(en, 'memory_count', 1)).toBe('1 Memory');
      expect(tPlural(en, 'memory_count', 99)).toBe('99 Memories');
    });

    it('should work with German locale', async () => {
      const de = await loadLocale('de');
      expect(tPlural(de, 'memory_count', 0)).toBe('Keine Erinnerungen');
      expect(tPlural(de, 'memory_count', 1)).toBe('1 Erinnerung');
      expect(tPlural(de, 'memory_count', 5)).toBe('5 Erinnerungen');
    });

    it('should work with Spanish locale', async () => {
      const es = await loadLocale('es');
      expect(tPlural(es, 'memory_count', 0)).toBe('Sin recuerdos');
      expect(tPlural(es, 'memory_count', 1)).toBe('1 Recuerdo');
      expect(tPlural(es, 'memory_count', 25)).toBe('25 Recuerdos');
    });
  });
});

describe('t (basic translation)', () => {
  it('should resolve nested keys', async () => {
    const en = await loadLocale('en');
    expect(t(en, 'auth.login.title')).toBe('Sign in to OneBrain');
  });

  it('should return key for missing translations', async () => {
    const en = await loadLocale('en');
    expect(t(en, 'nonexistent.key')).toBe('nonexistent.key');
  });
});
