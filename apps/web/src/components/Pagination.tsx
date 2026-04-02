'use client';

import { useAuth } from './AuthContext';
import styles from './Pagination.module.css';

interface PaginationProps {
  cursor: string | null | undefined;
  hasMore: boolean;
  onNext: (cursor: string) => void;
  onPrevious?: () => void;
  hasPrevious?: boolean;
}

export function Pagination({
  cursor,
  hasMore,
  onNext,
  onPrevious,
  hasPrevious = false,
}: PaginationProps) {
  const { t } = useAuth();

  if (!hasMore && !hasPrevious) {
    return null;
  }

  return (
    <div className={styles.wrapper}>
      {onPrevious && (
        <button className={styles.button} onClick={onPrevious} disabled={!hasPrevious}>
          {t('pagination.previous')}
        </button>
      )}
      <button
        className={styles.button}
        onClick={() => cursor && onNext(cursor)}
        disabled={!hasMore || !cursor}
      >
        {t('pagination.next')}
      </button>
    </div>
  );
}
