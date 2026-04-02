'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './apiKeys.module.css';

interface CreateKeyFormProps {
  onKeyCreated: (key: string) => void;
}

interface CreateKeyResponse {
  id: string;
  name: string;
  fullKey: string;
}

const SCOPE_OPTIONS = [
  { value: 'connect.read', labelKey: 'api_keys.scope_connect_read' },
  { value: 'connect.write', labelKey: 'api_keys.scope_connect_write' },
  { value: 'brain.read', labelKey: 'api_keys.scope_brain_read' },
  { value: 'brain.write', labelKey: 'api_keys.scope_brain_write' },
  { value: 'memory.extract.write', labelKey: 'api_keys.scope_memory_write' },
  { value: 'entity.read', labelKey: 'api_keys.scope_entity_read' },
  { value: 'entity.write', labelKey: 'api_keys.scope_entity_write' },
] as const;

export function CreateKeyForm({ onKeyCreated }: CreateKeyFormProps) {
  const { t } = useAuth();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>(['connect.read']);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || scopes.length === 0) return;

    setIsCreating(true);
    setError('');

    try {
      const response = await apiClient.post<CreateKeyResponse>('/v1/api-keys', {
        name: name.trim(),
        scopes,
      });

      if (response.data) {
        onKeyCreated(response.data.fullKey);
        setName('');
        setScopes(['connect.read']);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit} className={styles.createFormExpanded}>
        <div className={styles.formRow}>
          <input
            type="text"
            className={styles.input}
            placeholder={t('api_keys.name_placeholder')}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className={styles.scopeSection}>
          <label className={styles.scopeLabel}>{t('api_keys.scopes')}</label>
          <div className={styles.scopeGrid}>
            {SCOPE_OPTIONS.map((opt) => (
              <label key={opt.value} className={styles.scopeCheckbox}>
                <input
                  type="checkbox"
                  checked={scopes.includes(opt.value)}
                  onChange={() => toggleScope(opt.value)}
                />
                <span className={styles.scopeText}>{t(opt.labelKey)}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className={styles.createButton}
          disabled={isCreating || !name.trim() || scopes.length === 0}
        >
          {isCreating ? t('common.loading') : t('api_keys.create')}
        </button>
      </form>
      {error && <p className={styles.error}>{error}</p>}
    </>
  );
}
