'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './search.module.css';

type SearchMode = 'keyword' | 'vector' | 'hybrid';

interface SearchResult {
  id: string;
  type: string;
  title: string;
  body: string;
  score: number;
  diceScore?: number;
  vectorScore?: number;
}

interface EmbeddingStatus {
  total: number;
  embedded: number;
  pending: number;
  failed: number;
}

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.slice(0, maxLength) + '...';
}

function coveragePercent(status: EmbeddingStatus): number {
  if (status.total === 0) return 0;
  return Math.round((status.embedded / status.total) * 100);
}

const TYPE_COLORS: Record<string, string> = {
  fact: '#2563eb',
  preference: '#7c3aed',
  decision: '#dc2626',
  goal: '#059669',
  experience: '#d97706',
  skill: '#0891b2',
};

export default function SearchPage() {
  const { t } = useAuth();

  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('hybrid');
  const [alpha, setAlpha] = useState(0.5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [isReindexing, setIsReindexing] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchEmbeddingStatus = useCallback(async () => {
    setIsLoadingStatus(true);
    setStatusError('');
    try {
      const response = await apiClient.get<EmbeddingStatus>('/v1/memory/embeddings/status');
      if (response.data) {
        setEmbeddingStatus(response.data);
      } else if (response.error) {
        setStatusError(response.error.message);
      }
    } catch {
      setStatusError(t('common.error'));
    } finally {
      setIsLoadingStatus(false);
    }
  }, [t]);

  useEffect(() => {
    fetchEmbeddingStatus();
  }, [fetchEmbeddingStatus]);

  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setSearchError('');
    setHasSearched(true);
    try {
      const body: Record<string, unknown> = {
        query: trimmed,
        mode,
        limit: 20,
      };
      if (mode === 'hybrid') {
        body['alpha'] = alpha;
      }

      const response = await apiClient.post<SearchResult[]>('/v1/memory/search', body);
      if (response.data) {
        setResults(response.data);
      } else if (response.error) {
        setSearchError(response.error.message);
      }
    } catch {
      setSearchError(t('common.error'));
    } finally {
      setIsSearching(false);
    }
  }, [query, mode, alpha, t]);

  const handleReindex = useCallback(async () => {
    setIsReindexing(true);
    try {
      await apiClient.post('/v1/memory/embeddings/reindex');
      await fetchEmbeddingStatus();
    } catch {
      setStatusError(t('common.error'));
    } finally {
      setIsReindexing(false);
    }
  }, [fetchEmbeddingStatus, t]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        handleSearch();
      }
    },
    [handleSearch],
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t('search.title')}
            <InfoTooltip text={t('help.search_title')} />
          </h1>
          <span className={styles.subtitle}>{t('search.subtitle')}</span>
        </div>
      </div>

      {/* Search input */}
      <div className={styles.searchBar}>
        <input
          ref={searchInputRef}
          type="text"
          className={styles.searchInput}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className={styles.searchClear}
            onClick={() => {
              setQuery('');
              searchInputRef.current?.focus();
            }}
            aria-label={t('common.clear')}
          >
            x
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className={styles.modeSelector}>
        {(['keyword', 'vector', 'hybrid'] as SearchMode[]).map((m) => (
          <button
            key={m}
            className={mode === m ? styles.modeButtonActive : styles.modeButton}
            onClick={() => setMode(m)}
          >
            {t(`search.mode.${m}`)}
          </button>
        ))}
      </div>

      {/* Alpha slider — hybrid only */}
      {mode === 'hybrid' && (
        <div className={styles.alphaRow}>
          <label className={styles.alphaLabel}>
            {t('search.alpha')}: {alpha.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            className={styles.alphaSlider}
          />
        </div>
      )}

      {/* Search button */}
      <button
        className={styles.searchButton}
        onClick={handleSearch}
        disabled={isSearching || !query.trim()}
      >
        {isSearching ? t('search.searching') : t('search.submit')}
      </button>

      {/* Error */}
      {searchError && <div className={styles.error}>{searchError}</div>}

      {/* Results */}
      {hasSearched && !isSearching && results.length === 0 && !searchError && (
        <div className={styles.empty}>{t('search.noResults')}</div>
      )}

      {results.length > 0 && (
        <ul className={styles.list}>
          {results.map((result) => (
            <li key={result.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span
                  className={styles.typeBadge}
                  style={{ background: TYPE_COLORS[result.type] || '#888' }}
                >
                  {result.type}
                </span>
                <div className={styles.scoreBar}>
                  <div
                    className={styles.scoreBarFill}
                    style={{ width: `${Math.round(result.score * 100)}%` }}
                  />
                </div>
                <span className={styles.scoreValue}>{(result.score * 100).toFixed(0)}%</span>
              </div>
              <h3 className={styles.cardTitle}>{result.title}</h3>
              <p className={styles.cardBody}>{truncateText(result.body, 120)}</p>
              {(result.diceScore !== undefined || result.vectorScore !== undefined) && (
                <div className={styles.cardFooter}>
                  {result.diceScore !== undefined && (
                    <span className={styles.scoreDetail}>
                      dice: {(result.diceScore * 100).toFixed(0)}%
                    </span>
                  )}
                  {result.vectorScore !== undefined && (
                    <span className={styles.scoreDetail}>
                      vector: {(result.vectorScore * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Embedding Status Panel */}
      <div className={styles.statusPanel}>
        <div className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>{t('search.embeddingStatus')}</h2>
          <button className={styles.reindexButton} onClick={handleReindex} disabled={isReindexing}>
            {isReindexing ? t('search.reindexing') : t('search.reindex')}
          </button>
        </div>

        {statusError && <div className={styles.error}>{statusError}</div>}

        {isLoadingStatus && <div className={styles.loading}>{t('common.loading')}</div>}

        {embeddingStatus && !isLoadingStatus && (
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={styles.statusValue}>{embeddingStatus.total}</span>
              <span className={styles.statusLabel}>{t('search.status.total')}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusValue}>{embeddingStatus.embedded}</span>
              <span className={styles.statusLabel}>{t('search.status.embedded')}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusValue}>{embeddingStatus.pending}</span>
              <span className={styles.statusLabel}>{t('search.status.pending')}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusValue}>{embeddingStatus.failed}</span>
              <span className={styles.statusLabel}>{t('search.status.failed')}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusValue}>{coveragePercent(embeddingStatus)}%</span>
              <span className={styles.statusLabel}>{t('search.status.coverage')}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
