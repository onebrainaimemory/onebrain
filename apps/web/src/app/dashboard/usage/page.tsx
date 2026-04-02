'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatNumber } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './usage.module.css';

interface UsageByType {
  type: string;
  count: number;
  tokens: number;
}

interface UsageByDay {
  date: string;
  count: number;
  tokens: number;
}

interface UsageAnalytics {
  byType: UsageByType[];
  byDay: UsageByDay[];
  totals: { count: number; tokens: number };
}

const PERIODS = [
  { days: 7, labelKey: 'billing.usage.last_7_days' },
  { days: 30, labelKey: 'billing.usage.last_30_days' },
  { days: 90, labelKey: 'billing.usage.last_90_days' },
];

export default function UsagePage() {
  const { t, locale } = useAuth();
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (period: number) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<UsageAnalytics>('/v1/user/usage-analytics', {
        days: String(period),
      });
      if (res.data) setData(res.data);
    } catch {
      // Silently handle
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  const handlePeriodChange = (newDays: number) => {
    setDays(newDays);
  };

  if (isLoading && !data) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('billing.usage.title')}
        <InfoTooltip text={t('help.usage_title')} />
      </h1>

      <div className={styles.controls}>
        {PERIODS.map((period) => (
          <button
            key={period.days}
            className={`${styles.periodBtn} ${days === period.days ? styles.periodBtnActive : ''}`}
            onClick={() => handlePeriodChange(period.days)}
          >
            {t(period.labelKey)}
          </button>
        ))}
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{data?.totals.count ?? 0}</span>
          <span className={styles.summaryLabel}>{t('billing.usage.total_requests')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>
            {formatNumber(data?.totals.tokens ?? 0, locale)}
          </span>
          <span className={styles.summaryLabel}>{t('billing.usage.total_tokens')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{data?.byType.length ?? 0}</span>
          <span className={styles.summaryLabel}>{t('billing.usage.event_types')}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('billing.usage.daily_activity')}
          <InfoTooltip text={t('help.usage_daily_activity')} />
        </h2>
        <div className={styles.chartContainer}>
          <BarChart data={data?.byDay ?? []} emptyLabel={t('billing.usage.no_data')} />
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('billing.usage.by_type')}
          <InfoTooltip text={t('help.usage_by_type')} />
        </h2>

        {!data?.byType || data.byType.length === 0 ? (
          <p className={styles.empty}>{t('billing.usage.no_data')}</p>
        ) : (
          <table className={styles.typeTable}>
            <thead>
              <tr>
                <th>{t('billing.usage.type')}</th>
                <th>{t('billing.usage.requests')}</th>
                <th>{t('billing.usage.tokens')}</th>
              </tr>
            </thead>
            <tbody>
              {data.byType.map((row) => (
                <tr key={row.type}>
                  <td>
                    <span className={styles.typeBadge}>{row.type.replace(/_/g, ' ')}</span>
                  </td>
                  <td>{row.count}</td>
                  <td>{formatNumber(row.tokens, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function BarChart({ data, emptyLabel }: { data: UsageByDay[]; emptyLabel: string }) {
  if (data.length === 0) {
    return <p style={{ fontSize: '14px', color: '#888', margin: 0 }}>{emptyLabel}</p>;
  }

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const chartWidth = Math.max(data.length * 28, 300);
  const chartHeight = 180;
  const barWidth = 18;
  const gap = 10;
  const padding = { top: 10, bottom: 30, left: 10, right: 10 };
  const drawHeight = chartHeight - padding.top - padding.bottom;

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      style={{ display: 'block' }}
    >
      {data.map((day, idx) => {
        const barHeight = Math.max((day.count / maxCount) * drawHeight, 2);
        const x = padding.left + idx * (barWidth + gap);
        const y = padding.top + drawHeight - barHeight;

        const dateLabel = day.date.slice(5);

        return (
          <g key={day.date}>
            <rect x={x} y={y} width={barWidth} height={barHeight} rx={3} fill="#111" opacity={0.8}>
              <title>
                {day.date}: {day.count} requests, {day.tokens} tokens
              </title>
            </rect>
            {data.length <= 31 && (
              <text
                x={x + barWidth / 2}
                y={chartHeight - 6}
                textAnchor="middle"
                fontSize="9"
                fill="#888"
              >
                {dateLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
