'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { Navigation } from '@/components/Navigation';
import styles from './dashboard.module.css';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { token, user, isLoading, t } = useAuth();
  const router = useRouter();
  const [totpVerified, setTotpVerified] = useState(false);

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (!isLoading && user && !user.region) {
      router.replace('/region');
    }
  }, [user, isLoading, router]);

  // Mandatory 2FA enforcement — no dashboard access without TOTP
  useEffect(() => {
    if (isLoading || !token) return;

    // Fast path: user state already has totpEnabled info
    if (user?.totpEnabled === true) {
      setTotpVerified(true);
      return;
    }

    if (user?.totpEnabled === false) {
      router.replace('/auth/setup-2fa');
      return;
    }

    // Unknown (e.g. navigated from login page without totpEnabled) — ask API
    apiClient
      .get<{ totpEnabled: boolean }>('/v1/auth/me')
      .then((response) => {
        if (response.data && response.data.totpEnabled === false) {
          router.replace('/auth/setup-2fa');
        } else {
          setTotpVerified(true);
        }
      })
      .catch(() => {
        // Don't block dashboard on transient API errors
        setTotpVerified(true);
      });
  }, [isLoading, token, user, router]);

  if (isLoading || (token && !totpVerified)) {
    return <div className={styles.loadingContainer}>{t('common.loading')}</div>;
  }

  if (!token) {
    return null;
  }

  return (
    <div className={styles.layout}>
      <Navigation />
      <main id="main-content" className={styles.main} role="main">
        {children}
      </main>
    </div>
  );
}
