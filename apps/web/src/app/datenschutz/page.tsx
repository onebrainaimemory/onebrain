'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

export default function DatenschutzPage() {
  const { t } = useAuth();

  const sections = [
    'overview',
    'controller',
    'data_collection',
    'data_collection_account',
    'data_collection_memory',
    'data_collection_technical',
    'data_collection_payment',
    'data_collection_agent',
    'legal_basis',
    'retention',
    'cookies',
    'third_parties',
    'third_parties_hetzner',
    'third_parties_stripe',
    'third_parties_resend',
    'third_parties_openai',
    'data_transfers',
    'rights',
    'rights_access',
    'rights_rectification',
    'rights_erasure',
    'rights_portability',
    'rights_objection',
    'rights_complaint',
    'security',
    'children',
    'changes',
    'contact',
  ] as const;

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>{t('legal.privacy.title')}</h1>
      <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '2rem' }}>
        {t('legal.privacy.last_updated')}
      </p>

      {sections.map((key) => {
        const title = t(`legal.privacy.${key}_title`);
        const text = t(`legal.privacy.${key}_text`);
        if (!title || title.includes('legal.privacy.')) return null;
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
