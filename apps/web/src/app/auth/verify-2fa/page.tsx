'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './verify-2fa.module.css';

interface ValidateResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: string | null;
    locale: string;
    role: string;
  };
  isNewUser: boolean;
}

export default function Verify2faPage() {
  const { t, setToken, setUser } = useAuth();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiClient.post<ValidateResponse>('/v1/auth/2fa/validate', { code });

      if (response.error) {
        setError(response.error.message || t('auth.2fa.invalid_code'));
        setIsSubmitting(false);
        return;
      }

      if (!response.data) {
        setError(t('auth.2fa.invalid_code'));
        setIsSubmitting(false);
        return;
      }

      setToken(response.data.accessToken);
      setUser({
        id: response.data.user.id,
        email: response.data.user.email,
        region: response.data.user.region ?? undefined,
        role: response.data.user.role,
        totpEnabled: true,
      });
      setIsSuccess(true);

      const hasRegion =
        response.data.user.region !== null && response.data.user.region !== undefined;
      const dest = response.data.user.role === 'admin' ? '/dashboard/admin' : '/dashboard';
      router.push(hasRegion ? dest : '/region');
    } catch {
      setError(t('auth.2fa.invalid_code'));
      setIsSubmitting(false);
    }
  }

  function handleCodeChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('auth.2fa.validate_title')}</h1>
        <p className={styles.subtitle}>{t('auth.2fa.validate_desc')}</p>

        {isSuccess ? (
          <div className={styles.successMessage}>{t('auth.verify.success')}</div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
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
              disabled={code.length !== 6 || isSubmitting}
            >
              {isSubmitting ? t('common.loading') : t('auth.2fa.verify')}
            </button>

            <Link href="/login" className={styles.backLink}>
              {t('auth.verify.back_to_login')}
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
