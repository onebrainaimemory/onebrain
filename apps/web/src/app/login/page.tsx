'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import styles from './login.module.css';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? '';
const GITHUB_CLIENT_ID = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID ?? '';

interface DemoLoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    displayName: string | null;
    region: string;
    locale: string;
    role: string;
  };
}

interface OAuthLoginResponse {
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

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: {
          clientId: string;
          scope: string;
          redirectURI: string;
          usePopup: boolean;
        }) => void;
        signIn: () => Promise<{
          authorization: { id_token: string };
        }>;
      };
    };
  }
}

function LoginContent() {
  const { t, locale, setToken, setUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSessionExpired = searchParams.get('expired') === 'true';
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [isDemoUserLoading, setIsDemoUserLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState('');

  const hasOAuth = !!GOOGLE_CLIENT_ID || !!APPLE_CLIENT_ID || !!GITHUB_CLIENT_ID;

  const handleOAuthSuccess = useCallback(
    (data: OAuthLoginResponse) => {
      const { user: u } = data;
      setToken(data.accessToken);
      setUser({
        id: u.id,
        email: u.email,
        region: u.region,
        role: u.role,
      });
      router.push(u.role === 'admin' ? '/dashboard/admin' : '/dashboard');
    },
    [setToken, setUser, router],
  );

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production') {
      setIsDemoMode(true);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  async function handleSubmit() {
    setError('');
    setIsSubmitting(true);

    try {
      const response = await apiClient.post('/v1/auth/magic-link', {
        email,
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      setIsSent(true);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    if (!window.google) {
      setError(t('auth.oauth.error'));
      return;
    }

    setIsOAuthLoading('google');
    setError('');

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (response: { credential: string }) => {
        try {
          const result = await apiClient.post<OAuthLoginResponse>('/v1/auth/oauth/google', {
            idToken: response.credential,
            locale,
          });

          if (result.error) {
            setError(result.error.message);
            setIsOAuthLoading('');
            return;
          }

          if (result.data) {
            handleOAuthSuccess(result.data);
          }
        } catch {
          setError(t('auth.oauth.error'));
          setIsOAuthLoading('');
        }
      },
    });

    window.google.accounts.id.prompt();
  }

  async function handleAppleLogin() {
    setIsOAuthLoading('apple');
    setError('');

    try {
      const script = document.createElement('script');
      script.src =
        'https://appleid.cdn-apple.com/appleauth/static/' + 'jsapi/appleid/1/en_US/appleid.auth.js';

      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load'));
        document.head.appendChild(script);
      });

      if (!window.AppleID) {
        throw new Error('AppleID not available');
      }

      window.AppleID.auth.init({
        clientId: APPLE_CLIENT_ID,
        scope: 'email name',
        redirectURI: window.location.origin + '/login',
        usePopup: true,
      });

      const appleResponse = await window.AppleID.auth.signIn();
      const idToken = appleResponse.authorization.id_token;

      const result = await apiClient.post<OAuthLoginResponse>('/v1/auth/oauth/apple', {
        idToken,
        locale,
      });

      if (result.error) {
        setError(result.error.message);
        setIsOAuthLoading('');
        return;
      }

      if (result.data) {
        handleOAuthSuccess(result.data);
      }
    } catch {
      setError(t('auth.oauth.error'));
      setIsOAuthLoading('');
    }
  }

  function handleGitHubLogin() {
    setIsOAuthLoading('github');
    setError('');

    const redirectUri = encodeURIComponent(window.location.origin + '/login/callback/github');
    const scope = encodeURIComponent('user:email');

    window.location.href =
      'https://github.com/login/oauth/authorize' +
      `?client_id=${GITHUB_CLIENT_ID}` +
      `&redirect_uri=${redirectUri}` +
      `&scope=${scope}`;
  }

  async function handleDemoLoginAs(endpoint: string, setLoading: (v: boolean) => void) {
    setError('');
    setLoading(true);

    try {
      const response = await apiClient.post<DemoLoginResponse>(endpoint);

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
        router.push(u.role === 'admin' ? '/dashboard/admin' : '/dashboard');
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.languageCorner}>
        <LanguageSwitcher />
      </div>

      <div className={styles.card}>
        {isSessionExpired && (
          <div className={styles.sessionExpiredBanner}>{t('auth.session_expired')}</div>
        )}
        <h1 className={styles.title}>{t('auth.login.title')}</h1>
        <p className={styles.subtitle}>{t('auth.login.subtitle')}</p>

        {isSent ? (
          <div className={styles.successMessage}>{t('auth.magic_link.sent')}</div>
        ) : (
          <>
            <div className={styles.form}>
              <input
                type="email"
                className={styles.input}
                placeholder={t('auth.login.email_placeholder')}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && email && !isSubmitting) {
                    handleSubmit();
                  }
                }}
                autoFocus
                autoComplete="off"
                data-1p-ignore
                data-lpignore="true"
                data-form-type="other"
              />

              {error && <p className={styles.error}>{error}</p>}

              <button
                type="button"
                className={styles.button}
                disabled={isSubmitting || !email}
                onClick={handleSubmit}
              >
                {isSubmitting ? t('common.loading') : t('auth.login.submit')}
              </button>
            </div>

            {hasOAuth && (
              <>
                <div className={styles.divider}>{t('auth.oauth.or')}</div>

                <div className={styles.oauthSection}>
                  {GOOGLE_CLIENT_ID && (
                    <button
                      type="button"
                      className={styles.oauthButton}
                      onClick={handleGoogleLogin}
                      disabled={!!isOAuthLoading}
                    >
                      <svg className={styles.oauthIcon} viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 0 12c0 1.94.46 3.77 1.28 5.4l3.56-2.77z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      {isOAuthLoading === 'google'
                        ? t('common.loading')
                        : t('auth.oauth.google_button')}
                    </button>
                  )}

                  {APPLE_CLIENT_ID && (
                    <button
                      type="button"
                      className={styles.oauthButton}
                      onClick={handleAppleLogin}
                      disabled={!!isOAuthLoading}
                    >
                      <svg className={styles.oauthIcon} viewBox="0 0 24 24">
                        <path
                          fill="#000"
                          d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
                        />
                      </svg>
                      {isOAuthLoading === 'apple'
                        ? t('common.loading')
                        : t('auth.oauth.apple_button')}
                    </button>
                  )}

                  {GITHUB_CLIENT_ID && (
                    <button
                      type="button"
                      className={styles.oauthButton}
                      onClick={handleGitHubLogin}
                      disabled={!!isOAuthLoading}
                    >
                      <svg className={styles.oauthIcon} viewBox="0 0 24 24">
                        <path
                          fill="#333"
                          d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                        />
                      </svg>
                      {isOAuthLoading === 'github'
                        ? t('common.loading')
                        : t('auth.oauth.github_button')}
                    </button>
                  )}
                </div>
              </>
            )}

            {isDemoMode && (
              <>
                <div className={styles.divider}>{t('auth.login.or')}</div>

                <button
                  className={styles.demoButton}
                  onClick={() => handleDemoLoginAs('/v1/auth/demo-login', setIsDemoLoading)}
                  disabled={isDemoLoading || isDemoUserLoading}
                >
                  {isDemoLoading ? t('common.loading') : t('auth.login.demo_admin')}
                </button>

                <button
                  className={styles.demoButton}
                  onClick={() =>
                    handleDemoLoginAs('/v1/auth/demo-user-login', setIsDemoUserLoading)
                  }
                  disabled={isDemoLoading || isDemoUserLoading}
                >
                  {isDemoUserLoading ? t('common.loading') : t('auth.login.demo_user')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <div className={styles.card}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid #e5e5e5',
                borderTopColor: '#111',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                margin: '24px auto',
              }}
            />
          </div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
