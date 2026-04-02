'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from './AuthContext';
import { apiClient } from './ApiClient';

interface UsageSummary {
  plan: { name: string; displayName: string };
  limits: Array<{
    key: string;
    limit: number;
    period: string;
    current: number;
    percentage: number;
  }>;
  totalTokensUsed: number;
}

export function UsageMeter() {
  const { t } = useAuth();
  const [data, setData] = useState<UsageSummary | null>(null);

  useEffect(() => {
    apiClient
      .get<UsageSummary>('/v1/user/usage-summary')
      .then((res) => {
        if (res.data) setData(res.data);
      })
      .catch(() => {});
  }, []);

  if (!data || data.limits.length === 0) return null;

  const isFree = data.plan.name === 'free';

  return (
    <div
      style={{
        background: '#12122a',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #1a1a2e',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{t('billing.usage')}</h3>
        {isFree && (
          <Link
            href="/pricing"
            style={{
              fontSize: '0.8rem',
              color: '#6c5ce7',
              textDecoration: 'none',
            }}
          >
            {t('billing.upgrade')}
          </Link>
        )}
      </div>

      {data.limits.map((limit) => {
        const pct = limit.limit === -1 ? 0 : limit.percentage;
        const barColor = pct > 80 ? '#e74c3c' : pct > 50 ? '#f39c12' : '#2ecc71';
        const label = limit.key.replace(/_/g, ' ');

        return (
          <div key={limit.key} style={{ marginBottom: '0.75rem' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                color: '#888',
                marginBottom: '0.25rem',
              }}
            >
              <span>{label}</span>
              <span>
                {limit.current}{' '}
                {limit.limit === -1 ? '' : `${t('billing.usage_of')} ${limit.limit}`}
              </span>
            </div>
            {limit.limit !== -1 && (
              <div
                style={{
                  height: '6px',
                  background: '#1a1a2e',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(pct, 100)}%`,
                    background: barColor,
                    borderRadius: '3px',
                    transition: 'width 0.3s',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
