'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';

export default function ImpressumPage() {
  const { t } = useAuth();

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1>{t('legal.impressum.title')}</h1>

      <section>
        <h2>{t('legal.impressum.provider')}</h2>
        <p>{t('legal.impressum.provider_text')}</p>
      </section>

      <section>
        <h2>{t('legal.impressum.contact')}</h2>
        <p>{t('legal.impressum.contact_text')}</p>
      </section>

      <section>
        <h2>{t('legal.impressum.responsible')}</h2>
        <p>{t('legal.impressum.responsible_text')}</p>
      </section>

      <section>
        <h2>{t('legal.impressum.dispute')}</h2>
        <p>{t('legal.impressum.dispute_text')}</p>
      </section>

      <div style={{ marginTop: '2rem' }}>
        <Link href="/" style={{ color: '#6c5ce7' }}>
          {t('common.back')}
        </Link>
      </div>
    </div>
  );
}
