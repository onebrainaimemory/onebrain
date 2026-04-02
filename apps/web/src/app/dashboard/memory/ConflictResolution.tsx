'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/components/ApiClient';
import styles from './conflicts.module.css';

interface MemoryItem {
  id: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  createdAt: string;
}

interface ConflictResolutionProps {
  t: (key: string) => string;
  locale: string;
}

function formatDate(isoString: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString();
  }
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '...';
}

export function ConflictResolution({ t, locale }: ConflictResolutionProps) {
  const [conflicts, setConflicts] = useState<MemoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchConflicts = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.get<MemoryItem[]>('/v1/memory', {
        status: 'conflicted',
        limit: '100',
      });

      if (response.data) {
        setConflicts(response.data);
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
    fetchConflicts();
  }, [fetchConflicts]);

  async function resolveKeepOne(keepId: string, archiveId: string) {
    setResolvingId(keepId);
    setError('');

    try {
      // Activate the kept one
      await apiClient.patch(`/v1/memory/${keepId}`, {
        status: 'active',
      });

      // Archive the other
      await apiClient.patch(`/v1/memory/${archiveId}`, {
        status: 'archived',
      });

      setConflicts((prev) => prev.filter((m) => m.id !== keepId && m.id !== archiveId));

      setSuccessMsg(t('memory.conflict_resolved'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setError(t('common.error'));
    } finally {
      setResolvingId(null);
    }
  }

  async function resolveKeepBoth(idA: string, idB: string) {
    setResolvingId(idA);
    setError('');

    try {
      await Promise.all([
        apiClient.patch(`/v1/memory/${idA}`, {
          status: 'active',
        }),
        apiClient.patch(`/v1/memory/${idB}`, {
          status: 'active',
        }),
      ]);

      setConflicts((prev) => prev.filter((m) => m.id !== idA && m.id !== idB));

      setSuccessMsg(t('memory.conflict_resolved'));
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch {
      setError(t('common.error'));
    } finally {
      setResolvingId(null);
    }
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (conflicts.length === 0) {
    return <p className={styles.empty}>{t('memory.conflicts_empty')}</p>;
  }

  // Group conflicts into pairs by similar titles
  const pairs: [MemoryItem, MemoryItem][] = [];
  const used = new Set<string>();

  for (let i = 0; i < conflicts.length; i++) {
    if (used.has(conflicts[i]!.id)) continue;

    for (let j = i + 1; j < conflicts.length; j++) {
      if (used.has(conflicts[j]!.id)) continue;

      if (conflicts[i]!.type === conflicts[j]!.type) {
        pairs.push([conflicts[i]!, conflicts[j]!]);
        used.add(conflicts[i]!.id);
        used.add(conflicts[j]!.id);
        break;
      }
    }
  }

  // Remaining unpaired conflicts
  const unpaired = conflicts.filter((c) => !used.has(c.id));

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('memory.conflicts_title')}</h2>
      <p className={styles.description}>{t('memory.conflicts_desc')}</p>

      {error && <p className={styles.error}>{error}</p>}
      {successMsg && <p className={styles.success}>{successMsg}</p>}

      {pairs.map(([left, right], idx) => (
        <div key={idx} className={styles.conflictCard}>
          <div className={styles.comparison}>
            <div className={styles.side}>
              <div className={styles.sideHeader}>
                <span className={styles.sideLabel}>A</span>
                <span className={styles.sideType}>{left.type}</span>
              </div>
              <h4 className={styles.sideTitle}>{left.title}</h4>
              <p className={styles.sideBody}>{truncateText(left.body, 300)}</p>
              <span className={styles.sideDate}>{formatDate(left.createdAt, locale)}</span>
            </div>

            <div className={styles.vsDivider}>{t('memory.vs')}</div>

            <div className={styles.side}>
              <div className={styles.sideHeader}>
                <span className={styles.sideLabel}>B</span>
                <span className={styles.sideType}>{right.type}</span>
              </div>
              <h4 className={styles.sideTitle}>{right.title}</h4>
              <p className={styles.sideBody}>{truncateText(right.body, 300)}</p>
              <span className={styles.sideDate}>{formatDate(right.createdAt, locale)}</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.keepButton}
              onClick={() => resolveKeepOne(left.id, right.id)}
              disabled={resolvingId !== null}
            >
              {t('memory.keep_left')}
            </button>
            <button
              className={styles.keepButton}
              onClick={() => resolveKeepOne(right.id, left.id)}
              disabled={resolvingId !== null}
            >
              {t('memory.keep_right')}
            </button>
            <button
              className={styles.keepBothButton}
              onClick={() => resolveKeepBoth(left.id, right.id)}
              disabled={resolvingId !== null}
            >
              {t('memory.keep_both')}
            </button>
          </div>
        </div>
      ))}

      {/* Show unpaired conflicts as single items */}
      {unpaired.map((memory) => (
        <div key={memory.id} className={styles.singleCard}>
          <div className={styles.sideHeader}>
            <span className={styles.sideType}>{memory.type}</span>
          </div>
          <h4 className={styles.sideTitle}>{memory.title}</h4>
          <p className={styles.sideBody}>{truncateText(memory.body, 300)}</p>
          <div className={styles.actions}>
            <button
              className={styles.keepButton}
              onClick={async () => {
                setResolvingId(memory.id);
                await apiClient.patch(`/v1/memory/${memory.id}`, { status: 'active' });
                setConflicts((prev) => prev.filter((m) => m.id !== memory.id));
                setResolvingId(null);
              }}
              disabled={resolvingId !== null}
            >
              {t('memory.keep_left')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
