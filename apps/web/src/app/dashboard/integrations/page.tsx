'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './integrations.module.css';

type CopiedKey = string | null;

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  trustLevel?: string;
  fullKey?: string;
}

type McpTab = 'claude' | 'cursor' | 'windsurf' | 'claudecode';
type KeyScope = 'readonly' | 'readwrite';

function CodeBlock({
  code,
  copyKey,
  copiedKey,
  onCopy,
  label,
}: {
  code: string;
  copyKey: string;
  copiedKey: CopiedKey;
  onCopy: (key: string, text: string) => void;
  label: string;
}) {
  const isCopied = copiedKey === copyKey;

  return (
    <div className={styles.codeWrapper}>
      <code className={styles.codeBlock}>{code}</code>
      <button
        className={`${styles.copyButton} ${isCopied ? styles.copyButtonCopied : ''}`}
        onClick={() => onCopy(copyKey, code)}
        aria-label={`Copy ${label}`}
      >
        {isCopied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}

/** Platforms supported by the bookmarklet */
const BOOKMARKLET_PLATFORMS = ['ChatGPT', 'Claude Web', 'Grok', 'Perplexity', 'Gemini', 'Copilot'];

/**
 * Builds a compact, self-contained bookmarklet URL.
 *
 * Uses a popup-bridge approach to bypass COEP / service-worker
 * restrictions on AI chat sites (ChatGPT, Claude, etc.).
 * The bookmarklet opens a tiny popup to OneBrain's bridge endpoint,
 * which fetches context same-origin and sends it back via postMessage.
 */
function buildBookmarkletUrl(apiUrl: string): string {
  const safeUrl = apiUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const src = [
    '(function(){',
    'if(window.__ob_bm){var e=document.getElementById("__ob_bm");',
    'if(e)e.remove();window.__ob_bm=0;return}window.__ob_bm=1;',
    'var K="_obk",',
    'A=localStorage.getItem(K),',
    'U=localStorage.getItem("_obu")||"' + safeUrl + '";',
    'if(!A){A=prompt("OneBrain API Key:\\n\\n',
    'Find yours at Integrations page");',
    'if(!A){window.__ob_bm=0;return}localStorage.setItem(K,A)}',
    // Status overlay
    'var d=document.createElement("div");d.id="__ob_bm";',
    'd.style.cssText="position:fixed;bottom:20px;right:20px;',
    'padding:12px 20px;background:#111;color:#fff;',
    'border-radius:8px;font:14px -apple-system,sans-serif;',
    'z-index:999999;box-shadow:0 4px 20px rgba(0,0,0,.4)";',
    'd.textContent="OneBrain: Loading...";',
    'document.body.appendChild(d);',
    // Open popup bridge (same-origin fetch, bypasses COEP)
    'var w=window.open(U+"/v1/connect/bridge#"+encodeURIComponent(A),',
    '"ob","width=420,height=260");',
    'if(!w){d.textContent="Popup blocked! Allow popups.";',
    'd.style.background="#991b1b";',
    'setTimeout(function(){d.remove();window.__ob_bm=0},4000);return}',
    // Inject helper — direct injection for ProseMirror/Quill/textarea
    // Skips Lexical editors (ChatGPT #prompt-textarea) — they ignore execCommand
    'function inject(t){',
    'var el=document.querySelector(',
    '"div.ProseMirror[contenteditable],',
    'textarea,.ql-editor");',
    'if(!el)return!1;',
    'if(el.tagName==="TEXTAREA"){',
    'Object.getOwnPropertyDescriptor(',
    'HTMLTextAreaElement.prototype,"value")',
    '.set.call(el,t+"\\n\\n"+el.value);',
    'el.dispatchEvent(new Event("input",{bubbles:!0}));return!0}',
    'el.focus();',
    'var s=window.getSelection(),r=document.createRange();',
    'r.selectNodeContents(el);r.collapse(!0);',
    's.removeAllRanges();s.addRange(r);',
    'document.execCommand("insertText",!1,t+"\\n\\n");return!0}',
    // Show prominent paste notification (built with DOM, no innerHTML)
    'function showPaste(){',
    'd.style.cssText="position:fixed;bottom:20px;right:20px;',
    'padding:18px 28px;background:#166534;color:#fff;',
    'border-radius:12px;font:15px -apple-system,sans-serif;',
    'z-index:999999;box-shadow:0 4px 24px rgba(0,0,0,.5);',
    'text-align:center;min-width:260px;cursor:pointer";',
    'var h1=document.createElement("div");',
    'h1.style.cssText="font-size:20px;margin-bottom:8px;font-weight:600";',
    'h1.textContent="\\u2713 Brain Context ready!";',
    'var h2=document.createElement("div");',
    'h2.style.cssText="font-size:15px;opacity:.9";',
    'h2.textContent="Paste into chat: \\u2318V (Mac) or Ctrl+V (Win)";',
    'var h3=document.createElement("div");',
    'h3.style.cssText="font-size:12px;opacity:.6;margin-top:8px";',
    'h3.textContent="Click to dismiss";',
    'd.textContent="";d.appendChild(h1);',
    'd.appendChild(h2);d.appendChild(h3);',
    'd.onclick=function(){d.remove();window.__ob_bm=0};',
    'setTimeout(function(){d.remove();window.__ob_bm=0},12000)}',
    // Handle bridge response — clipboard written by bridge on onebrain.rocks
    'function h(ev){if(!ev.data||ev.data.type!=="ob-ctx")return;',
    'window.removeEventListener("message",h);',
    'if(w&&!w.closed)w.close();',
    'var t=ev.data.text,ok=inject(t);',
    'if(ok){d.textContent="\\u2713 Context injected!";',
    'd.style.background="#166534";',
    'setTimeout(function(){d.remove();window.__ob_bm=0},2500)}',
    'else if(ev.data.copied){showPaste()}',
    'else{d.textContent="Could not inject context.";',
    'd.style.background="#92400e";',
    'setTimeout(function(){d.remove();window.__ob_bm=0},4000)}}',
    'window.addEventListener("message",h);',
    // Timeout fallback
    'setTimeout(function(){if(window.__ob_bm){',
    'window.removeEventListener("message",h);',
    'd.textContent="Timeout \\u2014 click to reset";',
    'd.style.background="#991b1b";d.style.cursor="pointer";',
    'd.onclick=function(){localStorage.removeItem(K);',
    'd.remove();window.__ob_bm=0};',
    'if(w&&!w.closed)w.close()}},15000)',
    '})()',
  ].join('');
  return 'javascript:void ' + encodeURIComponent(src);
}

function buildMcpConfig(apiBase: string, apiKey: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        onebrain: {
          command: 'npx',
          args: ['-y', 'onebrain-mcp'],
          env: {
            ONEBRAIN_API_URL: apiBase,
            ONEBRAIN_API_KEY: apiKey || 'ob_your_key_here',
          },
        },
      },
    },
    null,
    2,
  );
}

export default function IntegrationsPage() {
  const { t } = useAuth();
  const [copiedKey, setCopiedKey] = useState<CopiedKey>(null);
  const [connectKeys, setConnectKeys] = useState<ApiKeyItem[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [keyScope, setKeyScope] = useState<KeyScope>('readwrite');
  const [showStep2, setShowStep2] = useState(false);
  const [mcpTab, setMcpTab] = useState<McpTab>('claude');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKeyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const bookmarkletContainerRef = useRef<HTMLDivElement>(null);

  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'https://api.onebrain.rocks');

  const activeKey = createdKey || '';

  const fetchKeys = useCallback(async () => {
    try {
      const res = await apiClient.get<{ items: ApiKeyItem[] }>('/v1/api-keys');
      if (res.data) {
        const filtered = res.data.items.filter(
          (k) => k.scopes?.includes('connect.read') || k.scopes?.includes('connect.write'),
        );
        setConnectKeys(filtered);
      }
    } catch {
      /* silent */
    } finally {
      setIsLoadingKeys(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCopy = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }, []);

  async function handleCreateKey() {
    setIsCreatingKey(true);
    setError('');
    const scopes =
      keyScope === 'readonly'
        ? ['connect.read', 'brain.read', 'entity.read']
        : [
            'connect.read',
            'connect.write',
            'brain.read',
            'brain.write',
            'memory.extract.write',
            'entity.read',
            'entity.write',
          ];
    const scopeLabel = keyScope === 'readonly' ? 'Read-Only' : 'Read+Write';
    try {
      const res = await apiClient.post<{
        id: string;
        name: string;
        prefix: string;
        scopes: string[];
        fullKey: string;
        trustLevel: string;
      }>('/v1/api-keys', {
        name: `OneBrain Key (${scopeLabel})`,
        scopes,
      });
      if (res.data) {
        setCreatedKey(res.data.fullKey);
        await fetchKeys();
      } else if (res.error) {
        setError(res.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsCreatingKey(false);
    }
  }

  async function handleTrustLevelChange(keyId: string, newLevel: string) {
    try {
      await apiClient.patch(`/v1/api-keys/${keyId}/trust`, { trustLevel: newLevel });
      await fetchKeys();
    } catch {
      setError(t('common.error'));
    }
  }

  async function handleDeleteKey() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/v1/api-keys/${deleteTarget.id}`);
      setDeleteTarget(null);
      await fetchKeys();
    } catch {
      setError(t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }

  const handleGeneratePrompt = useCallback(async () => {
    setIsGenerating(true);
    setError('');
    try {
      const response = await apiClient.get<{ prompt: string }>('/v1/export/ai-prompt');
      if (response.data) {
        setSystemPrompt(response.data.prompt);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsGenerating(false);
    }
  }, [t]);

  const mcpConfig = buildMcpConfig(apiBase, activeKey);
  const bookmarkletUrl = buildBookmarkletUrl(apiBase);

  // Create the bookmarklet <a> entirely outside React's control.
  // React blocks javascript: URLs in JSX and strips the href attribute,
  // which also breaks drag-to-bookmarks-bar (needs a real href in DOM).
  useEffect(() => {
    const container = bookmarkletContainerRef.current;
    if (!container) return;
    const prev = container.querySelector('a');
    if (prev) prev.remove();
    const link = document.createElement('a');
    link.href = bookmarkletUrl;
    link.className = styles.bookmarkletLink ?? '';
    link.textContent = 'OneBrain';
    link.title = t('integrations.bookmarklet_drag_title');
    link.addEventListener('click', (e) => e.preventDefault());
    container.appendChild(link);
    return () => {
      link.remove();
    };
  }, [bookmarkletUrl, t, showStep2, connectKeys.length]);

  const mcpPaths: Record<McpTab, string> = {
    claude: t('integrations.mcp_claude_path'),
    cursor: t('integrations.mcp_cursor_path'),
    windsurf: t('integrations.mcp_windsurf_path'),
    claudecode: t('integrations.mcp_claudecode_path'),
  };

  const mcpTabs: { key: McpTab; label: string }[] = [
    { key: 'claude', label: t('integrations.mcp_tab_claude') },
    { key: 'cursor', label: t('integrations.mcp_tab_cursor') },
    { key: 'windsurf', label: t('integrations.mcp_tab_windsurf') },
    { key: 'claudecode', label: t('integrations.mcp_tab_claudecode') },
  ];

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('integrations.title')}
        <InfoTooltip text={t('help.integrations_title')} />
      </h1>
      <p className={styles.subtitle}>{t('integrations.subtitle')}</p>

      {error && <p className={styles.error}>{error}</p>}

      {/* ── Step 1: API Key ── */}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>{t('integrations.step1_title')}</h2>
        </div>
        <p className={styles.cardDesc}>{t('integrations.step1_desc')}</p>

        {isLoadingKeys ? (
          <p className={styles.loadingText}>{t('common.loading')}</p>
        ) : createdKey ? (
          <div className={styles.connectResult}>
            <p className={styles.connectInstructions}>{t('integrations.your_key')}</p>
            <CodeBlock
              code={createdKey}
              copyKey="api-key"
              copiedKey={copiedKey}
              onCopy={handleCopy}
              label="API Key"
            />
            <p className={styles.warningText}>{t('api_keys.copy_warning')}</p>
            <button
              className={styles.primaryButton}
              onClick={() => {
                setShowStep2(true);
                setTimeout(() => {
                  document.getElementById('step2')?.scrollIntoView({ behavior: 'smooth' });
                }, 50);
              }}
              style={{ marginTop: 12 }}
            >
              {t('integrations.continue_setup')}
            </button>
          </div>
        ) : (
          <div className={styles.connectSetup}>
            {connectKeys.length > 0 && (
              <>
                <div className={styles.existingKeys}>
                  {connectKeys.map((k) => (
                    <div key={k.id} className={styles.existingKey}>
                      <span className={styles.keyName}>{k.name}</span>
                      <div className={styles.keyPrefixGroup}>
                        <code className={styles.keyPrefix}>{k.prefix}_***</code>
                        <span
                          className={styles.keyMaskedHint}
                          title={t('integrations.key_masked_hint')}
                        >
                          {t('integrations.key_masked_short')}
                        </span>
                      </div>
                      <span className={styles.scopeBadge}>
                        {k.scopes?.includes('connect.write')
                          ? t('integrations.read_write')
                          : t('integrations.read_only')}
                      </span>
                      <div className={styles.trustToggle}>
                        <button
                          className={`${styles.trustButton} ${(k.trustLevel ?? 'review') === 'review' ? styles.trustActive : ''}`}
                          onClick={() => handleTrustLevelChange(k.id, 'review')}
                          title={t('integrations.trust_review_desc')}
                        >
                          {t('integrations.trust_review')}
                        </button>
                        <button
                          className={`${styles.trustButton} ${k.trustLevel === 'trusted' ? styles.trustActive : ''}`}
                          onClick={() => handleTrustLevelChange(k.id, 'trusted')}
                          title={t('integrations.trust_trusted_desc')}
                        >
                          {t('integrations.trust_trusted')}
                        </button>
                      </div>
                      <button
                        className={styles.deleteButton}
                        onClick={() => setDeleteTarget(k)}
                        title={t('integrations.delete_key')}
                      >
                        {t('integrations.delete_key')}
                      </button>
                    </div>
                  ))}
                </div>

                {/* Next steps guide */}
                <div className={styles.nextStepsBox}>
                  <h3 className={styles.nextStepsTitle}>{t('integrations.next_steps_title')}</h3>
                  <p className={styles.nextStepsDesc}>{t('integrations.next_steps_desc')}</p>
                  <div className={styles.nextStepsGrid}>
                    <button
                      className={styles.nextStepCard}
                      onClick={() =>
                        document.getElementById('step2')?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <span className={styles.nextStepIcon}>{'</>'}</span>
                      <strong>{t('integrations.next_step_mcp')}</strong>
                      <span>{t('integrations.next_step_mcp_desc')}</span>
                      <span className={styles.nextStepBadge}>{t('integrations.recommended')}</span>
                    </button>
                    <button
                      className={styles.nextStepCard}
                      onClick={() =>
                        document
                          .getElementById('section-bookmarklet')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <span className={styles.nextStepIcon}>{'BM'}</span>
                      <strong>{t('integrations.next_step_bookmarklet')}</strong>
                      <span>{t('integrations.next_step_bookmarklet_desc')}</span>
                      <span className={styles.nextStepBadgeNew}>{t('integrations.badge_new')}</span>
                    </button>
                    <button
                      className={styles.nextStepCard}
                      onClick={() =>
                        document
                          .getElementById('section-chatgpt')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <span className={styles.nextStepIcon}>{'G'}</span>
                      <strong>{t('integrations.next_step_chatgpt')}</strong>
                      <span>{t('integrations.next_step_chatgpt_desc')}</span>
                    </button>
                    <button
                      className={styles.nextStepCard}
                      onClick={() =>
                        document
                          .getElementById('section-api')
                          ?.scrollIntoView({ behavior: 'smooth' })
                      }
                    >
                      <span className={styles.nextStepIcon}>{'{ }'}</span>
                      <strong>{t('integrations.next_step_api')}</strong>
                      <span>{t('integrations.next_step_api_desc')}</span>
                    </button>
                  </div>
                </div>
              </>
            )}
            {connectKeys.length === 0 && (
              <p className={styles.setupHint}>{t('integrations.no_keys_yet')}</p>
            )}

            {/* Scope selection */}
            <div className={styles.scopeSelector}>
              <p className={styles.scopeLabel}>{t('integrations.scope_label')}</p>
              <div className={styles.scopeOptions}>
                <button
                  className={`${styles.scopeOption} ${keyScope === 'readonly' ? styles.scopeActive : ''}`}
                  onClick={() => setKeyScope('readonly')}
                >
                  <strong>{t('integrations.read_only')}</strong>
                  <span>{t('integrations.scope_read_desc')}</span>
                </button>
                <button
                  className={`${styles.scopeOption} ${keyScope === 'readwrite' ? styles.scopeActive : ''}`}
                  onClick={() => setKeyScope('readwrite')}
                >
                  <strong>{t('integrations.read_write')}</strong>
                  <span>{t('integrations.scope_write_desc')}</span>
                </button>
              </div>
            </div>

            <button
              className={styles.primaryButton}
              onClick={handleCreateKey}
              disabled={isCreatingKey}
            >
              {isCreatingKey ? t('common.loading') : t('integrations.create_new_key')}
            </button>
          </div>
        )}
      </section>

      {/* ── Step 2: MCP (Primary) ── */}
      {(showStep2 || connectKeys.length > 0) && (
        <section id="step2" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{t('integrations.mcp_title')}</h2>
            <span className={styles.badge}>{t('integrations.recommended')}</span>
          </div>
          <p className={styles.cardDesc}>{t('integrations.mcp_desc')}</p>

          {/* Tab bar */}
          <div className={styles.tabBar}>
            {mcpTabs.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.tab} ${mcpTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => setMcpTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={styles.tabContent}>
            <p className={styles.stepText}>{mcpPaths[mcpTab]}</p>
            <CodeBlock
              code={mcpConfig}
              copyKey={`mcp-${mcpTab}`}
              copiedKey={copiedKey}
              onCopy={handleCopy}
              label={`MCP config for ${mcpTab}`}
            />
            {activeKey && (
              <p className={styles.keyFilledHint}>
                {t('integrations.your_key')} {activeKey.slice(0, 16)}...
              </p>
            )}
          </div>

          <p className={styles.stepText} style={{ marginTop: 16 }}>
            {t('integrations.mcp_restart')}
          </p>

          {/* Available tools */}
          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>{t('integrations.mcp_tools_title')}</h3>
            <div className={styles.commandList}>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>get_user_context</code>
                <span>{t('integrations.tool_get_context')}</span>
              </div>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>search_memory</code>
                <span>{t('integrations.tool_search')}</span>
              </div>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>write_memory</code>
                <span>{t('integrations.tool_write')}</span>
              </div>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>write_memory_batch</code>
                <span>{t('integrations.tool_batch')}</span>
              </div>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>upsert_entity</code>
                <span>{t('integrations.tool_entity')}</span>
              </div>
              <div className={styles.commandItem}>
                <code className={styles.commandCode}>get_project_context</code>
                <span>{t('integrations.tool_project')}</span>
              </div>
            </div>
          </div>

          <p className={styles.npmHint}>
            npm:{' '}
            <a href="https://www.npmjs.com/package/onebrain-mcp" target="_blank" rel="noopener">
              onebrain-mcp
            </a>
          </p>
        </section>
      )}

      {/* ── Universal Bookmarklet ── */}
      {(showStep2 || connectKeys.length > 0) && (
        <section id="section-bookmarklet" className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{t('integrations.bookmarklet_title')}</h2>
            <span className={styles.badgeNew}>{t('integrations.badge_new')}</span>
            <span className={styles.badgeSecondary}>{t('integrations.read_only')}</span>
          </div>
          <p className={styles.cardDesc}>{t('integrations.bookmarklet_desc')}</p>

          {/* Drag-to-bookmarks-bar */}
          <div className={styles.bookmarkletDrag}>
            <p className={styles.bookmarkletDragHint}>{t('integrations.bookmarklet_drag_hint')}</p>
            <div ref={bookmarkletContainerRef} />
          </div>

          {/* Setup steps */}
          <ol className={styles.steps}>
            <li className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>{t('integrations.bookmarklet_step1')}</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>{t('integrations.bookmarklet_step2')}</p>
              </div>
            </li>
            <li className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <div className={styles.stepContent}>
                <p className={styles.stepText}>{t('integrations.bookmarklet_step3')}</p>
              </div>
            </li>
          </ol>

          {/* Supported platforms */}
          <div className={styles.infoBox}>
            <h3 className={styles.infoTitle}>{t('integrations.bookmarklet_platforms_title')}</h3>
            <div className={styles.platformGrid}>
              {BOOKMARKLET_PLATFORMS.map((name) => (
                <span key={name} className={styles.platformChip}>
                  {name}
                </span>
              ))}
            </div>
          </div>

          <p className={styles.bookmarkletNote}>{t('integrations.bookmarklet_note')}</p>
        </section>
      )}

      {/* ── ChatGPT ── */}
      {(showStep2 || connectKeys.length > 0) && (
        <>
          <section id="section-chatgpt" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{t('integrations.platform_chatgpt_title')}</h2>
              <span className={styles.badgeSecondary}>{t('integrations.read_write')}</span>
            </div>
            <p className={styles.cardDesc}>{t('integrations.platform_chatgpt_desc')}</p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_chatgpt_step1')}</p>
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_chatgpt_step2')}</p>
                  <CodeBlock
                    code={`${apiBase}/.well-known/openapi-actions.json`}
                    copyKey="chatgpt-actions"
                    copiedKey={copiedKey}
                    onCopy={handleCopy}
                    label="ChatGPT Actions URL"
                  />
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>3</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_chatgpt_step3')}</p>
                </div>
              </li>
            </ol>
          </section>

          {/* ── Gemini ── */}
          <section className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{t('integrations.platform_gemini_title')}</h2>
              <span className={styles.badgeSecondary}>{t('integrations.read_only')}</span>
            </div>
            <p className={styles.cardDesc}>{t('integrations.platform_gemini_desc')}</p>
            <ol className={styles.steps}>
              <li className={styles.step}>
                <span className={styles.stepNumber}>1</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_gemini_step1')}</p>
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>2</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_gemini_step2')}</p>
                  <CodeBlock
                    code={`curl -s ${apiBase}/v1/connect \\\n  -H "Authorization: ApiKey ${activeKey || 'YOUR_API_KEY'}"`}
                    copyKey="gemini-curl"
                    copiedKey={copiedKey}
                    onCopy={handleCopy}
                    label="Gemini Connect curl"
                  />
                </div>
              </li>
              <li className={styles.step}>
                <span className={styles.stepNumber}>3</span>
                <div className={styles.stepContent}>
                  <p className={styles.stepText}>{t('integrations.platform_gemini_step3')}</p>
                </div>
              </li>
            </ol>
          </section>

          {/* ── REST API / Agents ── */}
          <section id="section-api" className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{t('integrations.platform_agents_title')}</h2>
              <span className={styles.badgeSecondary}>{t('integrations.read_write')}</span>
            </div>
            <p className={styles.cardDesc}>{t('integrations.api_section_desc')}</p>

            <div className={styles.promptWrapper}>
              <pre className={styles.promptBlock}>
                {`# OneBrain REST API — Quick Reference\n# Base URL: ${apiBase}\n# Auth Header: Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}\n\n# ── 1. Read your brain context ──\ncurl -s ${apiBase}/v1/connect \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}"\n\n# ── 2. Search memories ──\ncurl -s "${apiBase}/v1/connect/search?q=TypeScript" \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}"\n\n# ── 3. Write a memory ──\ncurl -s -X POST ${apiBase}/v1/connect/memories \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"type":"fact","title":"Likes TypeScript","body":"Prefers TS over JS"}]'\n\n# ── 4. Write batch memories ──\ncurl -s -X POST ${apiBase}/v1/connect/memories \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"type":"preference","title":"Dark mode","body":"Prefers dark themes"},\n      {"type":"skill","title":"React","body":"Advanced React developer"}]'`}
              </pre>
              <button
                className={`${styles.promptBlockCopy} ${copiedKey === 'api-prompt' ? styles.copyButtonCopied : ''}`}
                onClick={() =>
                  handleCopy(
                    'api-prompt',
                    `# OneBrain REST API — Quick Reference\n# Base URL: ${apiBase}\n# Auth Header: Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}\n\n# ── 1. Read your brain context ──\ncurl -s ${apiBase}/v1/connect \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}"\n\n# ── 2. Search memories ──\ncurl -s "${apiBase}/v1/connect/search?q=TypeScript" \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}"\n\n# ── 3. Write a memory ──\ncurl -s -X POST ${apiBase}/v1/connect/memories \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"type":"fact","title":"Likes TypeScript","body":"Prefers TS over JS"}]'\n\n# ── 4. Write batch memories ──\ncurl -s -X POST ${apiBase}/v1/connect/memories \\\n  -H "Authorization: ApiKey ${activeKey || 'ob_YOUR_KEY_HERE'}" \\\n  -H "Content-Type: application/json" \\\n  -d '[{"type":"preference","title":"Dark mode","body":"Prefers dark themes"},\n      {"type":"skill","title":"React","body":"Advanced React developer"}]'`,
                  )
                }
              >
                {copiedKey === 'api-prompt' ? t('integrations.copied') : t('integrations.copy_all')}
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── System Prompt Export ── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {t('integrations.system_prompt_title')}
          <InfoTooltip text={t('help.integrations_system_prompt')} />
        </h2>
        <p className={styles.cardDesc}>{t('integrations.system_prompt_desc')}</p>

        <button
          className={styles.generateButton}
          onClick={handleGeneratePrompt}
          disabled={isGenerating}
        >
          {isGenerating ? t('common.loading') : t('integrations.copy_prompt')}
        </button>

        {systemPrompt && (
          <div className={styles.promptWrapper}>
            <textarea
              className={styles.promptArea}
              value={systemPrompt}
              readOnly
              aria-label="Generated system prompt"
            />
            <button
              className={`${styles.promptCopyButton} ${copiedKey === 'prompt' ? styles.copyButtonCopied : ''}`}
              onClick={() => handleCopy('prompt', systemPrompt)}
            >
              {copiedKey === 'prompt' ? t('integrations.copied') : 'Copy'}
            </button>
          </div>
        )}
      </section>

      {/* ── Delete confirmation dialog ── */}
      {deleteTarget && (
        <div className={styles.confirmOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={styles.confirmDialog} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>{t('integrations.delete_confirm_title')}</h3>
            <p className={styles.confirmText}>
              {t('integrations.delete_confirm_text')}{' '}
              <span className={styles.confirmKeyName}>{deleteTarget.name}</span> (
              {deleteTarget.prefix}_***)?
            </p>
            <div className={styles.confirmActions}>
              <button className={styles.confirmCancel} onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button
                className={styles.confirmDelete}
                onClick={handleDeleteKey}
                disabled={isDeleting}
              >
                {isDeleting ? t('common.loading') : t('integrations.delete_confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
