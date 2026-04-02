'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { CreateKeyForm } from './CreateKeyForm';
import { KeyList } from './KeyList';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './apiKeys.module.css';

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { t } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await apiClient.get<{ items: ApiKey[] }>('/v1/api-keys');
      if (response.data) {
        setKeys(response.data.items ?? []);
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
    fetchKeys();
  }, [fetchKeys]);

  function handleKeyCreated(key: string) {
    setCreatedKey(key);
    fetchKeys();
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('api_keys.title')}
        <InfoTooltip text={t('help.api_keys_title')} />
      </h1>

      <CreateKeyForm onKeyCreated={handleKeyCreated} />

      {createdKey && (
        <div className={styles.createdKeyBanner}>
          <p className={styles.copyWarning}>{t('api_keys.copy_warning')}</p>
          <code className={styles.keyValue}>{createdKey}</code>
          <button className={styles.dismissButton} onClick={() => setCreatedKey(null)}>
            {t('common.close')}
          </button>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {isLoading ? (
        <p className={styles.loading}>{t('common.loading')}</p>
      ) : (
        <KeyList keys={keys} onRevoked={fetchKeys} />
      )}
    </div>
  );
}
