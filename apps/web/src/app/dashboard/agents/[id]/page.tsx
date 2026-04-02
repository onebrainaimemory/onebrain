'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import { formatRelativeTime } from '@/lib/format';
import styles from '../agents.module.css';

interface AgentDetail {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  trustLevel: string;
  description: string | null;
  rateLimitPerMin: number | null;
  isActive: boolean;
  lastUsedAt: string | null;
  lastSyncedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface AgentSummary {
  totalCalls: number;
  errorCount: number;
  errorRate: number;
  activeAgents: number;
  pendingCandidates: number;
  byAction?: Record<string, number>;
  byStatus?: Record<string, number>;
}

interface ActivityItem {
  id: string;
  action: string;
  status: string;
  memoryCount: number;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

const SCOPES = [
  'read:context',
  'read:memories',
  'write:memories',
  'read:entities',
  'read:projects',
];

const TRUST_LEVELS = ['review', 'trusted'];

export default function AgentDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { t, locale } = useAuth();

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [summary, setSummary] = useState<AgentSummary | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trustLevel, setTrustLevel] = useState('review');
  const [rateLimitPerMin, setRateLimitPerMin] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [summaryRes, activityRes] = await Promise.all([
        apiClient.get<AgentSummary>(`/v1/agents/${id}/summary`, { days: '30' }),
        apiClient.get<{ data: ActivityItem[]; meta: { cursor: string | null; hasMore: boolean } }>(
          `/v1/agents/${id}/activity`,
          { limit: '20' },
        ),
      ]);

      if (summaryRes.data) setSummary(summaryRes.data);
      if (activityRes.data) {
        const nested = activityRes.data as unknown as {
          data: ActivityItem[];
        };
        setActivities(nested.data ?? []);
      }
    } catch {
      // handled
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  // Fetch agent config separately (uses different endpoint)
  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await apiClient.get<AgentDetail[]>('/v1/agents');
        if (res.data) {
          const found = res.data.find((a) => a.id === id);
          if (found) {
            setAgent(found);
            setName(found.name);
            setDescription(found.description ?? '');
            setTrustLevel(found.trustLevel);
            setRateLimitPerMin(found.rateLimitPerMin ? String(found.rateLimitPerMin) : '');
            setScopes(found.scopes ?? []);
            setIsActive(found.isActive);
          }
        }
      } catch {
        // handled
      }
    }
    fetchAgent();
    fetchData();
  }, [id, fetchData]);

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiClient.patch<AgentDetail>(`/v1/api-keys/${id}`, {
        name,
        description: description || undefined,
        trustLevel,
        rateLimitPerMin: rateLimitPerMin ? parseInt(rateLimitPerMin, 10) : undefined,
        scopes,
        isActive,
      });
      if (res.data) {
        setAgent(res.data);
        setSuccessMsg(t('agents.config_saved'));
      } else if (res.error) {
        setErrorMsg(res.error.message);
      }
    } catch {
      setErrorMsg(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'dismiss') => {
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const res = await apiClient.post<{ action: string; updated: number }>(
        `/v1/agents/${id}/candidates`,
        { action },
      );
      if (res.data) {
        setSuccessMsg(`${res.data.updated} ${t('agents.candidates_updated')}`);
        fetchData();
      } else if (res.error) {
        setErrorMsg(res.error.message);
      }
    } catch {
      setErrorMsg(t('common.error'));
    }
  };

  const toggleScope = (scope: string) => {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  if (isLoading && !agent) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (!agent) {
    return (
      <div className={styles.container}>
        <Link href="/dashboard/agents" className={styles.backLink}>
          {t('agents.back')}
        </Link>
        <p className={styles.empty}>{t('agents.not_found')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Link href="/dashboard/agents" className={styles.backLink}>
        {t('agents.back')}
      </Link>

      <div className={styles.detailHeader}>
        <h1 className={styles.title}>{agent.name}</h1>
        <span
          className={`${styles.badge} ${
            agent.isActive ? styles.badgeActive : styles.badgeInactive
          }`}
        >
          {agent.isActive ? t('agents.active') : t('agents.inactive')}
        </span>
        <span
          className={`${styles.badge} ${
            agent.trustLevel === 'trusted' ? styles.badgeTrusted : styles.badgeReview
          }`}
        >
          {agent.trustLevel}
        </span>
      </div>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.totalCalls ?? 0}</span>
          <span className={styles.summaryLabel}>{t('agents.total_calls')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.errorRate ?? 0}%</span>
          <span className={styles.summaryLabel}>{t('agents.error_rate')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>{summary?.pendingCandidates ?? 0}</span>
          <span className={styles.summaryLabel}>{t('agents.candidates')}</span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryValue}>
            {agent.lastUsedAt ? formatRelativeTime(new Date(agent.lastUsedAt), locale) : '—'}
          </span>
          <span className={styles.summaryLabel}>{t('agents.last_active')}</span>
        </div>
      </div>

      {/* Candidate actions */}
      {(summary?.pendingCandidates ?? 0) > 0 && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('agents.pending_candidates')}</h2>
          <div className={styles.bulkActions}>
            <button className={styles.approveBtn} onClick={() => handleBulkAction('approve')}>
              {t('agents.approve_all')}
            </button>
            <button className={styles.dismissBtn} onClick={() => handleBulkAction('dismiss')}>
              {t('agents.dismiss_all')}
            </button>
          </div>
        </div>
      )}

      {successMsg && <p className={styles.success}>{successMsg}</p>}
      {errorMsg && <p className={styles.error}>{errorMsg}</p>}

      {/* Configuration */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('agents.config')}
          <InfoTooltip text={t('help.agents_config')} />
        </h2>
        <div className={styles.configCard}>
          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.name')}</label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.description')}</label>
            <input
              type="text"
              className={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('agents.description_placeholder')}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.trust_level')}</label>
            <div className={styles.radioGroup}>
              {TRUST_LEVELS.map((level) => (
                <label key={level} className={styles.radioLabel}>
                  <input
                    type="radio"
                    name="trustLevel"
                    value={level}
                    checked={trustLevel === level}
                    onChange={() => setTrustLevel(level)}
                  />
                  {t(`agents.trust_${level}`)}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.rate_limit')}</label>
            <input
              type="number"
              className={styles.input}
              value={rateLimitPerMin}
              onChange={(e) => setRateLimitPerMin(e.target.value)}
              placeholder="600"
              min={1}
              max={10000}
            />
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.scopes')}</label>
            <div className={styles.scopeList}>
              {SCOPES.map((scope) => (
                <label key={scope} className={styles.scopeCheckbox}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  {scope}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>{t('agents.status')}</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="isActive"
                  checked={isActive}
                  onChange={() => setIsActive(true)}
                />
                {t('agents.active')}
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="isActive"
                  checked={!isActive}
                  onChange={() => setIsActive(false)}
                />
                {t('agents.inactive')}
              </label>
            </div>
          </div>

          <button
            className={styles.saveButton}
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
          >
            {isSaving ? t('common.saving') : t('common.save')}
          </button>
        </div>
      </div>

      {/* Activity feed */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('agents.recent_activity')}
          <InfoTooltip text={t('help.agents_activity')} />
        </h2>
        {activities.length === 0 ? (
          <p className={styles.empty}>{t('agents.no_activity')}</p>
        ) : (
          <div className={styles.configCard}>
            {activities.map((item) => (
              <div key={item.id} className={styles.activityItem}>
                <span className={styles.activityAction}>{item.action}</span>
                <span
                  className={`${styles.activityStatus} ${
                    item.status === 'success'
                      ? styles.statusSuccess
                      : item.status === 'duplicate'
                        ? styles.statusDuplicate
                        : styles.statusError
                  }`}
                >
                  {item.status}
                </span>
                {item.memoryCount > 0 && (
                  <span>
                    {item.memoryCount} {t('agents.memories')}
                  </span>
                )}
                {item.durationMs !== null && <span>{item.durationMs}ms</span>}
                <span className={styles.activityTime}>
                  {formatRelativeTime(new Date(item.createdAt), locale)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>{t('agents.meta')}</h2>
        <div className={styles.configCard}>
          <div className={styles.formGroup}>
            <span className={styles.label}>{t('agents.api_key_prefix')}</span>
            <code className={styles.prefix}>{agent.prefix}...</code>
          </div>
          <div className={styles.formGroup}>
            <span className={styles.label}>{t('agents.created_at')}</span>
            <span>{new Date(agent.createdAt).toLocaleDateString(locale)}</span>
          </div>
          {agent.lastSyncedAt && (
            <div className={styles.formGroup}>
              <span className={styles.label}>{t('agents.last_synced')}</span>
              <span>{formatRelativeTime(new Date(agent.lastSyncedAt), locale)}</span>
            </div>
          )}
          {agent.expiresAt && (
            <div className={styles.formGroup}>
              <span className={styles.label}>{t('agents.expires_at')}</span>
              <span>{new Date(agent.expiresAt).toLocaleDateString(locale)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
