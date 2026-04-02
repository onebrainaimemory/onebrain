'use client';

import { useEffect, useState } from 'react';
import { apiClient } from './ApiClient';

interface SubscriptionData {
  plan: { name: string; displayName: string };
  subscription: {
    status: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

export function PlanBadge() {
  const [data, setData] = useState<SubscriptionData | null>(null);

  useEffect(() => {
    apiClient
      .get<SubscriptionData>('/v1/billing/subscription')
      .then((res) => {
        if (res.data) setData(res.data);
      })
      .catch(() => {
        // Billing not available (self-hosted) — show nothing
      });
  }, []);

  if (!data) return null;

  const isFree = data.plan.name === 'free';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.2rem 0.6rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: isFree ? '#1a1a2e' : '#6c5ce720',
        color: isFree ? '#888' : '#6c5ce7',
        border: `1px solid ${isFree ? '#333' : '#6c5ce740'}`,
      }}
    >
      {data.plan.displayName}
    </span>
  );
}
