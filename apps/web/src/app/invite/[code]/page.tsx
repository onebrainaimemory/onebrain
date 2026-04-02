'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useAuth } from '@/components/AuthContext';
import styles from '../invite.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface InviteInfo {
  code: string;
  label: string;
  description: string | null;
  accessLevel: string;
  remainingUses: number | null;
  expiresAt: string | null;
}

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

export default function InviteCodePage() {
  const { t } = useAuth();
  const params = useParams();
  const code = params.code as string;

  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [infoError, setInfoError] = useState('');
  const [infoLoading, setInfoLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactUrl, setContactUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchInfo() {
      try {
        const res = await fetch(`${API_BASE}/v1/invite/${code}/info`);
        const json = await res.json();
        if (!res.ok) {
          setInfoError(json.error?.message || t('invite.invalid_code'));
        } else {
          setInfo(json.data);
        }
      } catch {
        setInfoError(t('invite.register_error'));
      } finally {
        setInfoLoading(false);
      }
    }
    fetchInfo();
  }, [code]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = {
        code,
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
        {infoLoading ? (
          <p style={{ color: '#666', fontSize: 14 }}>{t('common.loading')}</p>
        ) : infoError ? (
          <div>
            <h1 className={styles.title}>{t('invite.invalid_title')}</h1>
            <p className={styles.error}>{infoError}</p>
            <Link href="/invite" className={styles.backLink}>
              {t('invite.enter_code_manually')}
            </Link>
          </div>
        ) : result ? (
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

            <div className={styles.guideSection}>
              <h3 className={styles.guideTitle}>{t('invite.about_title')}</h3>
              <p className={styles.guideText}>{t('invite.about_desc')}</p>

              <div className={styles.featureList}>
                <div className={styles.featureItem}>
                  <strong>{t('invite.about_context_title')}</strong>
                  <span>{t('invite.about_context_desc')}</span>
                </div>
                <div className={styles.featureItem}>
                  <strong>{t('invite.about_memory_title')}</strong>
                  <span>{t('invite.about_memory_desc')}</span>
                </div>
                <div className={styles.featureItem}>
                  <strong>{t('invite.about_search_title')}</strong>
                  <span>{t('invite.about_search_desc')}</span>
                </div>
                <div className={styles.featureItem}>
                  <strong>{t('invite.about_entities_title')}</strong>
                  <span>{t('invite.about_entities_desc')}</span>
                </div>
                <div className={styles.featureItem}>
                  <strong>{t('invite.about_connect_title')}</strong>
                  <span>{t('invite.about_connect_desc')}</span>
                </div>
              </div>
            </div>

            <div className={styles.guideSection}>
              <h3 className={styles.guideTitle}>{t('invite.guide_title')}</h3>
              <p className={styles.guideText}>{t('invite.guide_intro')}</p>

              <div className={styles.guideBlock}>
                <strong>{t('invite.guide_context')}</strong>
                <pre className={styles.guideCode}>
                  {`curl https://onebrain.rocks/api/eu/v1/context/assistant \\
  -H "Authorization: ApiKey ${result.apiKey.fullKey}"`}
                </pre>
              </div>

              {result.apiKey.scopes.includes('connect.read') && (
                <div className={styles.guideBlock}>
                  <strong>{t('invite.guide_connect')}</strong>
                  <pre className={styles.guideCode}>
                    {`curl https://onebrain.rocks/api/eu/v1/connect/${result.apiKey.prefix} \\
  -H "Authorization: ApiKey ${result.apiKey.fullKey}"`}
                  </pre>
                </div>
              )}

              {result.apiKey.scopes.includes('memory.write') && (
                <div className={styles.guideBlock}>
                  <strong>{t('invite.guide_write_memory')}</strong>
                  <pre className={styles.guideCode}>
                    {`curl -X POST https://onebrain.rocks/api/eu/v1/memory \\
  -H "Authorization: ApiKey ${result.apiKey.fullKey}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Example","body":"...","type":"fact"}'`}
                  </pre>
                </div>
              )}

              <div className={styles.guideBlock}>
                <strong>{t('invite.guide_openapi')}</strong>
                <pre className={styles.guideCode}>
                  {`curl https://onebrain.rocks/api/eu/v1/openapi.json`}
                </pre>
              </div>

              <p className={styles.guideText}>{t('invite.guide_docs_hint')}</p>
            </div>

            <Link href="/" className={styles.backLink}>
              {t('invite.back_home')}
            </Link>
          </div>
        ) : (
          <div>
            <h1 className={styles.title}>{info?.label || t('invite.page_title')}</h1>
            {info?.description && <p className={styles.subtitle}>{info.description}</p>}
            <p className={styles.subtitle}>
              {info?.accessLevel === 'readwrite'
                ? t('invite.page_subtitle_readwrite')
                : t('invite.page_subtitle_read')}
            </p>

            <form className={styles.form} onSubmit={handleSubmit}>
              {errorMsg && <div className={styles.error}>{errorMsg}</div>}

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
                disabled={isSubmitting || !name.trim() || description.length < 10}
              >
                {isSubmitting ? t('common.loading') : t('invite.register_btn')}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
