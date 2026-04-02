'use client';

import { useAuth } from '@/components/AuthContext';
import styles from './memory.module.css';

const MEMORY_TYPES = ['fact', 'preference', 'decision', 'goal', 'experience', 'skill'];
const MEMORY_STATUSES = ['active', 'archived'];

interface MemoryFiltersProps {
  typeFilter: string;
  statusFilter: string;
  onTypeChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function MemoryFilters({
  typeFilter,
  statusFilter,
  onTypeChange,
  onStatusChange,
}: MemoryFiltersProps) {
  const { t } = useAuth();

  return (
    <div className={styles.filters}>
      <select
        className={styles.select}
        value={typeFilter}
        onChange={(event) => onTypeChange(event.target.value)}
        aria-label={t('memory.filter_type')}
      >
        <option value="">{t('memory.all_types')}</option>
        {MEMORY_TYPES.map((memType) => (
          <option key={memType} value={memType}>
            {t(`memory.types.${memType}`)}
          </option>
        ))}
      </select>

      <select
        className={styles.select}
        value={statusFilter}
        onChange={(event) => onStatusChange(event.target.value)}
        aria-label={t('memory.filter_status')}
      >
        <option value="">{t('memory.all_statuses')}</option>
        {MEMORY_STATUSES.map((status) => (
          <option key={status} value={status}>
            {t(`memory.status.${status}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
