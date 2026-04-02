'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from './AuthContext';
import styles from './LanguageSwitcher.module.css';

type Locale = 'de' | 'en' | 'es';

const localeOptions: { value: Locale; flag: string; short: string; label: string }[] = [
  { value: 'de', flag: '🇩🇪', short: 'DE', label: 'Deutsch' },
  { value: 'en', flag: '🇬🇧', short: 'EN', label: 'English' },
  { value: 'es', flag: '🇪🇸', short: 'ES', label: 'Español' },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = localeOptions.find((o) => o.value === locale) ?? localeOptions[0]!;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(value: Locale) {
    setLocale(value);
    setIsOpen(false);
  }

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        type="button"
      >
        <span className={styles.flag}>{current.flag}</span>
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {isOpen && (
        <ul className={styles.dropdown} role="listbox">
          {localeOptions.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === locale}>
              <button
                className={`${styles.option} ${option.value === locale ? styles.optionActive : ''}`}
                onClick={() => handleSelect(option.value)}
                type="button"
              >
                <span className={styles.flag}>{option.flag}</span>
                <span className={styles.optionShort}>{option.short}</span>
                {option.value === locale && <span className={styles.check}>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
