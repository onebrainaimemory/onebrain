'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate } from '@/lib/format';
import styles from '../admin.module.css';

interface UserSummary {
  id: string;
  email: string;
  displayName: string | null;
  region: string;
  locale: string;
  isActive: boolean;
  plan: string;
  planName: string;
  memories: number;
  entities: number;
  projects: number;
  usageEvents: number;
  createdAt: string;
}

interface PlanOption {
  name: string;
  displayName: string;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  const [domainName, ...tldParts] = domain.split('.');
  if (!domainName) return email;
  const tld = tldParts.join('.');
  const maskedLocal =
    local.length <= 2 ? local[0] + '*'.repeat(5) : local.slice(0, 2) + '*'.repeat(5);
  const maskedDomain = domainName.length <= 1 ? '*'.repeat(5) : domainName[0] + '*'.repeat(5);
  return `${maskedLocal}@${maskedDomain}.${tld}`;
}

export default function AdminUsersPage() {
  const { t, locale } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  async function fetchData() {
    try {
      const [usersRes, plansRes] = await Promise.all([
        apiClient.get<UserSummary[]>('/v1/admin/users'),
        apiClient.get<PlanOption[]>('/v1/admin/plans'),
      ]);
      if (usersRes.data) setUsers(usersRes.data);
      if (plansRes.data) {
        setPlans(
          plansRes.data.map((p) => ({
            name: p.name ?? '',
            displayName: p.displayName ?? '',
          })),
        );
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function showSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  }

  async function toggleActive(userId: string, isActive: boolean) {
    const res = await apiClient.patch(`/v1/admin/users/${userId}`, {
      isActive: !isActive,
    });
    if (res.data) {
      showSuccess(t('admin.user_updated'));
      await fetchData();
    }
  }

  async function changePlan(userId: string, planName: string) {
    const res = await apiClient.patch(`/v1/admin/users/${userId}`, {
      planName,
    });
    if (res.data) {
      showSuccess(t('admin.plan_changed'));
      await fetchData();
    }
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('admin.users_title')}</h1>

      {successMsg && <div className={styles.successMessage}>{successMsg}</div>}
      {error && <div className={styles.errorMessage}>{error}</div>}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{users.length}</span>
          <span className={styles.statLabel}>{t('admin.total_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{users.filter((u) => u.isActive).length}</span>
          <span className={styles.statLabel}>{t('admin.active_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{users.reduce((sum, u) => sum + u.memories, 0)}</span>
          <span className={styles.statLabel}>{t('admin.total_memories')}</span>
        </div>
      </div>

      {users.length === 0 ? (
        <p className={styles.empty}>{t('admin.no_users')}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('admin.user_email')}</th>
              <th>{t('admin.user_name')}</th>
              <th>{t('admin.plan')}</th>
              <th>{t('admin.region')}</th>
              <th>{t('admin.status')}</th>
              <th>{t('admin.memories')}</th>
              <th>{t('admin.registered')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{maskEmail(user.email)}</td>
                <td>{user.displayName ?? '—'}</td>
                <td>
                  <select
                    className={styles.formSelect}
                    value={user.planName}
                    onChange={(e) => changePlan(user.id, e.target.value)}
                    style={{ padding: '4px 8px', fontSize: 13 }}
                  >
                    {plans.map((p) => (
                      <option key={p.name} value={p.name}>
                        {p.displayName}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{user.region}</td>
                <td>
                  <span
                    className={`${styles.badge} ${user.isActive ? styles.badgeActive : styles.badgeInactive}`}
                  >
                    {user.isActive ? t('admin.active') : t('admin.inactive')}
                  </span>
                </td>
                <td>{user.memories}</td>
                <td>{formatDate(user.createdAt, locale)}</td>
                <td>
                  <button
                    className={user.isActive ? styles.dangerButton : styles.secondaryButton}
                    onClick={() => toggleActive(user.id, user.isActive)}
                  >
                    {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
