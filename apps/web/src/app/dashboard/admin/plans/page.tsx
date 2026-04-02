'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from '../admin.module.css';

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

function formatPrice(cents: number | null): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toFixed(2);
}

export default function AdminPlansPage() {
  const { t } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    displayName: '',
    description: '',
    priceMonthly: '',
    priceYearly: '',
    trialDays: '0',
  });
  const [creating, setCreating] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchPlans() {
    try {
      const res = await apiClient.get<PlanSummary[]>('/v1/admin/plans');
      if (res.data) {
        setPlans(res.data);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchPlans();
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
      trialDays: parseInt(newPlan.trialDays || '0', 10),
    });

    if (res.data) {
      setShowCreateForm(false);
      setNewPlan({
        name: '',
        displayName: '',
        description: '',
        priceMonthly: '',
        priceYearly: '',
        trialDays: '0',
      });
      setSuccessMsg(t('admin.plan_created'));
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchPlans();
    } else if (res.error) {
      setError(res.error.message);
    }

    setCreating(false);
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('admin.plans')}</h1>

      {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{plans.length}</span>
          <span className={styles.statLabel}>{t('admin.total_plans')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{plans.filter((p) => p.isActive).length}</span>
          <span className={styles.statLabel}>{t('admin.active_plans')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{plans.reduce((sum, p) => sum + p.userCount, 0)}</span>
          <span className={styles.statLabel}>{t('admin.total_users')}</span>
        </div>
      </div>

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
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>{t('admin.trial_days')}</label>
                <input
                  className={styles.formInput}
                  type="number"
                  min="0"
                  max="365"
                  value={newPlan.trialDays}
                  onChange={(e) =>
                    setNewPlan({
                      ...newPlan,
                      trialDays: e.target.value,
                    })
                  }
                  placeholder="0"
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
                        {plan.priceYearly !== null && (
                          <>
                            {' / '}
                            {formatPrice(plan.priceYearly)}
                            {t('admin.per_year')}
                          </>
                        )}
                      </span>
                    ) : (
                      <span className={styles.planName}>{t('admin.free')}</span>
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
    </div>
  );
}
