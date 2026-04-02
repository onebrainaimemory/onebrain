'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import styles from '../admin.module.css';

interface UserSummary {
  id: string;
  isActive: boolean;
  deletedAt: string | null;
}

interface DsgvoData {
  totalUsers: number;
  activeUsers: number;
  deletedUsers: number;
  pendingDeletions: number;
  generatedAt: string;
}

const DATA_CATEGORIES = [
  { key: 'email', basis: 'Art. 6(1)(b)', retention: 'Account lifetime + 30d' },
  { key: 'memories', basis: 'Art. 6(1)(b)', retention: 'Account lifetime + 30d' },
  { key: 'brain_profile', basis: 'Art. 6(1)(b)', retention: 'Account lifetime + 30d' },
  { key: 'sessions', basis: 'Art. 6(1)(b)', retention: '30d after expiry' },
  { key: 'usage_events', basis: 'Art. 6(1)(f)', retention: '24 months' },
  { key: 'audit_logs', basis: 'Art. 6(1)(f)', retention: '90 days' },
  { key: 'consent_records', basis: 'Art. 6(1)(c)', retention: '3 years' },
];

const THIRD_PARTY_PROCESSORS = [
  { name: 'Hetzner Online GmbH', purpose: 'Infrastructure / Hosting', location: 'Germany (EU)' },
  { name: 'Stripe Inc.', purpose: 'Payment Processing', location: 'USA (EU-US DPF)' },
  { name: 'SMTP Provider', purpose: 'Email Delivery', location: 'EU' },
];

export default function DsgvoReportPage() {
  const { t } = useAuth();
  const [data, setData] = useState<DsgvoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const usersRes = await apiClient.get<UserSummary[]>('/v1/admin/users');
        const users = usersRes.data ?? [];

        const activeUsers = users.filter((u) => u.isActive && !u.deletedAt).length;
        const deletedUsers = users.filter((u) => u.deletedAt).length;
        const pendingDeletions = users.filter(
          (u) =>
            u.deletedAt && new Date(u.deletedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        ).length;

        setData({
          totalUsers: users.length,
          activeUsers,
          deletedUsers,
          pendingDeletions,
          generatedAt: new Date().toISOString(),
        });
      } catch {
        setError(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  if (error) {
    return <p className={styles.error}>{error}</p>;
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('admin.dsgvo_report.title')}</h1>
      <p style={{ fontSize: '13px', color: 'var(--text-muted, #888)', marginBottom: '24px' }}>
        {t('admin.dsgvo_report.generated_at')}: {new Date(data.generatedAt).toLocaleString()}
      </p>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.totalUsers}</span>
          <span className={styles.statLabel}>{t('admin.dsgvo_report.total_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.activeUsers}</span>
          <span className={styles.statLabel}>{t('admin.dsgvo_report.active_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.deletedUsers}</span>
          <span className={styles.statLabel}>{t('admin.dsgvo_report.deleted_users')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{data.pendingDeletions}</span>
          <span className={styles.statLabel}>{t('admin.dsgvo_report.pending_deletions')}</span>
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.subtitle}>{t('admin.dsgvo_report.data_categories')}</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Data Category</th>
              <th>Legal Basis</th>
              <th>Retention Period</th>
            </tr>
          </thead>
          <tbody>
            {DATA_CATEGORIES.map((cat) => (
              <tr key={cat.key}>
                <td>{cat.key}</td>
                <td>
                  <code>{cat.basis}</code>
                </td>
                <td>{cat.retention}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={styles.section}>
        <h2 className={styles.subtitle}>{t('admin.dsgvo_report.third_party_processors')}</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Processor</th>
              <th>Purpose</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {THIRD_PARTY_PROCESSORS.map((proc) => (
              <tr key={proc.name}>
                <td>
                  <strong>{proc.name}</strong>
                </td>
                <td>{proc.purpose}</td>
                <td>{proc.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
