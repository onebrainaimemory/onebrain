'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './verify.module.css';

interface VerifyResponse {
  accessToken?: string;
  user?: {
    id: string;
    email: string;
    displayName: string | null;
    region: string | null;
    locale: string;
    role: string;
  };
  isNewUser?: boolean;
  message?: string;
  requires2fa?: boolean;
  requiresSetup2fa?: boolean;
}

type VerifyState = 'loading' | 'success' | 'error';

function VerifyContent() {
  const { t, setToken, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<VerifyState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const hasVerified = useRef(false);

  useEffect(() => {
    if (hasVerified.current) return;
    hasVerified.current = true;

    const token = searchParams.get('token');
    if (!token) {
      setState('error');
      setErrorMessage(t('auth.verify.missing_token'));
      return;
    }

    verifyToken(token);
  }, []);

  async function verifyToken(token: string) {
    try {
      const response = await apiClient.post<VerifyResponse>('/v1/auth/verify', { token });

      if (response.error) {
        setState('error');
        setErrorMessage(response.error.message || t('auth.verify.failed'));
        return;
      }

      if (!response.data) {
        setState('error');
        setErrorMessage(t('auth.verify.failed'));
        return;
      }

      // User has TOTP enabled — go enter code (temp token in httpOnly cookie)
      if (response.data.requires2fa) {
        setState('success');
        window.location.href = '/auth/verify-2fa';
        return;
      }

      // Authenticate
      if (response.data.accessToken) {
        setToken(response.data.accessToken);
      }

      if (response.data.user) {
        setUser({
          id: response.data.user.id,
          email: response.data.user.email,
          region: response.data.user.region ?? undefined,
          role: response.data.user.role,
          totpEnabled: false,
        });
      }

      setState('success');

      // User has no TOTP — force setup (mandatory 2FA)
      if (response.data.requiresSetup2fa) {
        window.location.href = '/auth/setup-2fa';
        return;
      }

      // User has TOTP and verified — go to dashboard
      const user = response.data.user;
      if (user) {
        const hasRegion = user.region !== null && user.region !== undefined;
        const dest = user.role === 'admin' ? '/dashboard/admin' : '/dashboard';
        router.push(hasRegion ? dest : '/region');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setState('error');
      setErrorMessage(t('auth.verify.failed'));
    }
  }

  return (
    <div className={styles.card}>
      <h1 className={styles.title}>{t('auth.verify.title')}</h1>

      {state === 'loading' && (
        <>
          <p className={styles.subtitle}>{t('auth.verify.verifying')}</p>
          <div className={styles.spinner} />
        </>
      )}

      {state === 'success' && (
        <div className={styles.successMessage}>{t('auth.verify.success')}</div>
      )}

      {state === 'error' && (
        <>
          <div className={styles.errorMessage}>{errorMessage}</div>
          <Link href="/login" className={styles.link}>
            {t('auth.verify.back_to_login')}
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className={styles.container}>
      <Suspense
        fallback={
          <div className={styles.card}>
            <div className={styles.spinner} />
          </div>
        }
      >
        <VerifyContent />
      </Suspense>
    </div>
  );
}
