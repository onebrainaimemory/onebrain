'use client';

import { useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './dev-tools.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://onebrain.rocks/api/eu';

const SDK_MODULES = [
  { name: 'memory', desc: 'memory.crud' },
  { name: 'entity', desc: 'entity.crud' },
  { name: 'project', desc: 'project.crud' },
  { name: 'brain', desc: 'brain.crud' },
  { name: 'context', desc: 'context.get' },
  { name: 'connect', desc: 'connect.check' },
  { name: 'billing', desc: 'billing.info' },
  { name: 'apiKeys', desc: 'apikeys.crud' },
] as const;

const API_ENDPOINTS = [
  { method: 'GET', path: '/v1/context', desc: 'endpoint.context' },
  { method: 'GET', path: '/v1/memory', desc: 'endpoint.memory_list' },
  { method: 'POST', path: '/v1/memory', desc: 'endpoint.memory_create' },
  { method: 'PATCH', path: '/v1/memory/:id', desc: 'endpoint.memory_update' },
  { method: 'DELETE', path: '/v1/memory/:id', desc: 'endpoint.memory_delete' },
  { method: 'GET', path: '/v1/entities', desc: 'endpoint.entity_list' },
  { method: 'POST', path: '/v1/entities', desc: 'endpoint.entity_create' },
  { method: 'GET', path: '/v1/projects', desc: 'endpoint.project_list' },
  { method: 'POST', path: '/v1/projects', desc: 'endpoint.project_create' },
  { method: 'GET', path: '/v1/brain', desc: 'endpoint.brain_get' },
  { method: 'GET', path: '/v1/connect/check', desc: 'endpoint.connect_check' },
] as const;

function methodColor(method: string): string {
  switch (method) {
    case 'GET':
      return styles.methodGet ?? '';
    case 'POST':
      return styles.methodPost ?? '';
    case 'PATCH':
      return styles.methodPatch ?? '';
    case 'DELETE':
      return styles.methodDelete ?? '';
    default:
      return '';
  }
}

export default function DevToolsPage() {
  const { t } = useAuth();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // clipboard not available
    }
  }

  const installCmd = 'npm install onebrain';

  const quickstart = `import OneBrain from 'onebrain';

const ob = new OneBrain({
  apiKey: 'ob_your_api_key',
  baseUrl: '${API_BASE}',
});

// Get full brain context
const ctx = await ob.context.get({ scope: 'assistant' });

// Write a memory
await ob.memory.create({
  type: 'fact',
  title: 'User preference',
  body: 'Prefers dark mode',
});

// Search memories
const results = await ob.memory.list({
  search: 'dark mode',
  limit: 10,
});`;

  const curlExample = `# Get brain context
curl -s ${API_BASE}/v1/context?scope=assistant \\
  -H "Authorization: ApiKey ob_your_api_key"

# Create a memory
curl -s -X POST ${API_BASE}/v1/memory \\
  -H "Authorization: ApiKey ob_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"fact","title":"Example","body":"Content"}'

# List memories
curl -s "${API_BASE}/v1/memory?limit=20" \\
  -H "Authorization: ApiKey ob_your_api_key"`;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('dev_tools.title')}
        <InfoTooltip text={t('dev_tools.subtitle')} />
      </h1>
      <p className={styles.subtitle}>{t('dev_tools.subtitle')}</p>

      {/* SDK Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>&lt;/&gt;</span>
          <h2 className={styles.cardTitle}>{t('dev_tools.sdk_title')}</h2>
          <span className={styles.badge}>TypeScript</span>
        </div>
        <p className={styles.cardDesc}>{t('dev_tools.sdk_desc')}</p>

        {/* Install */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.install')}</h3>
        <div className={styles.codeWrapper}>
          <pre className={styles.codeBlock}>{installCmd}</pre>
          <button
            className={`${styles.copyBtn} ${copiedId === 'install' ? styles.copyBtnCopied : ''}`}
            onClick={() => handleCopy('install', installCmd)}
          >
            {copiedId === 'install' ? t('common.copied') : t('common.copy')}
          </button>
        </div>

        {/* Quickstart */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.quickstart')}</h3>
        <div className={styles.codeWrapperLarge}>
          <pre className={styles.codeBlock}>{quickstart}</pre>
          <button
            className={`${styles.codeCopyBtn} ${copiedId === 'quickstart' ? styles.copyBtnCopied : ''}`}
            onClick={() => handleCopy('quickstart', quickstart)}
          >
            {copiedId === 'quickstart' ? t('common.copied') : t('common.copy_all')}
          </button>
        </div>

        {/* Module table */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.modules')}</h3>
        <div className={styles.moduleGrid}>
          {SDK_MODULES.map((mod) => (
            <div key={mod.name} className={styles.moduleItem}>
              <code className={styles.moduleName}>ob.{mod.name}</code>
              <span className={styles.moduleDesc}>{t(`dev_tools.${mod.desc}`)}</span>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className={styles.linkRow}>
          <a
            href="https://www.npmjs.com/package/onebrain"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.extLink}
          >
            npm
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-sdk"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.extLink}
          >
            GitHub
          </a>
        </div>
      </div>

      {/* REST API Section */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.cardIcon}>~$</span>
          <h2 className={styles.cardTitle}>{t('dev_tools.api_title')}</h2>
          <span className={styles.badgeSecondary}>REST</span>
        </div>
        <p className={styles.cardDesc}>{t('dev_tools.api_desc')}</p>

        {/* Base URL */}
        <h3 className={styles.sectionLabel}>Base URL</h3>
        <div className={styles.codeWrapper}>
          <pre className={styles.codeBlock}>{API_BASE}</pre>
          <button
            className={`${styles.copyBtn} ${copiedId === 'baseurl' ? styles.copyBtnCopied : ''}`}
            onClick={() => handleCopy('baseurl', API_BASE)}
          >
            {copiedId === 'baseurl' ? t('common.copied') : t('common.copy')}
          </button>
        </div>

        {/* Auth header */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.auth_header')}</h3>
        <div className={styles.codeWrapper}>
          <pre className={styles.codeBlock}>Authorization: ApiKey ob_your_api_key</pre>
          <button
            className={`${styles.copyBtn} ${copiedId === 'auth' ? styles.copyBtnCopied : ''}`}
            onClick={() => handleCopy('auth', 'Authorization: ApiKey ob_your_api_key')}
          >
            {copiedId === 'auth' ? t('common.copied') : t('common.copy')}
          </button>
        </div>

        {/* Endpoint table */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.endpoints')}</h3>
        <div className={styles.endpointTable}>
          {API_ENDPOINTS.map((ep) => (
            <div key={`${ep.method}-${ep.path}`} className={styles.endpointRow}>
              <span className={`${styles.endpointMethod} ${methodColor(ep.method)}`}>
                {ep.method}
              </span>
              <code className={styles.endpointPath}>{ep.path}</code>
              <span className={styles.endpointDesc}>{t(`dev_tools.${ep.desc}`)}</span>
            </div>
          ))}
        </div>

        {/* Curl examples */}
        <h3 className={styles.sectionLabel}>{t('dev_tools.curl_examples')}</h3>
        <div className={styles.codeWrapperLarge}>
          <pre className={styles.codeBlock}>{curlExample}</pre>
          <button
            className={`${styles.codeCopyBtn} ${copiedId === 'curl' ? styles.copyBtnCopied : ''}`}
            onClick={() => handleCopy('curl', curlExample)}
          >
            {copiedId === 'curl' ? t('common.copied') : t('common.copy_all')}
          </button>
        </div>
      </div>
    </div>
  );
}
