'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { SocialShare } from '@/components/SocialShare';
import { formatDate } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './shares.module.css';

interface Share {
  id: string;
  shareToken: string;
  scope: string;
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export default function SharesPage() {
  const { t, locale } = useAuth();
  const [shares, setShares] = useState<Share[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [scope, setScope] = useState('brief');
  const [expiresInHours, setExpiresInHours] = useState('24');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchShares = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        items: Share[];
      }>('/v1/shares');
      if (res.data?.items) {
        setShares(res.data.items);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const hours = parseInt(expiresInHours, 10);
      await apiClient.post('/v1/shares', {
        scope,
        expiresInHours: isNaN(hours) ? undefined : hours,
      });
      setShowForm(false);
      await fetchShares();
    } catch {
      // Error handling via toast
    } finally {
      setIsCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm(t('shares.confirm_revoke'))) return;
    await apiClient.delete(`/v1/shares/${id}`);
    setShares((prev) => prev.filter((s) => s.id !== id));
  };

  const handleCopy = (token: string, id: string) => {
    const url = `${apiUrl}/v1/shares/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return <p>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t('shares.title')}
          <InfoTooltip text={t('help.shares_title')} />
        </h1>
        <button className={styles.createBtn} onClick={() => setShowForm(!showForm)}>
          {t('shares.create')}
        </button>
      </div>

      {showForm && (
        <div className={styles.form}>
          <div className={styles.formRow}>
            <input
              className={styles.input}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder={t('shares.scope_placeholder')}
            />
            <input
              className={styles.input}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(e.target.value)}
              placeholder={t('shares.expires_placeholder')}
              type="number"
            />
          </div>
          <button className={styles.submitBtn} onClick={handleCreate} disabled={isCreating}>
            {isCreating ? t('common.loading') : t('shares.create')}
          </button>
        </div>
      )}

      <SocialShare />

      {shares.length === 0 ? (
        <p className={styles.empty}>{t('shares.empty')}</p>
      ) : (
        <ul className={styles.shareList}>
          {shares.map((share) => (
            <li key={share.id} className={styles.shareItem}>
              <div className={styles.shareHeader}>
                <span className={styles.scope}>{share.scope}</span>
                <button className={styles.revokeBtn} onClick={() => handleRevoke(share.id)}>
                  {t('shares.revoke')}
                </button>
              </div>
              <div className={styles.meta}>
                <span>
                  {t('shares.views')}: {share.viewCount}
                </span>
                <span>
                  {t('shares.expires')}:{' '}
                  {share.expiresAt ? formatDate(share.expiresAt, locale) : t('shares.never')}
                </span>
              </div>
              <div className={styles.urlRow}>
                <input
                  className={styles.urlInput}
                  readOnly
                  value={`${apiUrl}/v1/shares/${share.shareToken}`}
                />
                <button
                  className={styles.copyBtn}
                  onClick={() => handleCopy(share.shareToken, share.id)}
                >
                  {copiedId === share.id ? t('shares.copied') : t('shares.copy_url')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
