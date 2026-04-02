'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './briefings.module.css';

interface BriefingConfig {
  enabled: boolean;
  timezone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
}

interface BriefingAnalytics {
  engagementRate: number;
  totalBriefings: number;
  deliveredCount: number;
}

interface BriefingItem {
  id: string;
  type: string;
  status: string;
  title: string;
  date: string;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  morning: '#2563eb',
  evening: '#7c3aed',
  weekly: '#059669',
};

const STATUS_COLORS: Record<string, string> = {
  delivered: '#059669',
  pending: '#d97706',
  failed: '#dc2626',
  skipped: '#888',
};

function formatDate(isoString: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString();
  }
}

export default function BriefingsPage() {
  const { t, locale } = useAuth();

  const [config, setConfig] = useState<BriefingConfig | null>(null);
  const [analytics, setAnalytics] = useState<BriefingAnalytics | null>(null);
  const [briefings, setBriefings] = useState<BriefingItem[]>([]);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isLoadingBriefings, setIsLoadingBriefings] = useState(true);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(true);
  const [error, setError] = useState('');

  const fetchConfig = useCallback(async () => {
    setIsLoadingConfig(true);
    try {
      const response = await apiClient.get<BriefingConfig>('/v1/briefings/config');
      if (response.data) {
        setConfig(response.data);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoadingConfig(false);
    }
  }, [t]);

  const fetchAnalytics = useCallback(async () => {
    setIsLoadingAnalytics(true);
    try {
      const response = await apiClient.get<BriefingAnalytics>('/v1/briefings/analytics', {
        days: '30',
      });
      if (response.data) {
        setAnalytics(response.data);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoadingAnalytics(false);
    }
  }, [t]);

  const fetchBriefings = useCallback(async () => {
    setIsLoadingBriefings(true);
    try {
      const response = await apiClient.get<BriefingItem[]>('/v1/briefings', { limit: '20' });
      if (response.data) {
        setBriefings(response.data);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoadingBriefings(false);
    }
  }, [t]);

  useEffect(() => {
    fetchConfig();
    fetchAnalytics();
    fetchBriefings();
  }, [fetchConfig, fetchAnalytics, fetchBriefings]);

  const isLoading = isLoadingConfig || isLoadingBriefings || isLoadingAnalytics;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t('briefings.title')}
            <InfoTooltip text={t('help.briefings_title')} />
          </h1>
          <span className={styles.subtitle}>{t('briefings.subtitle')}</span>
        </div>
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Config Panel */}
      {!isLoadingConfig && config && (
        <div className={styles.configPanel}>
          <div className={styles.configRow}>
            <span className={styles.configLabel}>{t('briefings.config.status')}</span>
            <span
              className={config.enabled ? styles.configValueEnabled : styles.configValueDisabled}
            >
              {config.enabled ? t('briefings.config.enabled') : t('briefings.config.disabled')}
            </span>
          </div>
          <div className={styles.configRow}>
            <span className={styles.configLabel}>{t('briefings.config.timezone')}</span>
            <span className={styles.configValue}>{config.timezone}</span>
          </div>
          <div className={styles.configRow}>
            <span className={styles.configLabel}>{t('briefings.config.quietHours')}</span>
            <span className={styles.configValue}>
              {config.quietHoursStart} - {config.quietHoursEnd}
            </span>
          </div>
        </div>
      )}

      {isLoadingConfig && <div className={styles.loading}>{t('common.loading')}</div>}

      {/* Analytics Row */}
      {!isLoadingAnalytics && analytics && (
        <div className={styles.analyticsRow}>
          <div className={styles.analyticsItem}>
            <span className={styles.analyticsValue}>{analytics.engagementRate.toFixed(1)}%</span>
            <span className={styles.analyticsLabel}>{t('briefings.analytics.engagement')}</span>
          </div>
          <div className={styles.analyticsItem}>
            <span className={styles.analyticsValue}>{analytics.totalBriefings}</span>
            <span className={styles.analyticsLabel}>{t('briefings.analytics.total')}</span>
          </div>
          <div className={styles.analyticsItem}>
            <span className={styles.analyticsValue}>{analytics.deliveredCount}</span>
            <span className={styles.analyticsLabel}>{t('briefings.analytics.delivered')}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && !isLoadingConfig && <div className={styles.loading}>{t('common.loading')}</div>}

      {/* Empty state */}
      {!isLoadingBriefings && !error && briefings.length === 0 && (
        <div className={styles.empty}>{t('briefings.empty')}</div>
      )}

      {/* Briefing list */}
      {!isLoadingBriefings && briefings.length > 0 && (
        <ul className={styles.list}>
          {briefings.map((briefing) => (
            <li key={briefing.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardBadges}>
                  <span
                    className={styles.typeBadge}
                    style={{
                      background: TYPE_COLORS[briefing.type] || '#888',
                    }}
                  >
                    {briefing.type}
                  </span>
                  <span
                    className={styles.statusBadge}
                    style={{
                      color: STATUS_COLORS[briefing.status] || '#888',
                      background:
                        briefing.status === 'delivered'
                          ? '#ecfdf5'
                          : briefing.status === 'pending'
                            ? '#fffbeb'
                            : briefing.status === 'failed'
                              ? '#fef2f2'
                              : '#f5f5f5',
                    }}
                  >
                    {briefing.status}
                  </span>
                </div>
                <span className={styles.cardDate}>
                  {formatDate(briefing.date || briefing.createdAt, locale)}
                </span>
              </div>
              <h3 className={styles.cardTitle}>{briefing.title}</h3>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
