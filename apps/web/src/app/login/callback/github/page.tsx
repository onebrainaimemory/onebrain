'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';

interface OAuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: string;
    locale: string;
    role: string;
  };
  isNewUser: boolean;
}

export default function GitHubCallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
          }}
        >
          <p>Loading...</p>
        </div>
      }
    >
      <GitHubCallbackContent />
    </Suspense>
  );
}

function GitHubCallbackContent() {
  const { t, locale, setToken, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      router.replace('/login');
      return;
    }

    async function exchangeCode(authCode: string) {
      try {
        const response = await apiClient.post<OAuthResponse>('/v1/auth/oauth/github', {
          code: authCode,
          locale,
        });

        if (response.error) {
          setError(response.error.message);
          return;
        }

        if (response.data) {
          const { user: u } = response.data;
          setToken(response.data.accessToken);
          setUser({
            id: u.id,
            email: u.email,
            region: u.region,
            role: u.role,
          });
          router.replace(u.role === 'admin' ? '/dashboard/admin' : '/dashboard');
        }
      } catch {
        setError(t('auth.oauth.error'));
      }
    }

    exchangeCode(code);
  }, [searchParams, locale, router, setToken, setUser, t]);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <p style={{ color: '#d32f2f' }}>{error}</p>
        <a href="/login" style={{ color: '#2563eb' }}>
          {t('auth.login.title')}
        </a>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
      }}
    >
      <p>{t('common.loading')}</p>
    </div>
  );
}
