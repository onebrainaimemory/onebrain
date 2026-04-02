'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/components/AuthContext';
import styles from './invite.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface RegisterResult {
  agentId: string;
  name: string;
  inviteCode: string;
  apiKey: {
    prefix: string;
    fullKey: string;
    scopes: string[];
    expiresAt: string | null;
  };
  trustLevel: string;
  message: string;
}

export default function InvitePage() {
  const { t } = useAuth();
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get('code') || '';

  const [code, setCode] = useState(codeFromUrl);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactUrl, setContactUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim(),
      };
      if (contactUrl.trim()) {
        body['contactUrl'] = contactUrl.trim();
      }

      const res = await fetch(`${API_BASE}/v1/invite/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!res.ok) {
        setErrorMsg(json.error?.message || t('invite.register_error'));
        return;
      }
      setResult(json.data);
    } catch {
      setErrorMsg(t('invite.register_error'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function copyKey() {
    if (!result) return;
    navigator.clipboard.writeText(result.apiKey.fullKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.logoLink}>
          <Logo />
        </Link>
        <LanguageSwitcher />
      </header>

      <main className={styles.main}>
        <h1 className={styles.title}>{t('invite.page_title')}</h1>
        <p className={styles.subtitle}>{t('invite.page_subtitle')}</p>

        {result ? (
          <div className={styles.successCard}>
            <h2 className={styles.successTitle}>{t('invite.success_title')}</h2>
            <p className={styles.successText}>{t('invite.success_text')}</p>

            <div className={styles.keyBlock}>
              <label className={styles.keyLabel}>{t('invite.your_api_key')}</label>
              <div className={styles.keyRow}>
                <code className={styles.keyValue}>{result.apiKey.fullKey}</code>
                <button className={styles.copyBtn} onClick={copyKey}>
                  {copied ? t('invite.copied') : t('invite.copy')}
                </button>
              </div>
              <p className={styles.keyWarning}>{t('invite.key_warning')}</p>
            </div>

            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('invite.agent_id')}</span>
                <code className={styles.detailValue}>{result.agentId}</code>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('invite.scopes')}</span>
                <span className={styles.detailValue}>{result.apiKey.scopes.join(', ')}</span>
              </div>
              <div className={styles.detailItem}>
                <span className={styles.detailLabel}>{t('invite.trust_level')}</span>
                <span className={styles.detailValue}>{result.trustLevel}</span>
              </div>
              {result.apiKey.expiresAt && (
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>{t('invite.expires')}</span>
                  <span className={styles.detailValue}>
                    {new Date(result.apiKey.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>

            <Link href="/" className={styles.backLink}>
              {t('invite.back_home')}
            </Link>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            {errorMsg && <div className={styles.error}>{errorMsg}</div>}

            <div className={styles.field}>
              <label className={styles.label}>{t('invite.code_label')} *</label>
              <input
                className={styles.input}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('invite.code_input_placeholder')}
                required
                minLength={4}
                maxLength={50}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('invite.agent_name')} *</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('invite.name_placeholder')}
                required
                minLength={2}
                maxLength={100}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('invite.agent_desc')} *</label>
              <textarea
                className={`${styles.input} ${styles.textarea}`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('invite.desc_input_placeholder')}
                required
                minLength={10}
                maxLength={1000}
                rows={3}
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>{t('invite.contact_url')}</label>
              <input
                className={styles.input}
                type="url"
                value={contactUrl}
                onChange={(e) => setContactUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <button
              className={styles.submitBtn}
              type="submit"
              disabled={isSubmitting || !code.trim() || !name.trim() || description.length < 10}
            >
              {isSubmitting ? t('common.loading') : t('invite.register_btn')}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
