'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from '../admin.module.css';

interface UserSummary {
  id: string;
  email: string;
  memories: number;
  isActive: boolean;
  plan: string;
  createdAt: string;
}

interface PlanSummary {
  id: string;
  name: string;
  displayName: string;
  isActive: boolean;
  userCount: number;
}

interface MetricsData {
  totalUsers: number;
  activeUsers: number;
  totalMemories: number;
  avgMemoriesPerUser: number;
  maxMemoriesPerUser: number;
  planDistribution: Array<{ name: string; count: number }>;
  recentSignups: number;
}

function computeMetrics(users: UserSummary[], plans: PlanSummary[]): MetricsData {
  const memories = users.map((u) => u.memories);
  const totalMemories = memories.reduce((sum, m) => sum + m, 0);
  const avgMemories = users.length > 0 ? Math.round(totalMemories / users.length) : 0;
  const maxMemories = memories.length > 0 ? Math.max(...memories) : 0;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentSignups = users.filter((u) => new Date(u.createdAt) > sevenDaysAgo).length;

  const planDistribution = plans.map((p) => ({
    name: p.displayName,
    count: p.userCount,
  }));

  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    totalMemories,
    avgMemoriesPerUser: avgMemories,
    maxMemoriesPerUser: maxMemories,
    planDistribution,
    recentSignups,
  };
}

export default function MetricsPage() {
  const { t } = useAuth();
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const [usersRes, plansRes] = await Promise.all([
          apiClient.get<UserSummary[]>('/v1/admin/users'),
          apiClient.get<PlanSummary[]>('/v1/admin/plans'),
        ]);

        const users = usersRes.data ?? [];
        const plans = plansRes.data ?? [];
        setMetrics(computeMetrics(users, plans));
      } catch {
        setError(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchMetrics();
  }, []);

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!metrics) return null;

  const maxPlanCount = Math.max(...metrics.planDistribution.map((p) => p.count), 1);

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('admin.nav_metrics')}</h1>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.totalUsers}</span>
          <span className={styles.statLabel}>{t('admin.total_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.activeUsers}</span>
          <span className={styles.statLabel}>{t('admin.active_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.recentSignups}</span>
          <span className={styles.statLabel}>{t('admin.metrics_recent_signups')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.totalMemories}</span>
          <span className={styles.statLabel}>{t('admin.total_memories')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.avgMemoriesPerUser}</span>
          <span className={styles.statLabel}>{t('admin.metrics_avg_memories')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{metrics.maxMemoriesPerUser}</span>
          <span className={styles.statLabel}>{t('admin.metrics_max_memories')}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.subtitle}>{t('admin.metrics_plan_distribution')}</h2>
        {metrics.planDistribution.length === 0 ? (
          <p className={styles.empty}>{t('admin.no_plans')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {metrics.planDistribution.map((plan) => (
              <div key={plan.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ width: '120px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {plan.name}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: '24px',
                    background: 'var(--bg-hover, #f0f0f0)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(plan.count / maxPlanCount) * 100}%`,
                      height: '100%',
                      background: 'var(--accent, #111)',
                      borderRadius: '4px',
                      minWidth: plan.count > 0 ? '2px' : '0',
                    }}
                  />
                </div>
                <span
                  style={{ width: '40px', fontSize: '14px', fontWeight: 600, textAlign: 'right' }}
                >
                  {plan.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
