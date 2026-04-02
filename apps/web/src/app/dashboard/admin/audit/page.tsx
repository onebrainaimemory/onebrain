'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate as formatDateLocale } from '@/lib/format';
import styles from './audit.module.css';

interface AuditLogEntry {
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  createdAt: string;
}

interface AuditMeta {
  cursor: string | null;
  hasMore: boolean;
}

const PAGE_SIZE = 50;

function formatDate(iso: string, locale: string): string {
  return formatDateLocale(iso, locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogPage() {
  const { t, locale } = useAuth();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [meta, setMeta] = useState<AuditMeta>({
    cursor: null,
    hasMore: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchLogs = useCallback(
    async (cursor?: string) => {
      try {
        const url = cursor
          ? `/v1/admin/audit-logs?cursor=${encodeURIComponent(cursor)}&limit=${PAGE_SIZE}`
          : `/v1/admin/audit-logs?limit=${PAGE_SIZE}`;

        const res = await apiClient.get<{
          data: AuditLogEntry[];
          meta: AuditMeta;
        }>(url);

        if (res.data) {
          const response = res.data as unknown as {
            data?: AuditLogEntry[];
            meta?: AuditMeta;
          };

          const newEntries = response.data ?? [];
          const newMeta = response.meta ?? {
            cursor: null,
            hasMore: false,
          };

          if (cursor) {
            setEntries((prev) => [...prev, ...newEntries]);
          } else {
            setEntries(newEntries);
          }
          setMeta(newMeta);
        } else if (Array.isArray(res.data)) {
          setEntries(res.data as unknown as AuditLogEntry[]);
          setMeta({ cursor: null, hasMore: false });
        }
      } catch {
        setError(t('common.error'));
      }
    },
    [t],
  );

  useEffect(() => {
    async function load() {
      await fetchLogs();
      setIsLoading(false);
    }
    load();
  }, [fetchLogs]);

  async function handleLoadMore() {
    if (!meta.cursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    await fetchLogs(meta.cursor);
    setIsLoadingMore(false);
  }

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>{t('admin.audit_title')}</h1>

      {error && <p className={styles.error}>{error}</p>}

      {entries.length === 0 ? (
        <p className={styles.empty}>{t('admin.audit_empty')}</p>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('admin.audit_date')}</th>
                <th>{t('admin.audit_user')}</th>
                <th>{t('admin.audit_action')}</th>
                <th>{t('admin.audit_resource')}</th>
                <th>ID</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.dateCell}>{formatDate(entry.createdAt, locale)}</td>
                  <td className={styles.userId}>{entry.userId}</td>
                  <td>
                    <span className={styles.actionBadge}>{entry.action}</span>
                  </td>
                  <td>{entry.resource}</td>
                  <td className={styles.resourceId}>{entry.resourceId}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {meta.hasMore && (
            <div className={styles.pagination}>
              <button
                className={styles.paginationButton}
                onClick={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? t('common.loading') : t('common.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
