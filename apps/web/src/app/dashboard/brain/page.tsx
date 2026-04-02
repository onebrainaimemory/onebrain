'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { MergeHistory } from './MergeHistory';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './brain.module.css';

interface KeyValuePair {
  key: string;
  value: string;
}

interface BrainProfile {
  summary: string;
  traits: Record<string, string>;
  preferences: Record<string, string>;
}

interface BrainContext {
  totalMemories: number;
  totalEntities: number;
  totalProjects: number;
}

type ContextScope = 'brief' | 'assistant' | 'project' | 'deep';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function toKeyValuePairs(record: Record<string, string>): KeyValuePair[] {
  const entries = Object.entries(record);
  if (entries.length === 0) {
    return [{ key: '', value: '' }];
  }
  return entries.map(([key, value]) => ({ key, value }));
}

function fromKeyValuePairs(pairs: KeyValuePair[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of pairs) {
    const trimmedKey = pair.key.trim();
    if (trimmedKey) {
      result[trimmedKey] = pair.value;
    }
  }
  return result;
}

export default function BrainProfilePage() {
  const { t, locale } = useAuth();

  const [summary, setSummary] = useState('');
  const [traits, setTraits] = useState<KeyValuePair[]>([{ key: '', value: '' }]);
  const [preferences, setPreferences] = useState<KeyValuePair[]>([{ key: '', value: '' }]);

  const [stats, setStats] = useState<BrainContext | null>(null);
  const [contextPreview, setContextPreview] = useState('');
  const [scope, setScope] = useState<ContextScope>('assistant');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      try {
        const [profileRes, statsRes] = await Promise.all([
          apiClient.get<BrainProfile>('/v1/brain/profile'),
          apiClient.get<BrainContext>('/v1/brain/context'),
        ]);

        if (profileRes.data) {
          setSummary(profileRes.data.summary || '');
          setTraits(toKeyValuePairs(profileRes.data.traits || {}));
          setPreferences(toKeyValuePairs(profileRes.data.preferences || {}));
        } else if (profileRes.error) {
          setLoadError(profileRes.error.message);
        }

        if (statsRes.data) {
          setStats(statsRes.data);
        }
      } catch {
        setLoadError(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    }

    fetchProfile();
  }, [t]);

  const fetchContextPreview = useCallback(
    async (selectedScope: ContextScope) => {
      setIsRefreshing(true);

      try {
        const url = `${API_BASE}/v1/context/assistant?scope=${selectedScope}`;
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'text/plain',
            'X-Requested-With': 'OneBrain',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const text = await response.text();
          setContextPreview(text);
        } else {
          setContextPreview(t('common.error'));
        }
      } catch {
        setContextPreview(t('common.error'));
      } finally {
        setIsRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    if (!isLoading) {
      fetchContextPreview(scope);
    }
  }, [isLoading, fetchContextPreview, scope]);

  async function handleSave() {
    setIsSaving(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const body: BrainProfile = {
        summary,
        traits: fromKeyValuePairs(traits),
        preferences: fromKeyValuePairs(preferences),
      };

      const response = await apiClient.put<BrainProfile>('/v1/brain/profile', body);

      if (response.error) {
        setSaveError(response.error.message);
        return;
      }

      setSaveMessage(t('brain.save_success'));
      setTimeout(() => setSaveMessage(''), 4000);
    } catch {
      setSaveError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function updateTraitKey(index: number, newKey: string) {
    setTraits((prev) => prev.map((pair, idx) => (idx === index ? { ...pair, key: newKey } : pair)));
  }

  function updateTraitValue(index: number, newValue: string) {
    setTraits((prev) =>
      prev.map((pair, idx) => (idx === index ? { ...pair, value: newValue } : pair)),
    );
  }

  function addTrait() {
    setTraits((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeTrait(index: number) {
    setTraits((prev) => {
      if (prev.length <= 1) {
        return [{ key: '', value: '' }];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }

  function updatePreferenceKey(index: number, newKey: string) {
    setPreferences((prev) =>
      prev.map((pair, idx) => (idx === index ? { ...pair, key: newKey } : pair)),
    );
  }

  function updatePreferenceValue(index: number, newValue: string) {
    setPreferences((prev) =>
      prev.map((pair, idx) => (idx === index ? { ...pair, value: newValue } : pair)),
    );
  }

  function addPreference() {
    setPreferences((prev) => [...prev, { key: '', value: '' }]);
  }

  function removePreference(index: number) {
    setPreferences((prev) => {
      if (prev.length <= 1) {
        return [{ key: '', value: '' }];
      }
      return prev.filter((_, idx) => idx !== index);
    });
  }

  function handleScopeChange(newScope: ContextScope) {
    setScope(newScope);
  }

  function handleRefresh() {
    fetchContextPreview(scope);
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.loading}>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('brain.title')}
        <InfoTooltip text={t('help.brain_title')} />
      </h1>

      {loadError && <p className={styles.error}>{loadError}</p>}

      {saveMessage && <p className={styles.success}>{saveMessage}</p>}

      {saveError && <p className={styles.error}>{saveError}</p>}

      {/* Brain Profile Form */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {t('brain.summary')}
          <InfoTooltip text={t('help.brain_summary')} />
        </h2>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="summary">
            {t('brain.summary')}
            <InfoTooltip text={t('help.brain_summary_label')} />
          </label>
          <textarea
            id="summary"
            className={styles.textarea}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t('brain.summary_placeholder')}
            rows={4}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            {t('brain.traits')}
            <InfoTooltip text={t('help.brain_traits')} />
          </label>
          <div className={styles.kvList}>
            {traits.map((pair, index) => (
              <div key={`trait-${index}`} className={styles.kvRow}>
                <input
                  className={styles.kvInput}
                  type="text"
                  value={pair.key}
                  onChange={(event) => updateTraitKey(index, event.target.value)}
                  placeholder={t('brain.traits_placeholder')}
                />
                <input
                  className={styles.kvInput}
                  type="text"
                  value={pair.value}
                  onChange={(event) => updateTraitValue(index, event.target.value)}
                  placeholder={t('brain.traits_placeholder')}
                />
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removeTrait(index)}
                  aria-label={t('common.delete')}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.addButton} onClick={addTrait}>
            + {t('brain.traits')}
          </button>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>
            {t('brain.preferences')}
            <InfoTooltip text={t('help.brain_preferences')} />
          </label>
          <div className={styles.kvList}>
            {preferences.map((pair, index) => (
              <div key={`pref-${index}`} className={styles.kvRow}>
                <input
                  className={styles.kvInput}
                  type="text"
                  value={pair.key}
                  onChange={(event) => updatePreferenceKey(index, event.target.value)}
                  placeholder={t('brain.preferences_placeholder')}
                />
                <input
                  className={styles.kvInput}
                  type="text"
                  value={pair.value}
                  onChange={(event) => updatePreferenceValue(index, event.target.value)}
                  placeholder={t('brain.preferences_placeholder')}
                />
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => removePreference(index)}
                  aria-label={t('common.delete')}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button type="button" className={styles.addButton} onClick={addPreference}>
            + {t('brain.preferences')}
          </button>
        </div>

        <button
          type="button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? t('common.loading') : t('common.save')}
        </button>
      </section>

      {/* Brain Stats */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {t('brain.stats')}
          <InfoTooltip text={t('help.brain_stats')} />
        </h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats?.totalMemories ?? 0}</span>
            <span className={styles.statLabel}>{t('brain.total_memories')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats?.totalEntities ?? 0}</span>
            <span className={styles.statLabel}>{t('brain.total_entities')}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statValue}>{stats?.totalProjects ?? 0}</span>
            <span className={styles.statLabel}>{t('brain.total_projects')}</span>
          </div>
        </div>
      </section>

      {/* Context Preview */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          {t('brain.context_preview')}
          <InfoTooltip text={t('help.brain_context_preview')} />
        </h2>
        <p className={styles.previewDesc}>{t('brain.context_preview_desc')}</p>

        <div className={styles.previewHeader}>
          <label className={styles.label} htmlFor="scope">
            {t('brain.scope')}
            <InfoTooltip text={t('help.brain_scope')} />
          </label>
          <select
            id="scope"
            className={styles.scopeSelect}
            value={scope}
            onChange={(event) => handleScopeChange(event.target.value as ContextScope)}
          >
            <option value="brief">brief</option>
            <option value="assistant">assistant</option>
            <option value="project">project</option>
            <option value="deep">deep</option>
          </select>
          <button
            type="button"
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {t('brain.refresh')}
          </button>
        </div>

        <textarea
          className={styles.previewTextarea}
          value={isRefreshing ? t('common.loading') : contextPreview}
          readOnly
          rows={12}
        />
      </section>

      {/* Merge History with Rollback */}
      <section className={styles.card}>
        <MergeHistory t={t} locale={locale} />
      </section>
    </div>
  );
}
