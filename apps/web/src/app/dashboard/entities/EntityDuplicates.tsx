'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/components/ApiClient';
import styles from './entity-duplicates.module.css';

interface EntityDto {
  id: string;
  name: string;
  type: string;
  description: string | null;
  createdAt: string;
}

interface DuplicatePair {
  entityA: EntityDto;
  entityB: EntityDto;
  similarity: number;
}

interface DuplicatesResponse {
  duplicates: DuplicatePair[];
}

interface EntityDuplicatesProps {
  t: (key: string) => string;
  onMerged: () => void;
}

export function EntityDuplicates({ t, onMerged }: EntityDuplicatesProps) {
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [mergingIdx, setMergingIdx] = useState<number | null>(null);
  const [confirmIdx, setConfirmIdx] = useState<number | null>(null);

  const fetchDuplicates = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.get<DuplicatesResponse>('/v1/entities/duplicates');

      if (response.data) {
        setDuplicates(response.data.duplicates ?? []);
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
    fetchDuplicates();
  }, [fetchDuplicates]);

  async function handleMerge(keepId: string, removeId: string, idx: number) {
    setMergingIdx(idx);
    setError('');

    try {
      const response = await apiClient.post('/v1/entities/merge', {
        keepId,
        removeId,
      });

      if (response.error) {
        setError(response.error.message);
      } else {
        setDuplicates((prev) => prev.filter((_, i) => i !== idx));
        setConfirmIdx(null);
        onMerged();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setMergingIdx(null);
    }
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (duplicates.length === 0) {
    return <p className={styles.empty}>{t('entities.duplicates_empty')}</p>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>{t('entities.duplicates_title')}</h2>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.list}>
        {duplicates.map((pair, idx) => (
          <div key={idx} className={styles.card}>
            <div className={styles.pairRow}>
              <div className={styles.entitySide}>
                <p className={styles.entityName}>{pair.entityA.name}</p>
                <span className={styles.entityType}>{pair.entityA.type}</span>
                {pair.entityA.description && (
                  <p className={styles.entityDesc}>{pair.entityA.description}</p>
                )}
              </div>

              <div className={styles.similarityBadge}>{Math.round(pair.similarity * 100)}%</div>

              <div className={styles.entitySide}>
                <p className={styles.entityName}>{pair.entityB.name}</p>
                <span className={styles.entityType}>{pair.entityB.type}</span>
                {pair.entityB.description && (
                  <p className={styles.entityDesc}>{pair.entityB.description}</p>
                )}
              </div>
            </div>

            {confirmIdx === idx ? (
              <div className={styles.confirmRow}>
                <span className={styles.confirmText}>{t('entities.merge_confirm')}</span>
                <div className={styles.confirmActions}>
                  <button
                    className={styles.keepButton}
                    onClick={() => handleMerge(pair.entityA.id, pair.entityB.id, idx)}
                    disabled={mergingIdx === idx}
                  >
                    {t('entities.keep')} A
                  </button>
                  <button
                    className={styles.keepButton}
                    onClick={() => handleMerge(pair.entityB.id, pair.entityA.id, idx)}
                    disabled={mergingIdx === idx}
                  >
                    {t('entities.keep')} B
                  </button>
                  <button
                    className={styles.cancelButton}
                    onClick={() => setConfirmIdx(null)}
                    disabled={mergingIdx === idx}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.actions}>
                <button className={styles.mergeButton} onClick={() => setConfirmIdx(idx)}>
                  {t('entities.merge')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
