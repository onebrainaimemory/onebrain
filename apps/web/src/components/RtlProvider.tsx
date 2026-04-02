'use client';

import { useEffect } from 'react';
import { useAuth } from './AuthContext';

const RTL_LOCALES = new Set(['ar', 'he', 'fa']);

/**
 * Sets the `dir` attribute on the <html> element based on
 * the current locale. RTL languages (ar, he, fa) get dir="rtl",
 * all others get dir="ltr".
 *
 * Infrastructure is ready for RTL languages — no RTL locale
 * is currently available, but adding one will automatically
 * enable RTL layout.
 */
export function RtlProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useAuth();

  useEffect(() => {
    const htmlElement = document.documentElement;
    const direction = RTL_LOCALES.has(locale) ? 'rtl' : 'ltr';
    htmlElement.setAttribute('dir', direction);
    htmlElement.setAttribute('lang', locale);
  }, [locale]);

  return <>{children}</>;
}
