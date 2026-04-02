'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './setup-2fa.module.css';

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
}

interface VerifyResponse {
  message: string;
}

type SetupState = 'loading' | 'ready' | 'verifying' | 'success' | 'error';

export default function Setup2faPage() {
  const { t, user: currentUser, setUser } = useAuth();
  const router = useRouter();
  const [state, setState] = useState<SetupState>('loading');
  const [secret, setSecret] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const hasSetup = useRef(false);

  useEffect(() => {
    if (hasSetup.current) return;
    hasSetup.current = true;
    setupTotp();
  }, []);

  async function setupTotp() {
    try {
      const response = await apiClient.post<SetupResponse>('/v1/auth/2fa/setup');

      if (response.error) {
        // Already enabled — mark TOTP done and redirect to dashboard
        if (response.error.code === 'TOTP_ALREADY_ENABLED') {
          if (currentUser) {
            setUser({ ...currentUser, totpEnabled: true });
          }
          router.push('/dashboard');
          return;
        }
        setState('error');
        setError(response.error.message);
        return;
      }

      if (!response.data) {
        setState('error');
        setError(t('common.error'));
        return;
      }

      setSecret(response.data.secret);

      const QRCode = await import('qrcode');
      const dataUrl = await QRCode.toDataURL(response.data.otpauthUrl, {
        width: 256,
        margin: 2,
        color: { dark: '#111111', light: '#ffffff' },
      });
      setQrDataUrl(dataUrl);
      setState('ready');
    } catch {
      setState('error');
      setError(t('common.error'));
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setState('verifying');

    try {
      const response = await apiClient.post<VerifyResponse>('/v1/auth/2fa/verify', { code });

      if (response.error) {
        setState('ready');
        setError(response.error.message || t('auth.2fa.invalid_code'));
        return;
      }

      setState('success');

      const meResponse = await apiClient.get<{
        id: string;
        email: string;
        region: string | null;
        role: string;
        totpEnabled: boolean;
      }>('/v1/auth/me');

      if (meResponse.data) {
        setUser({
          id: meResponse.data.id,
          email: meResponse.data.email,
          region: meResponse.data.region ?? undefined,
          role: meResponse.data.role,
          totpEnabled: true,
        });
        const hasRegion = meResponse.data.region !== null && meResponse.data.region !== undefined;
        const dest = meResponse.data.role === 'admin' ? '/dashboard/admin' : '/dashboard';
        router.push(hasRegion ? dest : '/region');
      } else {
        router.push('/dashboard');
      }
    } catch {
      setState('ready');
      setError(t('auth.2fa.invalid_code'));
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('auth.2fa.setup_title')}</h1>
        <p className={styles.subtitle}>{t('auth.2fa.setup_mandatory')}</p>

        {state === 'loading' && <div className={styles.spinner} />}

        {state === 'error' && !secret && (
          <>
            <div className={styles.errorMessage}>{error}</div>
            <Link href="/login" className={styles.link}>
              {t('auth.verify.back_to_login')}
            </Link>
          </>
        )}

        {(state === 'ready' || state === 'verifying') && (
          <>
            <p className={styles.instructions}>{t('auth.2fa.setup_desc')}</p>

            {qrDataUrl && (
              <div className={styles.qrContainer}>
                <img
                  src={qrDataUrl}
                  alt="QR Code for authenticator app"
                  className={styles.qrCode}
                  width={256}
                  height={256}
                />
              </div>
            )}

            <div className={styles.secretContainer}>
              <p className={styles.secretLabel}>{t('auth.2fa.manual_entry')}</p>
              <code className={styles.secretCode}>{secret}</code>
            </div>

            <form onSubmit={handleVerify} className={styles.form}>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={styles.codeInput}
                placeholder={t('auth.2fa.code_placeholder')}
                value={code}
                onChange={(e) => handleCodeChange(e.target.value)}
                maxLength={6}
                autoFocus
              />

              {error && <p className={styles.error}>{error}</p>}

              <button
                type="submit"
                className={styles.button}
                disabled={code.length !== 6 || state === 'verifying'}
              >
                {state === 'verifying' ? t('common.loading') : t('auth.2fa.enable')}
              </button>
            </form>
          </>
        )}

        {state === 'success' && (
          <div className={styles.successMessage}>{t('auth.2fa.setup_success')}</div>
        )}
      </div>
    </div>
  );
}
