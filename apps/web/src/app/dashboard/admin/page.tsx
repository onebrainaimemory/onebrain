'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from './admin.module.css';

interface PlanSummary {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  priceMonthly: number | null;
  priceYearly: number | null;
  trialDays: number;
  limits: Array<{ key: string; value: number; period: string }>;
  features: Array<{ key: string; value: string }>;
  userCount: number;
  createdAt: string;
}

interface UserSummary {
  id: string;
  memories: number;
  isActive: boolean;
}

interface AuditEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  userId: string;
  createdAt: string;
}

interface StatsData {
  totalUsers: number;
  activeUsers: number;
  totalMemories: number;
  totalPlans: number;
  activePlans: number;
}

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toFixed(2);
}

function computeStats(users: UserSummary[], plans: PlanSummary[]): StatsData {
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.isActive).length,
    totalMemories: users.reduce((sum, u) => sum + u.memories, 0),
    totalPlans: plans.length,
    activePlans: plans.filter((p) => p.isActive).length,
  };
}

export default function AdminOverviewPage() {
  const { t } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [recentAudit, setRecentAudit] = useState<AuditEntry[]>([]);
  const [stats, setStats] = useState<StatsData>({
    totalUsers: 0,
    activeUsers: 0,
    totalMemories: 0,
    totalPlans: 0,
    activePlans: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    displayName: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
  });
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [encrypting, setEncrypting] = useState(false);

  async function fetchData() {
    try {
      const [plansRes, usersRes, auditRes] = await Promise.all([
        apiClient.get<PlanSummary[]>('/v1/admin/plans'),
        apiClient.get<UserSummary[]>('/v1/admin/users'),
        apiClient.get<AuditEntry[]>('/v1/admin/audit-logs?limit=10'),
      ]);

      const fetchedPlans = plansRes.data ?? [];
      const fetchedUsers = usersRes.data ?? [];

      setPlans(fetchedPlans);
      setStats(computeStats(fetchedUsers, fetchedPlans));
      setRecentAudit(auditRes.data ?? []);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleCreatePlan(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');

    const res = await apiClient.post<PlanSummary>('/v1/admin/plans', {
      name: newPlan.name,
      displayName: newPlan.displayName,
      description: newPlan.description || undefined,
      priceMonthly: newPlan.priceMonthly ? parseInt(newPlan.priceMonthly, 10) : undefined,
      priceYearly: newPlan.priceYearly ? parseInt(newPlan.priceYearly, 10) : undefined,
    });

    if (res.data) {
      setShowCreateForm(false);
      setNewPlan({
        name: '',
        displayName: '',
        description: '',
        priceMonthly: '',
        priceYearly: '',
      });
      setSuccessMsg(t('admin.plan_created'));
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchData();
    } else if (res.error) {
      setError(res.error.message);
    }

    setCreating(false);
  }

  async function handleEncryptMemories() {
    setEncrypting(true);
    setError('');

    const res = await apiClient.post<{
      encrypted: number;
      skipped: number;
      errors: string[];
      message: string;
    }>('/v1/admin/encrypt-memories', {});

    if (res.data) {
      if (res.data.skipped > 0) {
        setSuccessMsg(
          t('admin.encryption_partial')
            .replace('{count}', String(res.data.encrypted))
            .replace('{failed}', String(res.data.skipped)),
        );
      } else if (res.data.encrypted === 0) {
        setSuccessMsg(t('admin.encryption_already_done'));
      } else {
        setSuccessMsg(t('admin.encryption_success').replace('{count}', String(res.data.encrypted)));
      }
      setTimeout(() => setSuccessMsg(''), 5000);
    } else if (res.error) {
      setError(res.error.message);
    }

    setEncrypting(false);
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalUsers}</span>
          <span className={styles.statLabel}>{t('admin.total_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.activeUsers}</span>
          <span className={styles.statLabel}>{t('admin.active_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalMemories}</span>
          <span className={styles.statLabel}>{t('admin.total_memories')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.totalPlans}</span>
          <span className={styles.statLabel}>{t('admin.total_plans')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats.activePlans}</span>
          <span className={styles.statLabel}>{t('admin.active_plans')}</span>
        </div>
      </div>

      {recentAudit.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.subtitle}>{t('admin.recent_activity')}</h2>
            <Link href="/dashboard/admin/audit" className={styles.linkButton}>
              {t('admin.audit_logs')}
            </Link>
          </div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.audit_action')}</th>
                <th>{t('admin.audit_resource')}</th>
                <th>{t('admin.audit_date')}</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.action}</td>
                  <td>{entry.resource}</td>
                  <td>{new Date(entry.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.subtitle}>{t('admin.plans')}</h2>
          <button
            className={styles.primaryButton}
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? t('common.cancel') : t('admin.create_plan')}
          </button>
        </div>

        {showCreateForm && (
          <form className={styles.form} onSubmit={handleCreatePlan}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.plan_name')}</label>
                <input
                  className={styles.formInput}
                  value={newPlan.name}
                  onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                  placeholder="pro"
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.display_name')}</label>
                <input
                  className={styles.formInput}
                  value={newPlan.displayName}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      displayName: e.target.value,
                    })
                  }
                  placeholder="Pro Plan"
                  required
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>{t('admin.description')}</label>
              <input
                className={styles.formInput}
                value={newPlan.description}
                onChange={(e) =>
                  setNewPlan({
                    ...newPlan,
                    description: e.target.value,
                  })
                }
                placeholder={t('admin.description_placeholder')}
              />
            </div>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.price_monthly')}</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  value={newPlan.priceMonthly}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      priceMonthly: e.target.value,
                    })
                  }
                  placeholder="990"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.price_yearly')}</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  value={newPlan.priceYearly}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      priceYearly: e.target.value,
                    })
                  }
                  placeholder="9900"
                />
              </div>
            </div>
            <div className={styles.formActions}>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={creating || !newPlan.name || !newPlan.displayName}
              >
                {creating ? t('common.loading') : t('admin.create_plan')}
              </button>
            </div>
          </form>
        )}

        {plans.length === 0 ? (
          <p className={styles.empty}>{t('admin.no_plans')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.plan_name')}</th>
                <th>{t('admin.display_name')}</th>
                <th>{t('admin.price')}</th>
                <th>{t('admin.status')}</th>
                <th>{t('admin.limits_count')}</th>
                <th>{t('admin.features_count')}</th>
                <th>{t('admin.users')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <code>{plan.name}</code>
                  </td>
                  <td>{plan.displayName}</td>
                  <td>
                    {plan.priceMonthly !== null ? (
                      <span>
                        {formatPrice(plan.priceMonthly)}
                        {t('admin.per_month')}
                      </span>
                    ) : (
                      t('admin.free')
                    )}
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${
                        plan.isActive ? styles.badgeActive : styles.badgeInactive
                      }`}
                    >
                      {plan.isActive ? t('admin.active') : t('admin.inactive')}
                    </span>
                  </td>
                  <td>{plan.limits.length}</td>
                  <td>{plan.features.length}</td>
                  <td>{plan.userCount}</td>
                  <td>
                    <Link href={`/dashboard/admin/plans/${plan.id}`} className={styles.linkButton}>
                      {t('common.edit')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.subtitle}>{t('admin.encryption_title')}</h2>
        </div>
        <p style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
          {t('admin.encryption_desc')}
        </p>
        <button
          className={styles.primaryButton}
          onClick={handleEncryptMemories}
          disabled={encrypting}
        >
          {encrypting ? t('admin.encrypting') : t('admin.encrypt_memories')}
        </button>
      </div>
    </div>
  );
}
