'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

export default function AgbPage() {
  const { t } = useAuth();

  const sections = [
    'scope',
    'definitions',
    'account',
    'account_agent',
    'usage',
    'usage_prohibited',
    'ip',
    'data_protection',
    'availability',
    'payment',
    'payment_refund',
    'api_keys',
    'termination',
    'termination_by_us',
    'liability',
    'liability_limitation',
    'indemnification',
    'force_majeure',
    'changes',
    'severability',
    'jurisdiction',
  ] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>{t('legal.terms.title')}</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2rem' }}>
        {t('legal.terms.last_updated')}
      </p>

      {sections.map((key) => {
        const title = t(`legal.terms.${key}_title`);
        const text = t(`legal.terms.${key}_text`);
        if (!title || title.includes('legal.terms.')) return null;
        return (
          <section key={key} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>{title}</h2>
            <p style={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}>{text}</p>
          </section>
        );
      })}

      <div style={{ marginTop: '2rem' }}>
        <Link href="/" style={{ color: '#6c5ce7' }}>
          {t('common.back')}
        </Link>
      </div>
    </div>
  );
}
