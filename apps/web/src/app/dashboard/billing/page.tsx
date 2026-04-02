'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './billing.module.css';

interface SubscriptionData {
  plan: { name: string; displayName: string };
  subscription: {
    status: string;
    periodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  } | null;
}

interface InvoiceData {
  id: string;
  amount: number;
  status: string;
  date: string | null;
  pdfUrl: string | null;
}

export default function BillingPage() {
  const { t, locale } = useAuth();
  const [sub, setSub] = useState<SubscriptionData | null>(null);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [subRes, invRes] = await Promise.all([
          apiClient.get<SubscriptionData>('/v1/billing/subscription'),
          apiClient.get<InvoiceData[]>('/v1/billing/invoices'),
        ]);

        if (subRes.data) setSub(subRes.data);
        if (invRes.data) setInvoices(invRes.data);
      } catch {
        // Billing data not available
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleManageBilling = async () => {
    const res = await apiClient.get<{ url: string }>('/v1/billing/portal');
    if (res.data?.url) {
      window.location.href = res.data.url;
    }
  };

  const formatAmount = (cents: number): string => {
    return (cents / 100).toFixed(2);
  };

  const getStatusClass = (status: string) => {
    if (status === 'active') return styles.statusActive ?? '';
    if (status === 'trialing') return styles.statusTrialing ?? '';
    return styles.statusCanceled ?? '';
  };

  const getInvoiceStatusClass = (status: string) => {
    if (status === 'paid') return styles.invoicePaid ?? '';
    if (status === 'open') return styles.invoiceOpen ?? '';
    return styles.invoiceDraft ?? '';
  };

  if (isLoading) {
    return <p className={styles.loading}>{t('common.loading')}</p>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('billing.title')}
        <InfoTooltip text={t('help.billing_title')} />
      </h1>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('billing.current_plan')}
          <InfoTooltip text={t('help.billing_current_plan')} />
        </h2>
        <div className={styles.planCard}>
          <div className={styles.planInfo}>
            <span className={styles.planName}>{sub?.plan.displayName ?? 'Free'}</span>
            {sub?.subscription && (
              <span className={styles.planStatus}>
                <span
                  className={`${styles.statusBadge} ${getStatusClass(sub.subscription.status)}`}
                >
                  {sub.subscription.status}
                </span>
                {sub.subscription.periodEnd && (
                  <>
                    {' '}
                    &middot; {t('billing.invoices.period_end')}{' '}
                    {formatDate(sub.subscription.periodEnd, locale)}
                  </>
                )}
              </span>
            )}
          </div>
          {sub?.subscription && (
            <button className={styles.manageBtn} onClick={handleManageBilling}>
              {t('billing.manage')}
            </button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {t('billing.invoices.title')}
          <InfoTooltip text={t('help.billing_invoices')} />
        </h2>

        {invoices.length === 0 ? (
          <p className={styles.empty}>{t('billing.invoices.empty')}</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('billing.invoices.date')}</th>
                <th>{t('billing.invoices.amount')}</th>
                <th>{t('billing.invoices.status')}</th>
                <th>{t('billing.invoices.pdf')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.date ? formatDate(inv.date, locale) : '-'}</td>
                  <td>{formatAmount(inv.amount)}</td>
                  <td>
                    <span
                      className={`${styles.invoiceStatus} ${getInvoiceStatusClass(inv.status ?? '')}`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td>
                    {inv.pdfUrl ? (
                      <a
                        href={inv.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.pdfLink}
                      >
                        {t('billing.invoices.download')}
                      </a>
                    ) : (
                      '-'
                    )}
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
