'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import styles from './faq.module.css';

const FAQ_CATEGORIES = [
  {
    key: 'general',
    items: ['what_is', 'who_for', 'free', 'open_source'],
  },
  {
    key: 'memory',
    items: ['what_memory', 'how_add', 'memory_types', 'memory_limit'],
  },
  {
    key: 'ai',
    items: ['which_ai', 'ai_agnostic', 'mcp_what', 'context_engine'],
  },
  {
    key: 'agents',
    items: [
      'what_agent',
      'agent_register',
      'invite_how',
      'invite_access',
      'agent_scopes',
      'agent_trust',
    ],
  },
  {
    key: 'features',
    items: ['deeprecall', 'skillforge', 'skillforge_how', 'brainpulse', 'merge_engine'],
  },
  {
    key: 'privacy',
    items: ['gdpr', 'data_where', 'data_delete', 'encryption', 'cookies'],
  },
  {
    key: 'technical',
    items: ['self_host', 'api_limits', 'sdks', 'languages'],
  },
] as const;

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FaqItem({ questionKey, t }: { questionKey: string; t: (key: string) => string }) {
  const [open, setOpen] = useState(false);

  const question = t(`faq.${questionKey}_q`);
  const answer = t(`faq.${questionKey}_a`);

  if (question.includes('faq.')) return null;

  return (
    <div className={styles.faqItem}>
      <button className={styles.question} onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={styles.questionText}>{question}</span>
        <ChevronIcon open={open} />
      </button>
      {open && <div className={styles.answer}>{answer}</div>}
    </div>
  );
}

export default function FaqPage() {
  const { token, t } = useAuth();

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <Logo href="/" size="sm" />
        <div className={styles.headerActions}>
          <LanguageSwitcher />
          {token ? (
            <Link href="/dashboard" className={styles.headerCta}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className={styles.headerLink}>
                {t('auth.login.title')}
              </Link>
              <Link href="/login" className={styles.headerCta}>
                {t('landing.get_started')}
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>{t('faq.title')}</h1>
        <p className={styles.heroSubtitle}>{t('faq.subtitle')}</p>
      </section>

      {/* FAQ Content */}
      <div className={styles.categories}>
        {FAQ_CATEGORIES.map((cat) => {
          const catTitle = t(`faq.cat_${cat.key}`);
          if (catTitle.includes('faq.')) return null;

          return (
            <section key={cat.key} className={styles.category}>
              <h2 className={styles.categoryTitle}>{catTitle}</h2>
              {cat.items.map((item) => (
                <FaqItem key={item} questionKey={item} t={t} />
              ))}
            </section>
          );
        })}

        <div style={{ textAlign: 'center' }}>
          <Link href="/" className={styles.backLink}>
            {t('common.back')}
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>OneBrain.rocks &mdash; AI Memory Layer</p>
        <div className={styles.footerLinks}>
          <Link href="/" className={styles.footerLink}>
            Home
          </Link>
          <Link href="/pricing" className={styles.footerLink}>
            {t('pricing.title')}
          </Link>
          <Link href="/impressum" className={styles.footerLink}>
            {t('legal.impressum.title')}
          </Link>
          <Link href="/datenschutz" className={styles.footerLink}>
            {t('legal.privacy.title')}
          </Link>
          <Link href="/agb" className={styles.footerLink}>
            {t('legal.terms.title')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
