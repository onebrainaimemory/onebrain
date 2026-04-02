'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './sessions.module.css';

interface SessionData {
  id: string;
  deviceName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  region: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export default function SessionsPage() {
  const { t, locale } = useAuth();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setErrorMsg(null);
    try {
      const response = await apiClient.get<SessionData[]>('/v1/auth/sessions');
      if (response.data) {
        setSessions(response.data);
      }
      if (response.error) {
        setErrorMsg(response.error.message);
      }
    } catch {
      setErrorMsg(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = useCallback(
    async (sessionId: string) => {
      setRevokingId(sessionId);
      setErrorMsg(null);
      try {
        const response = await apiClient.delete(`/v1/auth/sessions/${sessionId}`);
        if (response.error) {
          setErrorMsg(response.error.message);
        } else {
          setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        }
      } catch {
        setErrorMsg(t('common.error'));
      } finally {
        setRevokingId(null);
      }
    },
    [t],
  );

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('auth.sessions.title')}
        <InfoTooltip text={t('help.sessions_title')} />
      </h1>

      {errorMsg && <div className={styles.errorMessage}>{errorMsg}</div>}

      {sessions.length === 0 ? (
        <p className={styles.empty}>{t('auth.sessions.empty')}</p>
      ) : (
        <ul className={styles.sessionList}>
          {sessions.map((session) => (
            <li
              key={session.id}
              className={`${styles.sessionCard} ${session.isCurrent ? styles.currentSession : ''}`}
            >
              <div className={styles.sessionInfo}>
                <span className={styles.deviceName}>
                  {session.deviceName ?? t('auth.sessions.unknown_device')}
                  {session.isCurrent && (
                    <span className={styles.currentBadge}>{t('auth.sessions.current')}</span>
                  )}
                </span>
                <div className={styles.sessionMeta}>
                  {session.ipAddress && <span>{session.ipAddress}</span>}
                  <span>{session.region}</span>
                  <span>
                    {formatDate(session.createdAt, locale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>

              {!session.isCurrent && (
                <button
                  type="button"
                  className={styles.revokeButton}
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokingId === session.id}
                >
                  {revokingId === session.id ? t('common.loading') : t('auth.sessions.revoke')}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
