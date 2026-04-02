'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from './ApiClient';

const CONSENT_COOKIE = 'onebrain_consent';
const CONSENT_VERSION = '1.0';

interface ConsentCategories {
  necessary: boolean;
  statistics: boolean;
  marketing: boolean;
}

function getStoredConsent(): ConsentCategories | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_COOKIE);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentCategories;
  } catch {
    return null;
  }
}

export function CookieConsent() {
  const { t } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [categories, setCategories] = useState<ConsentCategories>({
    necessary: true,
    statistics: false,
    marketing: false,
  });

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setIsVisible(true);
    }
  }, []);

  const saveConsent = useCallback(async (cats: ConsentCategories) => {
    localStorage.setItem(CONSENT_COOKIE, JSON.stringify(cats));
    setIsVisible(false);

    // Persist to backend
    try {
      await apiClient.post('/v1/consents', {
        categories: cats,
        version: CONSENT_VERSION,
      });
    } catch {
      // Silent — consent saved locally regardless
    }
  }, []);

  const acceptAll = useCallback(() => {
    const all = { necessary: true, statistics: true, marketing: true };
    setCategories(all);
    saveConsent(all);
  }, [saveConsent]);

  const acceptSelected = useCallback(() => {
    saveConsent({ ...categories, necessary: true });
  }, [categories, saveConsent]);

  const rejectOptional = useCallback(() => {
    const minimal = {
      necessary: true,
      statistics: false,
      marketing: false,
    };
    setCategories(minimal);
    saveConsent(minimal);
  }, [saveConsent]);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#1a1a2e',
        color: '#e0e0e0',
        padding: '1.5rem',
        zIndex: 9999,
        borderTop: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
      }}
    >
      <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.5 }}>{t('consent.message')}</p>

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', gap: '0.4rem', opacity: 0.6 }}>
          <input type="checkbox" checked disabled />
          {t('consent.necessary')}
        </label>

        <label style={{ display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={categories.statistics}
            onChange={(e) =>
              setCategories((prev) => ({
                ...prev,
                statistics: e.target.checked,
              }))
            }
          />
          {t('consent.statistics')}
        </label>

        <label style={{ display: 'flex', gap: '0.4rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={categories.marketing}
            onChange={(e) =>
              setCategories((prev) => ({
                ...prev,
                marketing: e.target.checked,
              }))
            }
          />
          {t('consent.marketing')}
        </label>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={rejectOptional}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #555',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
          }}
        >
          {t('consent.reject_optional')}
        </button>
        <button
          onClick={acceptSelected}
          style={{
            padding: '0.5rem 1rem',
            border: '1px solid #555',
            borderRadius: '6px',
            backgroundColor: 'transparent',
            color: '#e0e0e0',
            cursor: 'pointer',
          }}
        >
          {t('consent.accept_selected')}
        </button>
        <button
          onClick={acceptAll}
          style={{
            padding: '0.5rem 1rem',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: '#6c5ce7',
            color: '#fff',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          {t('consent.accept_all')}
        </button>
      </div>
    </div>
  );
}
