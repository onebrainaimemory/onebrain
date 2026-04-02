'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { SocialShare } from '@/components/SocialShare';
import { formatDate } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './referrals.module.css';

interface Referral {
  id: string;
  code: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

export default function ReferralsPage() {
  const { t, locale } = useAuth();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const fetchReferrals = useCallback(async () => {
    try {
      const res = await apiClient.get<{
        items: Referral[];
      }>('/v1/referrals');
      if (res.data?.items) {
        setReferrals(res.data.items);
      }
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleCreate = async () => {
    try {
      await apiClient.post('/v1/referrals');
      await fetchReferrals();
    } catch {
      // Error handling
    }
  };

  const handleCopyLink = (code: string) => {
    const url = `${appUrl}/register?ref=${code}`;
    navigator.clipboard.writeText(url);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const activeCode = referrals.find((r) => r.status === 'pending')?.code;
  const completedCount = referrals.filter((r) => r.status === 'completed').length;

  if (isLoading) {
    return <p>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t('referrals.title')}
          <InfoTooltip text={t('help.referrals_title')} />
        </h1>
        {!activeCode && (
          <button className={styles.createBtn} onClick={handleCreate}>
            {t('referrals.create_code')}
          </button>
        )}
      </div>

      {activeCode && (
        <div className={styles.codeCard}>
          <span className={styles.codeLabel}>{t('referrals.your_code')}</span>
          <div className={styles.codeRow}>
            <input
              className={styles.codeInput}
              readOnly
              value={`${appUrl}/register?ref=${activeCode}`}
            />
            <button className={styles.copyBtn} onClick={() => handleCopyLink(activeCode)}>
              {isCopied ? t('referrals.copied') : t('referrals.copy_link')}
            </button>
          </div>
        </div>
      )}

      <SocialShare />

      {completedCount > 0 && (
        <div className={styles.rewardInfo}>
          {t('referrals.reward')}: {completedCount} x {t('referrals.reward_granted')}
        </div>
      )}

      <h2 className={styles.sectionTitle}>
        {t('referrals.referred_users')}
        <InfoTooltip text={t('help.referrals_referred_users')} />
      </h2>

      {referrals.length === 0 ? (
        <p className={styles.empty}>{t('referrals.empty')}</p>
      ) : (
        <ul className={styles.referralList}>
          {referrals.map((referral) => (
            <li key={referral.id} className={styles.referralItem}>
              <span className={styles.code}>{referral.code}</span>
              <span
                className={`${styles.status} ${
                  referral.status === 'completed' ? styles.statusCompleted : styles.statusPending
                }`}
              >
                {referral.status === 'completed'
                  ? t('referrals.completed')
                  : t('referrals.pending')}
              </span>
              <span className={styles.date}>{formatDate(referral.createdAt, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
