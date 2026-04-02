'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './region.module.css';

type Region = 'EU' | 'GLOBAL';

export default function RegionPage() {
  const { t, setUser, user, token, isLoading } = useAuth();
  const router = useRouter();
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace('/login');
    } else if (!isLoading && user?.region) {
      router.replace('/dashboard');
    }
  }, [isLoading, token, user, router]);

  async function handleConfirm() {
    if (!selectedRegion) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const response = await apiClient.post<{ region: string }>('/v1/auth/region', {
        region: selectedRegion,
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      if (user) {
        setUser({ ...user, region: selectedRegion });
      }

      router.push('/dashboard');
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('onboarding.region.select')}</h1>

        <div className={styles.options}>
          <button
            className={`${styles.option} ${selectedRegion === 'EU' ? styles.optionSelected : ''}`}
            onClick={() => setSelectedRegion('EU')}
          >
            <span className={styles.optionTitle}>{t('onboarding.region.eu')}</span>
            <span className={styles.optionDescription}>
              {t('onboarding.region.eu_description')}
            </span>
          </button>

          <button
            className={`${styles.option} ${selectedRegion === 'GLOBAL' ? styles.optionSelected : ''}`}
            onClick={() => setSelectedRegion('GLOBAL')}
          >
            <span className={styles.optionTitle}>{t('onboarding.region.global')}</span>
            <span className={styles.optionDescription}>
              {t('onboarding.region.global_description')}
            </span>
          </button>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.confirmButton}
          onClick={handleConfirm}
          disabled={!selectedRegion || isSubmitting}
        >
          {isSubmitting ? t('common.loading') : t('onboarding.region.confirm')}
        </button>
      </div>
    </div>
  );
}
