'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/components/ApiClient';
import styles from './merge-history.module.css';

interface MergeLogEntry {
  action: string;
  memoryIds: string[];
  reason: string;
  timestamp: string;
}

interface BrainVersionItem {
  id: string;
  version: number;
  snapshot: {
    memoriesCount?: number;
    rollbackFrom?: number;
  };
  mergeLog: MergeLogEntry[];
  createdAt: string;
}

interface HistoryResponse {
  items: BrainVersionItem[];
  cursor: string | null;
  hasMore: boolean;
  total: number;
}

interface RollbackResponse {
  success: boolean;
  versionId: string | null;
  restoredCount: number;
}

interface MergeHistoryProps {
  t: (key: string) => string;
  locale: string;
}

function formatDate(isoString: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString();
  }
}

export function MergeHistory({ t, locale }: MergeHistoryProps) {
  const [versions, setVersions] = useState<BrainVersionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.get<HistoryResponse>('/v1/merge/history', { limit: '20' });

      if (response.data) {
        setVersions(response.data.items ?? []);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  async function handleRollback(version: number) {
    setIsRollingBack(true);
    setError('');

    try {
      const response = await apiClient.post<RollbackResponse>(`/v1/merge/rollback/${version}`);

      if (response.data?.success) {
        setConfirmVersion(null);
        const msg = t('brain.rollback_success').replace('{version}', String(version));
        setSuccessMsg(msg);
        setTimeout(() => setSuccessMsg(''), 4000);
        await fetchHistory();
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsRollingBack(false);
    }
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('brain.merge_history')}</h2>

      {error && <p className={styles.error}>{error}</p>}
      {successMsg && <p className={styles.success}>{successMsg}</p>}

      {versions.length === 0 && <p className={styles.empty}>{t('brain.no_versions')}</p>}

      {versions.length > 0 && (
        <div className={styles.list}>
          {versions.map((version) => {
            const memoriesCount = version.snapshot?.memoriesCount ?? 0;
            const isRollback = version.snapshot?.rollbackFrom !== undefined;

            return (
              <div key={version.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardInfo}>
                    <span className={styles.versionBadge}>v{version.version}</span>
                    {isRollback && (
                      <span className={styles.rollbackBadge}>{t('brain.rollback_title')}</span>
                    )}
                  </div>
                  <span className={styles.cardDate}>{formatDate(version.createdAt, locale)}</span>
                </div>

                <div className={styles.cardBody}>
                  <span className={styles.stat}>
                    {memoriesCount} {t('brain.merge_memories_count')}
                  </span>
                </div>

                {confirmVersion === version.version ? (
                  <div className={styles.confirmRow}>
                    <p className={styles.confirmText}>{t('brain.rollback_confirm')}</p>
                    <div className={styles.confirmActions}>
                      <button
                        className={styles.confirmYes}
                        onClick={() => handleRollback(version.version)}
                        disabled={isRollingBack}
                      >
                        {isRollingBack ? t('common.loading') : t('common.confirm')}
                      </button>
                      <button
                        className={styles.confirmNo}
                        onClick={() => setConfirmVersion(null)}
                        disabled={isRollingBack}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cardActions}>
                    <button
                      className={styles.rollbackButton}
                      onClick={() => setConfirmVersion(version.version)}
                    >
                      {t('brain.rollback')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
