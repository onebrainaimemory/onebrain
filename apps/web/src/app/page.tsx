'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { Logo } from '@/components/Logo';
import {
  BrainIcon,
  AiIcon,
  LockIcon,
  BoltIcon,
  GlobeIcon,
  ChartIcon,
  GearIcon,
  SearchIcon,
  FlameIcon,
  BellIcon,
} from '@/components/Icons';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import styles from './landing.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface PublicStats {
  users: number;
  agents: number;
  brains: number;
  memories: number;
}

function usePublicStats(): PublicStats | null {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/v1/stats/public`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.data) setStats(json.data);
      })
      .catch(() => {});
  }, []);

  return stats;
}

export default function LandingPage() {
  const { token, t } = useAuth();
  const stats = usePublicStats();

  return (
    <div className={styles.page}>
      {/* Beta Banner */}
      <div className={styles.betaBanner}>{t('landing.beta_banner')}</div>

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
        <h1 className={styles.heroTitle}>
          {t('landing.hero_pre')}{' '}
          <span className={styles.heroHighlight}>{t('landing.hero_highlight')}</span>{' '}
          {t('landing.hero_post')}
        </h1>
        <p className={styles.heroSubtitle}>{t('landing.hero_subtitle')}</p>
        <div className={styles.heroCtas}>
          <Link href="/login" className={styles.ctaPrimary}>
            {t('landing.get_started')}
          </Link>
          <a href="#features" className={styles.ctaSecondary}>
            {t('landing.learn_more')}
          </a>
        </div>
      </section>

      {/* Live Stats Counter */}
      {stats && (
        <section className={styles.statsBar}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{stats.users.toLocaleString()}</span>
            <span className={styles.statLabel}>{t('landing.stat_users')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{stats.agents.toLocaleString()}</span>
            <span className={styles.statLabel}>{t('landing.stat_agents')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{stats.brains.toLocaleString()}</span>
            <span className={styles.statLabel}>{t('landing.stat_brains')}</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{stats.memories.toLocaleString()}</span>
            <span className={styles.statLabel}>{t('landing.stat_memories')}</span>
          </div>
        </section>
      )}

      {/* Features */}
      <section id="features" className={styles.features}>
        <h2 className={styles.sectionTitle}>{t('landing.features_title')}</h2>
        <p className={styles.sectionSubtitle}>{t('landing.features_subtitle')}</p>

        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <BrainIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_memory_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_memory_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <AiIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_ai_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_ai_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <LockIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_privacy_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_privacy_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <BoltIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_context_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_context_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <GlobeIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_mcp_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_mcp_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <ChartIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_merge_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_merge_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <GearIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_agents_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_agents_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <SearchIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_deeprecall_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_deeprecall_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <FlameIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_skillforge_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_skillforge_desc')}</p>
          </div>

          <div className={styles.featureCard}>
            <span className={styles.featureIcon}>
              <BellIcon />
            </span>
            <h3 className={styles.featureTitle}>{t('landing.feature_brainpulse_title')}</h3>
            <p className={styles.featureDesc}>{t('landing.feature_brainpulse_desc')}</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className={styles.howItWorks}>
        <h2 className={styles.sectionTitle}>{t('landing.how_title')}</h2>

        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>{t('landing.step1_title')}</h3>
              <p className={styles.stepDesc}>{t('landing.step1_desc')}</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>{t('landing.step2_title')}</h3>
              <p className={styles.stepDesc}>{t('landing.step2_desc')}</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>{t('landing.step3_title')}</h3>
              <p className={styles.stepDesc}>{t('landing.step3_desc')}</p>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepNumber}>4</div>
            <div className={styles.stepContent}>
              <h3 className={styles.stepTitle}>{t('landing.step4_title')}</h3>
              <p className={styles.stepDesc}>{t('landing.step4_desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* API Preview */}
      <section className={styles.apiPreview}>
        <h2 className={styles.sectionTitle}>{t('landing.api_title')}</h2>
        <p className={styles.sectionSubtitle}>{t('landing.api_subtitle')}</p>

        <pre className={styles.codeBlock}>
          <span className={styles.codeComment}># Get optimized context for your AI assistant</span>
          {'\n'}
          <span className={styles.codeKeyword}>curl</span>{' '}
          <span className={styles.codeString}>https://api.onebrain.rocks/v1/context/assistant</span>{' '}
          \{'\n'}
          {'  '}-H{' '}
          <span className={styles.codeString}>&quot;Authorization: ApiKey ob_your_key&quot;</span>
          {'\n\n'}
          <span className={styles.codeComment}>
            # Response: token-budgeted, personalized context
          </span>
          {'\n'}
          {`{
  "data": {
    "text": "## Identity\\nSenior developer, focused on ...",
    "meta": {
      "scope": "assistant",
      "tokenEstimate": 1847,
      "truncated": false,
      "identityIncluded": true
    }
  }
}`}
        </pre>
      </section>

      {/* SDK / Install */}
      <section id="sdk" className={styles.sdkSection}>
        <h2 className={styles.sectionTitle}>{t('landing.sdk_title')}</h2>
        <p className={styles.sectionSubtitle}>{t('landing.sdk_subtitle')}</p>

        <pre className={styles.codeBlock}>
          <span className={styles.codeComment}># Install the official SDK</span>
          {'\n'}
          <span className={styles.codeKeyword}>npm install</span>{' '}
          <span className={styles.codeString}>onebrain</span>
          {'\n\n'}
          <span className={styles.codeComment}># Or use the MCP server for AI editors</span>
          {'\n'}
          <span className={styles.codeKeyword}>npx</span>{' '}
          <span className={styles.codeString}>onebrain-mcp</span>
        </pre>

        <div className={styles.sdkGrid}>
          <a
            href="https://www.npmjs.com/package/onebrain"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>Node.js / TypeScript</span>
            <code className={styles.sdkCardCmd}>npm install onebrain</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-python"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>Python</span>
            <code className={styles.sdkCardCmd}>pip install onebrain</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-laravel"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>Laravel / PHP</span>
            <code className={styles.sdkCardCmd}>composer require onebrain/laravel</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-langchain"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>LangChain</span>
            <code className={styles.sdkCardCmd}>pip install onebrain-langchain</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-llama-index"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>LlamaIndex</span>
            <code className={styles.sdkCardCmd}>pip install onebrain-llama-index</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-ai-sdk"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>Vercel AI SDK</span>
            <code className={styles.sdkCardCmd}>npm install onebrain-ai-sdk</code>
          </a>
          <a
            href="https://github.com/onebrainaimemory/onebrain-openclaw"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>OpenClaw</span>
            <code className={styles.sdkCardCmd}>pip install onebrain-openclaw</code>
          </a>
          <a
            href="https://www.npmjs.com/package/onebrain-mcp"
            target="_blank"
            rel="noopener"
            className={styles.sdkCard}
          >
            <span className={styles.sdkCardLabel}>MCP Server</span>
            <code className={styles.sdkCardCmd}>npx onebrain-mcp</code>
          </a>
        </div>
      </section>

      {/* Agent Registration */}
      <section id="agents" className={styles.agentSection}>
        <h2 className={styles.sectionTitle}>{t('landing.agents_title')}</h2>
        <p className={styles.sectionSubtitle}>{t('landing.agents_subtitle')}</p>

        <div className={styles.agentSteps}>
          <div className={styles.agentStep}>
            <div className={styles.agentStepNum}>1</div>
            <h3 className={styles.agentStepTitle}>{t('landing.agents_step1')}</h3>
            <p className={styles.agentStepDesc}>{t('landing.agents_step1_desc')}</p>
          </div>
          <div className={styles.agentStep}>
            <div className={styles.agentStepNum}>2</div>
            <h3 className={styles.agentStepTitle}>{t('landing.agents_step2')}</h3>
            <p className={styles.agentStepDesc}>{t('landing.agents_step2_desc')}</p>
          </div>
          <div className={styles.agentStep}>
            <div className={styles.agentStepNum}>3</div>
            <h3 className={styles.agentStepTitle}>{t('landing.agents_step3')}</h3>
            <p className={styles.agentStepDesc}>{t('landing.agents_step3_desc')}</p>
          </div>
        </div>

        <pre className={styles.codeBlock}>
          <span className={styles.codeComment}># Option A: Self-register (read-only)</span>
          {'\n'}
          <span className={styles.codeKeyword}>curl</span> -X POST{' '}
          <span className={styles.codeString}>
            https://onebrain.rocks/api/eu/v1/agents/register
          </span>{' '}
          \{'\n'}
          {'  '}-H{' '}
          <span className={styles.codeString}>&quot;Content-Type: application/json&quot;</span> \
          {'\n'}
          {'  '}-d{' '}
          <span className={styles.codeString}>
            {`'{"name":"my-agent","description":"My helpful AI bot"}'`}
          </span>
          {'\n\n'}
          <span className={styles.codeComment}>
            # Option B: Register via invite link (read or read+write)
          </span>
          {'\n'}
          <span className={styles.codeKeyword}>curl</span> -X POST{' '}
          <span className={styles.codeString}>
            https://onebrain.rocks/api/eu/v1/invite/register
          </span>{' '}
          \{'\n'}
          {'  '}-H{' '}
          <span className={styles.codeString}>&quot;Content-Type: application/json&quot;</span> \
          {'\n'}
          {'  '}-d{' '}
          <span className={styles.codeString}>
            {`'{"code":"YOUR_INVITE_CODE","name":"my-agent","description":"My helpful AI bot"}'`}
          </span>
          {'\n\n'}
          <span className={styles.codeComment}># Use the returned API key</span>
          {'\n'}
          <span className={styles.codeKeyword}>curl</span>{' '}
          <span className={styles.codeString}>https://onebrain.rocks/api/eu/v1/connect</span> \
          {'\n'}
          {'  '}-H{' '}
          <span className={styles.codeString}>&quot;Authorization: ApiKey ob_your_key&quot;</span>
        </pre>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p className={styles.footerText}>OneBrain.rocks &mdash; AI Memory Layer</p>
        <div className={styles.footerLinks}>
          <Link href="/login" className={styles.footerLink}>
            Login
          </Link>
          <a href="#features" className={styles.footerLink}>
            Features
          </a>
          <a href="#sdk" className={styles.footerLink}>
            SDK
          </a>
          <a href="#agents" className={styles.footerLink}>
            Agents
          </a>
          <Link href="/invite" className={styles.footerLink}>
            Invite
          </Link>
          <Link href="/faq" className={styles.footerLink}>
            FAQ
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
        <p className={styles.footerMadeWith}>Made with ❤️ by diggerman49</p>
        <p className={styles.footerOpenSource}>
          <a
            href="https://github.com/onebrainaimemory/onebrain"
            target="_blank"
            rel="noopener"
            className={styles.footerLoveLink}
          >
            GitHub Open Source
          </a>
        </p>
        <p className={styles.footerDisclaimer}>{t('landing.disclaimer')}</p>
      </footer>
    </div>
  );
}
