'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import { formatRelativeTime } from '@/lib/format';
import styles from './agents.module.css';

interface AgentItem {
  id: string;
  name: string;
  prefix: string;
  trustLevel: string;
  isActive: boolean;
  lastUsedAt: string | null;
  totalCalls: number;
  candidateCount: number;
  createdAt: string;
}

interface AgentSummary {
  totalCalls: number;
  errorCount: number;
  errorRate: number;
  activeAgents: number;
  pendingCandidates: number;
}

const PERIODS = [
  { days: 7, labelKey: 'billing.usage.last_7_days' },
  { days: 30, labelKey: 'billing.usage.last_30_days' },
  { days: 90, labelKey: 'billing.usage.last_90_days' },
];

export default function AgentsPage() {
  const { t, locale } = useAuth();
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [days, setDays] = useState(30);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async (period: number) => {
    setIsLoading(true);
    try {
      const [agentsRes, summaryRes] = await Promise.all([
        apiClient.get<AgentItem[]>('/v1/agents'),
        apiClient.get<AgentSummary>('/v1/agents/summary', { days: String(period) }),
      ]);
      if (agentsRes.data) setAgents(agentsRes.data);
      if (summaryRes.data) setSummary(summaryRes.data);
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  if (isLoading && !summary) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('agents.title')}
        <InfoTooltip text={t('help.agents_title')} />
      </h1>

      <div className={styles.controls}>
        {PERIODS.map((period) => (
          <button
            key={period.days}
            className={`${styles.periodBtn} ${days === period.days ? styles.periodBtnActive : ''}`}
            onClick={() => setDays(period.days)}
          >
            {t(period.labelKey)}
          </button>
        ))}
      </div>

      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.totalCalls ?? 0}</span>
          <span className={styles.summaryLabel}>{t('agents.total_calls')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.activeAgents ?? 0}</span>
          <span className={styles.summaryLabel}>{t('agents.active_agents')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.errorRate ?? 0}%</span>
          <span className={styles.summaryLabel}>{t('agents.error_rate')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.pendingCandidates ?? 0}</span>
          <span className={styles.summaryLabel}>{t('agents.candidates')}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('agents.by_agent')}
          <InfoTooltip text={t('help.agents_detail')} />
        </h2>

        {agents.length === 0 ? (
          <p className={styles.empty}>{t('agents.empty')}</p>
        ) : (
          <table className={styles.agentTable}>
            <thead>
              <tr>
                <th>{t('agents.name')}</th>
                <th>{t('agents.trust_level')}</th>
                <th>{t('agents.status')}</th>
                <th>{t('agents.calls')}</th>
                <th>{t('agents.candidates')}</th>
                <th>{t('agents.last_active')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>
                    <Link href={`/dashboard/agents/${agent.id}`} className={styles.agentLink}>
                      {agent.name}
                    </Link>
                    <br />
                    <span className={styles.prefix}>{agent.prefix}...</span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        agent.trustLevel === 'trusted' ? styles.badgeTrusted : styles.badgeReview
                      }`}
                    >
                      {agent.trustLevel}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        agent.isActive ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {agent.isActive ? t('agents.active') : t('agents.inactive')}
                    </span>
                  </td>
                  <td>{agent.totalCalls}</td>
                  <td>
                    {agent.candidateCount > 0 ? (
                      <span className={styles.candidateBadge}>{agent.candidateCount}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td>
                    {agent.lastUsedAt
                      ? formatRelativeTime(new Date(agent.lastUsedAt), locale)
                      : '—'}
                  </td>
                  <td>
                    <Link href={`/dashboard/agents/${agent.id}`} className={styles.agentLink}>
                      {t('agents.view_details')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
