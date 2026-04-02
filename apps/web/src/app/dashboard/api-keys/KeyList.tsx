'use client';

import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate } from '@/lib/format';
import styles from './apiKeys.module.css';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

interface KeyListProps {
  keys: ApiKey[];
  onRevoked: () => void;
}

export function KeyList({ keys, onRevoked }: KeyListProps) {
  const { t, locale } = useAuth();

  async function handleRevoke(keyId: string) {
    const isConfirmed = globalThis.confirm(t('api_keys.confirm_revoke'));
    if (!isConfirmed) {
      return;
    }

    try {
      await apiClient.delete(`/v1/api-keys/${keyId}`);
      onRevoked();
    } catch {
      /* error handled by parent reload */
    }
  }

  if (keys.length === 0) {
    return <p className={styles.empty}>{t('api_keys.empty')}</p>;
  }

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th className={styles.th}>{t('api_keys.name')}</th>
          <th className={styles.th}>{t('api_keys.key_value')}</th>
          <th className={styles.th}>{t('api_keys.created')}</th>
          <th className={styles.th} />
        </tr>
      </thead>
      <tbody>
        {keys.map((apiKey) => (
          <tr key={apiKey.id} className={styles.row}>
            <td className={styles.td}>{apiKey.name}</td>
            <td className={styles.td}>
              <code className={styles.prefix}>{apiKey.prefix}...</code>
            </td>
            <td className={styles.td}>{formatDate(apiKey.createdAt, locale)}</td>
            <td className={styles.td}>
              <button className={styles.revokeButton} onClick={() => handleRevoke(apiKey.id)}>
                {t('api_keys.revoke')}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
