import type { Metadata, Viewport } from 'next';
import { headers } from 'next/headers';
import './globals.css';
import { ClientProviders } from './ClientProviders';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? 'v1.10.0';
const IS_PROD = process.env.NODE_ENV === 'production';
const SITE_URL = 'https://onebrain.rocks';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'OneBrain — AI Memory Layer for Humans & Agents',
    template: '%s | OneBrain',
  },
  description:
    'Persistent AI memory that syncs across ChatGPT, Claude, Gemini and every AI tool. Store knowledge once, use it everywhere. REST API, MCP protocol, SDKs for Python, Node.js, Laravel, LangChain. GDPR-compliant, open source.',
  keywords: [
    'AI memory',
    'AI memory layer',
    'persistent AI context',
    'AI agent memory',
    'LLM memory',
    'ChatGPT memory sync',
    'Claude memory',
    'Gemini context',
    'MCP server',
    'AI knowledge base',
    'brain for AI',
    'AI context API',
    'LangChain memory',
    'LlamaIndex memory',
    'AI agent SDK',
    'GDPR AI',
    'open source AI memory',
    'OneBrain',
    'personal AI',
    'AI personalization',
  ],
  authors: [{ name: 'diggerman49', url: 'https://onebrain.rocks' }],
  creator: 'diggerman49',
  publisher: 'diggerman49',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      de: SITE_URL,
      en: SITE_URL,
      es: SITE_URL,
      'x-default': SITE_URL,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: ['de_DE', 'es_ES'],
    url: SITE_URL,
    siteName: 'OneBrain',
    title: 'OneBrain — AI Memory Layer for Humans & Agents',
    description:
      'Persistent AI memory that syncs across all your AI tools. Store knowledge once, use it everywhere. Open source, GDPR-compliant, self-hostable.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OneBrain — Your AI Memory Layer',
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OneBrain — AI Memory Layer',
    description:
      'Persistent AI memory that syncs across ChatGPT, Claude, Gemini. Store once, use everywhere. Open source & GDPR-compliant.',
    images: ['/og-image.png'],
    creator: '@onaborocks',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OneBrain',
  },
  category: 'technology',
  classification: 'AI Tools, Developer Tools, Productivity',
};

export const viewport: Viewport = {
  themeColor: '#0f0f23',
  width: 'device-width',
  initialScale: 1,
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'diggerman49',
      url: 'https://onebrain.rocks',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/icons/icon-512.png`,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        email: 'legal@onebrain.rocks',
        contactType: 'customer support',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'OneBrain',
      description: 'AI Memory Layer for Humans & Agents',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: ['en', 'de', 'es'],
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'OneBrain',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Any',
      description:
        'Persistent AI memory layer — store your identity, preferences, knowledge, and decisions. Delivers optimized context to any AI assistant via REST API or MCP protocol.',
      url: SITE_URL,
      author: { '@id': `${SITE_URL}/#organization` },
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'EUR',
        description: 'Free plan available',
      },
      featureList: [
        'Persistent memory across AI tools',
        'REST API with cursor-based pagination',
        'MCP protocol support',
        'SDKs for Python, Node.js, Laravel, LangChain, LlamaIndex',
        'Semantic search (DeepRecall)',
        'Skill extraction (SkillForge)',
        'Proactive briefings (BrainPulse)',
        'GDPR/DSGVO compliant',
        'Self-hostable (Docker)',
        'Open source',
        'AI agent provisioning API',
        'Invite-based agent registration with access levels',
        'Multi-language (DE/EN/ES)',
      ],
      screenshot: `${SITE_URL}/og-image.png`,
    },
    {
      '@type': 'FAQPage',
      '@id': `${SITE_URL}/faq`,
      mainEntity: [
        {
          '@type': 'Question',
          name: 'What is OneBrain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'OneBrain is a persistent AI memory layer that remembers who you are, what you know, and what you are working on. It syncs context across ChatGPT, Claude, Gemini, and any AI tool so you never repeat yourself.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is OneBrain free?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. There is a free plan with enough memory for personal use. Paid plans offer higher limits for teams and heavy usage.',
          },
        },
        {
          '@type': 'Question',
          name: 'Which AI tools work with OneBrain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'All of them. ChatGPT, Claude, Gemini, Cursor, any local LLM. Official SDKs for Node.js, Python, Laravel, LangChain, LlamaIndex, Vercel AI SDK, OpenClaw, and an MCP server for AI code editors.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do AI agents get an API key?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Agents can self-register via POST /v1/agents/register (read-only) or use an invite link from an admin via POST /v1/invite/register (read-only or read+write). No login required.',
          },
        },
        {
          '@type': 'Question',
          name: 'How do invite links work?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Admins create invite links with a unique code, optional expiration, and use limit. Each link can grant read-only or read+write access. Agents visit /invite/CODE, enter their details, and receive an API key with the configured permissions.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is DeepRecall?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'DeepRecall is smart search that finds memories by meaning, not just keywords. It combines semantic vectors with keyword matching for the most relevant results.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is SkillForge?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'SkillForge automatically detects patterns in how you use AI tools and extracts them as skills. These skills are injected into your AI context so it works your way.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is BrainPulse?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'BrainPulse sends proactive briefings — daily digests, weekly reports, or event-triggered alerts delivered via email, webhook, or in-app.',
          },
        },
        {
          '@type': 'Question',
          name: 'Is OneBrain GDPR compliant?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Servers in Germany (EU), encryption at rest, data export, right to erasure, cookie consent management. Fully GDPR/DSGVO compliant.',
          },
        },
        {
          '@type': 'Question',
          name: 'Can I self-host OneBrain?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'Yes. Clone the repo, run docker compose up. Includes Hetzner VPS deployment scripts with auto-HTTPS via Caddy. Open source on GitHub.',
          },
        },
        {
          '@type': 'Question',
          name: 'What is MCP and do I need it?',
          acceptedAnswer: {
            '@type': 'Answer',
            text: 'MCP (Model Context Protocol) lets AI tools like Cursor and Claude Desktop read your OneBrain automatically. Add one config line and done. Optional but very convenient.',
          },
        },
      ],
    },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get('x-nonce') ?? '';

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        <a href="#main-content" className="skipToContent">
          Skip to content
        </a>
        <ClientProviders>{children}</ClientProviders>
        {!IS_PROD && <span className="version">{APP_VERSION}</span>}
        <script src="/sw-register.js" defer nonce={nonce} />
      </body>
    </html>
  );
}
