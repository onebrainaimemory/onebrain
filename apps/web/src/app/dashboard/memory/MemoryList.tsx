'use client';

import { useAuth } from '@/components/AuthContext';
import { formatDate } from '@/lib/format';
import styles from './memory.module.css';

interface MemoryItem {
  id: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
}

interface MemoryListProps {
  memories: MemoryItem[];
}

export function MemoryList({ memories }: MemoryListProps) {
  const { t, locale } = useAuth();

  if (memories.length === 0) {
    return <p className={styles.empty}>{t('memory.empty')}</p>;
  }

  return (
    <ul className={styles.list}>
      {memories.map((memory) => (
        <li key={memory.id} className={styles.item}>
          <div className={styles.itemHeader}>
            <span className={styles.itemType}>
              {t(`memory.types.${memory.type}`) || memory.type}
            </span>
            <span className={styles.itemStatus}>
              {t(`memory.status.${memory.status}`) || memory.status}
            </span>
          </div>
          <p className={styles.itemContent}>{memory.content}</p>
          <span className={styles.itemDate}>{formatDate(memory.createdAt, locale)}</span>
        </li>
      ))}
    </ul>
  );
}
