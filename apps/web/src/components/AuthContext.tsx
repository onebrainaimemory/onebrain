'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { apiClient } from './ApiClient';
import deTranslations from '@onebrain/i18n/locales/de.json';
import enTranslations from '@onebrain/i18n/locales/en.json';
import esTranslations from '@onebrain/i18n/locales/es.json';

type Locale = 'de' | 'en' | 'es';

interface TranslationDictionary {
  [key: string]: string | TranslationDictionary;
}

interface User {
  id: string;
  email: string;
  region?: string;
  role?: string;
  totpEnabled?: boolean;
}

interface AuthContextValue {
  token: string | null;
  user: User | null;
  locale: Locale;
  translations: TranslationDictionary;
  isLoading: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  setLocale: (locale: Locale) => void;
  logout: () => void;
  t: (key: string) => string;
}

const localeMap: Record<Locale, TranslationDictionary> = {
  de: deTranslations as TranslationDictionary,
  en: enTranslations as TranslationDictionary,
  es: esTranslations as TranslationDictionary,
};

const SUPPORTED_LOCALES: Locale[] = ['de', 'en', 'es'];

function isValidLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

function translateKey(translations: TranslationDictionary, key: string): string {
  const parts = key.split('.');
  let current: string | TranslationDictionary = translations;

  for (const part of parts) {
    if (typeof current !== 'object' || current === null) {
      return key;
    }
    const value = (current as TranslationDictionary)[part];
    if (value === undefined) {
      return key;
    }
    current = value as string | TranslationDictionary;
  }

  if (typeof current === 'string') {
    return current;
  }

  return key;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [locale, setLocaleState] = useState<Locale>('en');
  const [isLoading, setIsLoading] = useState(true);

  const translations = useMemo(() => localeMap[locale], [locale]);

  const t = useCallback((key: string) => translateKey(translations, key), [translations]);

  const setToken = useCallback((newToken: string | null) => {
    // Token is now stored in httpOnly cookie by the server.
    // We keep a reference for backward compat but don't use localStorage.
    setTokenState(newToken);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem('onebrain_locale', newLocale);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/v1/auth/logout');
    } catch {
      // Silent — clear state regardless
    }
    setTokenState(null);
    setUser(null);
  }, []);

  // Listen for session-expired events from ApiClient
  useEffect(() => {
    function handleSessionExpired() {
      setTokenState(null);
      setUser(null);
      // Only redirect to login from protected pages (dashboard)
      // Public pages should never force a login redirect
      if (typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')) {
        window.location.href = '/login?expired=true';
      }
    }

    window.addEventListener('onebrain:session-expired', handleSessionExpired);
    return () => {
      window.removeEventListener('onebrain:session-expired', handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    const savedLocale = localStorage.getItem('onebrain_locale');
    if (savedLocale && isValidLocale(savedLocale)) {
      setLocaleState(savedLocale);
    }

    // Only check session on protected pages (dashboard)
    // Public pages (landing, invite, faq, legal, etc.) don't need auth
    const isProtectedPage =
      typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard');

    if (!isProtectedPage) {
      setIsLoading(false);
      return;
    }

    // Try to authenticate via httpOnly cookie
    apiClient
      .get<User>('/v1/auth/me')
      .then((response) => {
        if (response.data) {
          setUser(response.data);
          setTokenState('cookie-auth');
        }
      })
      .catch(() => {
        // Not authenticated — that's fine
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const value = useMemo(
    () => ({
      token,
      user,
      locale,
      translations,
      isLoading,
      setToken,
      setUser,
      setLocale,
      logout,
      t,
    }),
    [token, user, locale, translations, isLoading, setToken, setUser, setLocale, logout, t],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
