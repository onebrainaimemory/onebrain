'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { formatDate as formatDateLocale } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './ingest.module.css';

type MemoryType = 'fact' | 'preference' | 'decision' | 'goal' | 'experience' | 'skill';

const MEMORY_TYPES: MemoryType[] = [
  'fact',
  'preference',
  'decision',
  'goal',
  'experience',
  'skill',
];

const TYPE_COLORS: Record<MemoryType, string> = {
  fact: '#3b82f6',
  preference: '#8b5cf6',
  decision: '#f59e0b',
  goal: '#10b981',
  experience: '#ef4444',
  skill: '#06b6d4',
};

interface MemoryItem {
  id: string;
  title: string;
  body: string;
  type: MemoryType;
  status: string;
  confidence: number;
  sourceType: string;
  createdAt: string;
}

interface MemoryCard {
  id: string;
  title: string;
  body: string;
  type: MemoryType;
  isIncluded: boolean;
}

interface Toast {
  message: string;
  variant: 'success' | 'error';
}

function generateCardId(): string {
  return `card_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function extractFirstSentence(text: string): string {
  const trimmed = text.trim();
  const firstLine = trimmed.split('\n')[0] ?? '';
  const cleaned = firstLine.replace(/^[-*>#\d.)\]]+\s*/, '').trim();
  if (cleaned.length <= 60) {
    return cleaned;
  }
  return cleaned.slice(0, 57) + '...';
}

function splitTextIntoSegments(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const paragraphs = trimmed.split(/\n{2,}/);
  const segments: string[] = [];

  for (const paragraph of paragraphs) {
    const cleaned = paragraph.trim();
    if (cleaned.length > 0) {
      segments.push(cleaned);
    }
  }

  if (segments.length === 0) {
    segments.push(trimmed);
  }

  return segments;
}

function formatDate(dateString: string, locale: string): string {
  return formatDateLocale(dateString, locale, {
    month: 'short',
    day: 'numeric',
  });
}

function KnowledgeOverviewSection({
  t,
  locale,
  memories,
  isLoading,
}: {
  t: (key: string) => string;
  locale: string;
  memories: MemoryItem[];
  isLoading: boolean;
}) {
  const typeCounts: Record<MemoryType, number> = {
    fact: 0,
    preference: 0,
    decision: 0,
    goal: 0,
    experience: 0,
    skill: 0,
  };

  for (const memory of memories) {
    if (typeCounts[memory.type] !== undefined) {
      typeCounts[memory.type]++;
    }
  }

  const totalCount = memories.length;
  const recentMemories = memories.slice(0, 5);

  if (isLoading) {
    return (
      <section className={styles.overviewSection}>
        <h2 className={styles.sectionTitle}>
          {t('ingest.knowledge_overview')}
          <InfoTooltip text={t('help.ingest_knowledge_overview')} />
        </h2>
        <p className={styles.loading}>{t('common.loading')}</p>
      </section>
    );
  }

  return (
    <section className={styles.overviewSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest.knowledge_overview')}
        <InfoTooltip text={t('help.ingest_knowledge_overview')} />
      </h2>

      <div className={styles.statsGrid}>
        {MEMORY_TYPES.map((memoryType) => (
          <div key={memoryType} className={styles.statItem}>
            <span className={styles.statCount}>{typeCounts[memoryType]}</span>
            <span className={styles.statLabel}>{t(`memory.types.${memoryType}`)}</span>
          </div>
        ))}
      </div>

      {totalCount > 0 && (
        <>
          <p className={styles.subsectionTitle}>
            {totalCount} {t('ingest.by_type')}
          </p>
          <div className={styles.typeBar}>
            {MEMORY_TYPES.map((memoryType) => {
              const count = typeCounts[memoryType];
              if (count === 0) {
                return null;
              }
              const widthPercent = (count / totalCount) * 100;
              return (
                <div
                  key={memoryType}
                  className={styles.typeBarSegment}
                  style={{
                    width: `${widthPercent}%`,
                    backgroundColor: TYPE_COLORS[memoryType],
                  }}
                  title={`${t(`memory.types.${memoryType}`)}: ${count}`}
                />
              );
            })}
          </div>
          <div className={styles.typeLegend}>
            {MEMORY_TYPES.map((memoryType) => {
              if (typeCounts[memoryType] === 0) {
                return null;
              }
              return (
                <span key={memoryType} className={styles.legendItem}>
                  <span
                    className={styles.legendDot}
                    style={{
                      backgroundColor: TYPE_COLORS[memoryType],
                    }}
                  />
                  {t(`memory.types.${memoryType}`)} ({typeCounts[memoryType]})
                </span>
              );
            })}
          </div>
        </>
      )}

      {recentMemories.length > 0 && (
        <>
          <p className={styles.subsectionTitle}>{t('ingest.recent_activity')}</p>
          <ul className={styles.recentList}>
            {recentMemories.map((memory) => (
              <li key={memory.id} className={styles.recentItem}>
                <span className={styles.recentTitle}>{memory.title}</span>
                <span className={styles.recentType}>{t(`memory.types.${memory.type}`)}</span>
                <span className={styles.recentDate}>{formatDate(memory.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function CandidateReviewSection({
  t,
  locale,
  candidates,
  isLoading,
  onApprove,
  onDismiss,
}: {
  t: (key: string) => string;
  locale: string;
  candidates: MemoryItem[];
  isLoading: boolean;
  onApprove: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  function handleApprove(memoryId: string) {
    setProcessingIds((prev) => new Set(prev).add(memoryId));
    onApprove(memoryId);
  }

  function handleDismiss(memoryId: string) {
    setProcessingIds((prev) => new Set(prev).add(memoryId));
    onDismiss(memoryId);
  }

  if (isLoading) {
    return (
      <section className={styles.candidateSection}>
        <h2 className={styles.sectionTitle}>
          {t('ingest.candidates_title')}
          <InfoTooltip text={t('help.ingest_candidates')} />
        </h2>
        <p className={styles.loading}>{t('common.loading')}</p>
      </section>
    );
  }

  return (
    <section className={styles.candidateSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest.candidates_title')}
        <InfoTooltip text={t('help.ingest_candidates')} />
      </h2>
      <p className={styles.candidateDesc}>{t('ingest.candidates_desc')}</p>

      {candidates.length === 0 ? (
        <p className={styles.emptyCandidates}>{t('ingest.no_candidates')}</p>
      ) : (
        <div className={styles.candidateList}>
          {candidates.map((candidate) => {
            const isProcessing = processingIds.has(candidate.id);
            const confidencePercent = Math.round((candidate.confidence ?? 0.5) * 100);

            return (
              <div key={candidate.id} className={styles.candidateCard}>
                <div className={styles.candidateHeader}>
                  <span className={styles.candidateTitle}>{candidate.title}</span>
                  <div className={styles.candidateMeta}>
                    <span className={styles.candidateTypeBadge}>
                      {t(`memory.types.${candidate.type}`)}
                    </span>
                    <span className={styles.candidateSourceBadge}>
                      {candidate.sourceType === 'ai_extraction'
                        ? t('ingest.source_ai')
                        : t('ingest.source_user')}
                    </span>
                  </div>
                </div>
                <p className={styles.candidateBody}>{candidate.body}</p>
                <div className={styles.candidateFooter}>
                  <div className={styles.candidateInfo}>
                    <div className={styles.confidenceBar}>
                      <span>
                        {t('ingest.confidence')}: {confidencePercent}%
                      </span>
                      <div className={styles.confidenceTrack}>
                        <div
                          className={styles.confidenceFill}
                          style={{
                            width: `${confidencePercent}%`,
                          }}
                        />
                      </div>
                    </div>
                    <span>{formatDate(candidate.createdAt, locale)}</span>
                  </div>
                  <div className={styles.candidateActions}>
                    <button
                      type="button"
                      className={styles.approveButton}
                      disabled={isProcessing}
                      onClick={() => handleApprove(candidate.id)}
                    >
                      {t('ingest.approve')}
                    </button>
                    <button
                      type="button"
                      className={styles.dismissButton}
                      disabled={isProcessing}
                      onClick={() => handleDismiss(candidate.id)}
                    >
                      {t('ingest.dismiss')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function QuickAddSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState<MemoryType>('fact');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const isValid = title.trim().length > 0 && body.trim().length > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await apiClient.post('/v1/memory', {
        type,
        title: title.trim(),
        body: body.trim(),
        sourceType: 'user_input',
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      setTitle('');
      setBody('');
      setType('fact');
      onSuccess(t('ingest.quick_add_success'));
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.quickAddSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest.manual_title')}
        <InfoTooltip text={t('help.ingest_manual')} />
      </h2>
      <form className={styles.quickAddForm} onSubmit={handleSubmit}>
        <div className={styles.quickAddRow}>
          <input
            className={styles.inputTitle}
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('ingest.title_placeholder')}
            maxLength={200}
          />
          <select
            className={styles.selectType}
            value={type}
            onChange={(event) => setType(event.target.value as MemoryType)}
          >
            {MEMORY_TYPES.map((memoryType) => (
              <option key={memoryType} value={memoryType}>
                {t(`memory.types.${memoryType}`)}
              </option>
            ))}
          </select>
        </div>
        <textarea
          className={styles.quickAddBody}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t('ingest.manual_placeholder')}
          rows={3}
        />
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.quickAddActions}>
          <button type="submit" className={styles.addButton} disabled={!isValid || isSaving}>
            {isSaving ? t('ingest.saving') : t('ingest.add_button')}
          </button>
        </div>
      </form>
    </section>
  );
}

function MemoryCardItem({
  card,
  t,
  onUpdate,
  onRemove,
}: {
  card: MemoryCard;
  t: (key: string) => string;
  onUpdate: (id: string, updates: Partial<MemoryCard>) => void;
  onRemove: (id: string) => void;
}) {
  const cardClass = card.isIncluded
    ? styles.memoryCard
    : `${styles.memoryCard} ${styles.memoryCardExcluded}`;

  return (
    <div className={cardClass}>
      <div className={styles.cardTopRow}>
        <input
          type="checkbox"
          className={styles.cardCheckbox}
          checked={card.isIncluded}
          onChange={(event) => onUpdate(card.id, { isIncluded: event.target.checked })}
          title={t('ingest.include')}
        />
        <input
          className={styles.cardTitleInput}
          type="text"
          value={card.title}
          onChange={(event) => onUpdate(card.id, { title: event.target.value })}
          placeholder={t('ingest.title_placeholder')}
          maxLength={200}
        />
        <select
          className={styles.cardTypeSelect}
          value={card.type}
          onChange={(event) =>
            onUpdate(card.id, {
              type: event.target.value as MemoryType,
            })
          }
        >
          {MEMORY_TYPES.map((memoryType) => (
            <option key={memoryType} value={memoryType}>
              {t(`memory.types.${memoryType}`)}
            </option>
          ))}
        </select>
        <button type="button" className={styles.removeButton} onClick={() => onRemove(card.id)}>
          {t('ingest.remove_card')}
        </button>
      </div>
      <textarea
        className={styles.cardBody}
        value={card.body}
        onChange={(event) => onUpdate(card.id, { body: event.target.value })}
        placeholder={t('ingest.body_placeholder')}
        rows={3}
      />
    </div>
  );
}

function BulkImportSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [rawText, setRawText] = useState('');
  const [cards, setCards] = useState<MemoryCard[]>([]);
  const [isSegmented, setIsSegmented] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  const selectedCards = cards.filter((card) => card.isIncluded);
  const selectedCount = selectedCards.length;

  function handleSegment() {
    setWarning('');
    setError('');

    if (!rawText.trim()) {
      setWarning(t('ingest.empty_text_warning'));
      return;
    }

    const segments = splitTextIntoSegments(rawText);
    const newCards: MemoryCard[] = segments.map((segment) => ({
      id: generateCardId(),
      title: extractFirstSentence(segment),
      body: segment,
      type: 'fact' as MemoryType,
      isIncluded: true,
    }));

    setCards(newCards);
    setIsSegmented(true);
  }

  const handleUpdateCard = useCallback((cardId: string, updates: Partial<MemoryCard>) => {
    setCards((prev) => prev.map((card) => (card.id === cardId ? { ...card, ...updates } : card)));
  }, []);

  const handleRemoveCard = useCallback((cardId: string) => {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  }, []);

  function handleAddEmptyCard() {
    const newCard: MemoryCard = {
      id: generateCardId(),
      title: '',
      body: '',
      type: 'fact',
      isIncluded: true,
    };
    setCards((prev) => [...prev, newCard]);
  }

  function handleSelectAll() {
    setCards((prev) => prev.map((card) => ({ ...card, isIncluded: true })));
  }

  function handleDeselectAll() {
    setCards((prev) => prev.map((card) => ({ ...card, isIncluded: false })));
  }

  async function handleSaveSelected() {
    if (selectedCount === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setError('');

    let savedCount = 0;
    const errors: string[] = [];

    for (const card of selectedCards) {
      if (!card.title.trim() || !card.body.trim()) {
        continue;
      }

      try {
        const response = await apiClient.post('/v1/memory', {
          type: card.type,
          title: card.title.trim(),
          body: card.body.trim(),
          sourceType: 'user_input',
        });

        if (response.error) {
          errors.push(response.error.message);
        } else {
          savedCount++;
        }
      } catch {
        errors.push(t('common.error'));
      }
    }

    setIsSaving(false);

    if (savedCount > 0) {
      const message = t('ingest.saved_count').replace('{count}', String(savedCount));
      onSuccess(message);

      const savedIds = new Set(
        selectedCards
          .filter((card) => card.title.trim().length > 0 && card.body.trim().length > 0)
          .map((card) => card.id),
      );
      setCards((prev) => prev.filter((card) => !savedIds.has(card.id)));
    }

    if (errors.length > 0) {
      setError(errors[0] ?? t('common.error'));
    }

    if (savedCount > 0 && cards.length === selectedCards.length) {
      setRawText('');
      setIsSegmented(false);
      setCards([]);
    }
  }

  return (
    <section className={styles.bulkSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest.bulk_title')}
        <InfoTooltip text={t('help.ingest_bulk')} />
      </h2>
      <p className={styles.subtitle}>{t('ingest.bulk_subtitle')}</p>

      <textarea
        className={styles.bulkTextarea}
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
        placeholder={t('ingest.paste_placeholder')}
        rows={8}
      />

      {warning && <p className={styles.warning}>{warning}</p>}

      <div className={styles.bulkActions}>
        <button
          type="button"
          className={styles.bulkButton}
          onClick={handleSegment}
          disabled={!rawText.trim()}
        >
          {t('ingest.add_as_memories')}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isSegmented && cards.length > 0 && (
        <>
          <div className={styles.cardsHeader}>
            <span className={styles.cardsTitle}>
              {t('ingest.results_title')} ({cards.length})
            </span>
            <div className={styles.cardsToolbar}>
              <button type="button" className={styles.toolbarButton} onClick={handleSelectAll}>
                {t('ingest.select_all')}
              </button>
              <button type="button" className={styles.toolbarButton} onClick={handleDeselectAll}>
                {t('ingest.deselect_all')}
              </button>
            </div>
          </div>

          <div className={styles.cardsList}>
            {cards.map((card) => (
              <MemoryCardItem
                key={card.id}
                card={card}
                t={t}
                onUpdate={handleUpdateCard}
                onRemove={handleRemoveCard}
              />
            ))}
          </div>

          <button type="button" className={styles.addCardButton} onClick={handleAddEmptyCard}>
            <span className={styles.addCardIcon}>+</span>
            {t('ingest.add_card')}
          </button>

          <div className={styles.saveBar}>
            <span className={styles.selectedCount}>
              {selectedCount} / {cards.length} {t('ingest.save_selected').toLowerCase()}
            </span>
            <button
              type="button"
              className={styles.saveButton}
              disabled={selectedCount === 0 || isSaving}
              onClick={handleSaveSelected}
            >
              {isSaving ? t('ingest.saving') : t('ingest.save_selected')}
            </button>
          </div>
        </>
      )}

      {isSegmented && cards.length === 0 && (
        <p className={styles.emptyCards}>{t('ingest.no_cards')}</p>
      )}
    </section>
  );
}

interface CandidateItem {
  title: string;
  body: string;
  type: string;
  confidence: number;
  isSelected?: boolean;
}

function CandidateSaveBar({
  t,
  candidates,
  onToggle,
  onSave,
  isSaving,
}: {
  t: (key: string) => string;
  candidates: CandidateItem[];
  onToggle: (index: number) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const selectedCount = candidates.filter((c) => c.isSelected).length;

  if (candidates.length === 0) return null;

  return (
    <div className={styles.candidateList}>
      <p className={styles.subsectionTitle}>
        {t('ingest_advanced.candidates_found').replace('{count}', String(candidates.length))}
      </p>
      {candidates.map((candidate, index) => (
        <div key={index} className={styles.candidateCard}>
          <div className={styles.candidateHeader}>
            <label className={styles.candidateCheckLabel}>
              <input
                type="checkbox"
                checked={candidate.isSelected !== false}
                onChange={() => onToggle(index)}
              />
              <span className={styles.candidateTitle}>{candidate.title}</span>
            </label>
            <span className={styles.candidateTypeBadge}>{candidate.type}</span>
          </div>
          <p className={styles.candidateBody}>
            {candidate.body.length > 200 ? candidate.body.slice(0, 200) + '...' : candidate.body}
          </p>
        </div>
      ))}
      <div className={styles.saveBar}>
        <span className={styles.selectedCount}>
          {selectedCount} / {candidates.length}
        </span>
        <button
          type="button"
          className={styles.saveButton}
          disabled={selectedCount === 0 || isSaving}
          onClick={onSave}
        >
          {isSaving ? t('ingest.saving') : t('ingest_advanced.save_candidates')}
        </button>
      </div>
    </div>
  );
}

function AiExtractSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [text, setText] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleExtract() {
    if (!text.trim() || isExtracting) return;

    setIsExtracting(true);
    setError('');
    setCandidates([]);

    try {
      const response = await apiClient.post<{
        memories: CandidateItem[];
        provider: string;
      }>('/v1/memory/ai-extract', { text });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      const result =
        (
          response.data as unknown as {
            data: { memories: CandidateItem[] };
          }
        ).data ?? response.data;

      const items = (result?.memories ?? []).map((m) => ({
        ...m,
        isSelected: true,
      }));
      setCandidates(items);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsExtracting(false);
    }
  }

  function handleToggle(index: number) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c)),
    );
  }

  async function handleSave() {
    const selected = candidates.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      const items = selected.map((c) => ({
        title: c.title,
        body: c.body,
        type: c.type || 'fact',
      }));

      await apiClient.post('/v1/memory/import', { items });
      onSuccess(t('ingest_advanced.ai_results').replace('{count}', String(selected.length)));
      setCandidates([]);
      setText('');
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.bulkSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest_advanced.ai_extract')}
        <InfoTooltip text={t('help.ingest_ai_extract')} />
      </h2>
      <p className={styles.subtitle}>{t('ingest_advanced.ai_extract_desc')}</p>

      <textarea
        className={styles.bulkTextarea}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={t('ingest.paste_placeholder')}
        rows={6}
      />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.bulkActions}>
        <button
          type="button"
          className={styles.bulkButton}
          onClick={handleExtract}
          disabled={!text.trim() || isExtracting}
        >
          {isExtracting ? t('ingest_advanced.ai_extracting') : t('ingest_advanced.ai_extract')}
        </button>
      </div>

      <CandidateSaveBar
        t={t}
        candidates={candidates}
        onToggle={handleToggle}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </section>
  );
}

function FileUploadSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    const allowedExts = ['txt', 'csv', 'json'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExts.includes(ext)) {
      setError(t('ingest_advanced.upload_formats'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(t('ingest_advanced.upload_formats'));
      return;
    }

    setIsUploading(true);
    setError('');
    setCandidates([]);

    try {
      const text = await file.text();
      let items: CandidateItem[] = [];

      if (ext === 'json') {
        const parsed = JSON.parse(text);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        items = arr
          .filter((item: Record<string, unknown>) => item['title'] || item['body'])
          .map((item: Record<string, unknown>) => ({
            title: String(item['title'] ?? '').slice(0, 500),
            body: String(item['body'] ?? item['content'] ?? '').slice(0, 10000),
            type: String(item['type'] ?? 'fact'),
            confidence: 0.8,
            isSelected: true,
          }));
      } else if (ext === 'csv') {
        const lines = text.split('\n').filter((l: string) => l.trim());
        if (lines.length > 1) {
          const headers = lines[0]!
            .split(',')
            .map((h: string) => h.trim().toLowerCase().replace(/"/g, ''));
          const titleIdx = headers.indexOf('title');
          const bodyIdx = headers.indexOf('body');
          const contentIdx = headers.indexOf('content');
          const typeIdx = headers.indexOf('type');

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i]!.split(',').map((c: string) => c.trim().replace(/^"|"$/g, ''));
            const body = cols[bodyIdx] ?? cols[contentIdx] ?? '';
            if (body.trim()) {
              items.push({
                title: (cols[titleIdx] ?? body.slice(0, 100)).slice(0, 500),
                body: body.slice(0, 10000),
                type: cols[typeIdx] ?? 'fact',
                confidence: 0.8,
                isSelected: true,
              });
            }
          }
        }
      } else {
        const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim().length > 20);
        items = paragraphs.slice(0, 100).map((p: string) => ({
          title: p.trim().split('\n')[0]?.slice(0, 100) ?? '',
          body: p.trim().slice(0, 10000),
          type: 'fact',
          confidence: 0.6,
          isSelected: true,
        }));
      }

      setCandidates(items);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault();
    setIsDragOver(false);
    const file = event.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleToggle(index: number) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c)),
    );
  }

  async function handleSave() {
    const selected = candidates.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      await apiClient.post('/v1/memory/import', {
        items: selected.map((c) => ({
          title: c.title,
          body: c.body,
          type: c.type || 'fact',
        })),
      });
      onSuccess(t('ingest_advanced.upload_success').replace('{count}', String(selected.length)));
      setCandidates([]);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.bulkSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest_advanced.upload_title')}
        <InfoTooltip text={t('help.ingest_upload')} />
      </h2>
      <p className={styles.subtitle}>{t('ingest_advanced.upload_desc')}</p>

      <div
        className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <p className={styles.dropZoneText}>
          {isUploading ? t('common.loading') : t('ingest_advanced.upload_drop')}
        </p>
        <p className={styles.dropZoneFormats}>{t('ingest_advanced.upload_formats')}</p>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <CandidateSaveBar
        t={t}
        candidates={candidates}
        onToggle={handleToggle}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </section>
  );
}

function UrlIngestSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleFetch() {
    if (!url.trim() || isFetching) return;

    setIsFetching(true);
    setError('');
    setCandidates([]);

    try {
      const response = await apiClient.post<{
        candidates: CandidateItem[];
      }>('/v1/memory/ingest-url', { url: url.trim() });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      const result =
        (
          response.data as unknown as {
            data: { candidates: CandidateItem[] };
          }
        ).data ?? response.data;

      const items = (result?.candidates ?? []).map((c) => ({
        ...c,
        isSelected: true,
      }));
      setCandidates(items);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsFetching(false);
    }
  }

  function handleToggle(index: number) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c)),
    );
  }

  async function handleSave() {
    const selected = candidates.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      await apiClient.post('/v1/memory/import', {
        items: selected.map((c) => ({
          title: c.title,
          body: c.body,
          type: c.type || 'fact',
        })),
      });
      onSuccess(t('ingest_advanced.url_success').replace('{count}', String(selected.length)));
      setCandidates([]);
      setUrl('');
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.bulkSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest_advanced.url_title')}
        <InfoTooltip text={t('help.ingest_url')} />
      </h2>

      <div className={styles.quickAddRow}>
        <input
          type="url"
          className={styles.inputTitle}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder={t('ingest_advanced.url_placeholder')}
        />
        <button
          type="button"
          className={styles.bulkButton}
          onClick={handleFetch}
          disabled={!url.trim() || isFetching}
        >
          {isFetching ? t('ingest_advanced.url_fetching') : t('ingest_advanced.url_button')}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <CandidateSaveBar
        t={t}
        candidates={candidates}
        onToggle={handleToggle}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </section>
  );
}

function ChatParseSection({
  t,
  onSuccess,
}: {
  t: (key: string) => string;
  onSuccess: (message: string) => void;
}) {
  const [transcript, setTranscript] = useState('');
  const [format, setFormat] = useState('auto');
  const [isParsing, setIsParsing] = useState(false);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleParse() {
    if (!transcript.trim() || isParsing) return;

    setIsParsing(true);
    setError('');
    setCandidates([]);

    try {
      const response = await apiClient.post<{
        candidates: CandidateItem[];
      }>('/v1/memory/parse-chat', {
        transcript: transcript.trim(),
        format,
      });

      if (response.error) {
        setError(response.error.message);
        return;
      }

      const result =
        (
          response.data as unknown as {
            data: { candidates: CandidateItem[] };
          }
        ).data ?? response.data;

      const items = (result?.candidates ?? []).map((c) => ({
        ...c,
        isSelected: true,
      }));
      setCandidates(items);
    } catch {
      setError(t('common.error'));
    } finally {
      setIsParsing(false);
    }
  }

  function handleToggle(index: number) {
    setCandidates((prev) =>
      prev.map((c, i) => (i === index ? { ...c, isSelected: !c.isSelected } : c)),
    );
  }

  async function handleSave() {
    const selected = candidates.filter((c) => c.isSelected);
    if (selected.length === 0) return;

    setIsSaving(true);
    try {
      await apiClient.post('/v1/memory/import', {
        items: selected.map((c) => ({
          title: c.title,
          body: c.body,
          type: c.type || 'fact',
        })),
      });
      onSuccess(t('ingest_advanced.chat_success').replace('{count}', String(selected.length)));
      setCandidates([]);
      setTranscript('');
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className={styles.bulkSection}>
      <h2 className={styles.sectionTitle}>
        {t('ingest_advanced.chat_title')}
        <InfoTooltip text={t('help.ingest_chat')} />
      </h2>
      <p className={styles.subtitle}>{t('ingest_advanced.chat_desc')}</p>

      <div className={styles.quickAddRow}>
        <select
          className={styles.selectType}
          value={format}
          onChange={(event) => setFormat(event.target.value)}
        >
          <option value="auto">{t('ingest_advanced.chat_format_auto')}</option>
          <option value="user-assistant">{t('ingest_advanced.chat_format_user_assistant')}</option>
          <option value="timestamp">{t('ingest_advanced.chat_format_timestamp')}</option>
        </select>
      </div>

      <textarea
        className={styles.bulkTextarea}
        value={transcript}
        onChange={(event) => setTranscript(event.target.value)}
        placeholder={t('ingest.paste_placeholder')}
        rows={8}
      />

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.bulkActions}>
        <button
          type="button"
          className={styles.bulkButton}
          onClick={handleParse}
          disabled={!transcript.trim() || isParsing}
        >
          {isParsing ? t('ingest_advanced.chat_parsing') : t('ingest_advanced.chat_button')}
        </button>
      </div>

      <CandidateSaveBar
        t={t}
        candidates={candidates}
        onToggle={handleToggle}
        onSave={handleSave}
        isSaving={isSaving}
      />
    </section>
  );
}

export default function IngestPage() {
  const { t, locale } = useAuth();
  const [toast, setToast] = useState<Toast | null>(null);
  const [allMemories, setAllMemories] = useState<MemoryItem[]>([]);
  const [candidates, setCandidates] = useState<MemoryItem[]>([]);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(true);

  function showToast(message: string, variant: 'success' | 'error') {
    setToast({ message, variant });
    setTimeout(() => setToast(null), 4000);
  }

  function handleSuccess(message: string) {
    showToast(message, 'success');
    fetchAllMemories();
  }

  async function fetchAllMemories() {
    try {
      const res = await apiClient.get<MemoryItem[]>('/v1/memory', { limit: '100' });
      if (res.data) {
        setAllMemories(res.data);
      }
    } catch {
      // Overview stats unavailable
    } finally {
      setIsLoadingOverview(false);
    }
  }

  async function fetchCandidates() {
    try {
      const res = await apiClient.get<MemoryItem[]>('/v1/memory', {
        status: 'candidate',
        limit: '50',
      });
      if (res.data) {
        setCandidates(res.data);
      }
    } catch {
      // Candidates unavailable
    } finally {
      setIsLoadingCandidates(false);
    }
  }

  useEffect(() => {
    fetchAllMemories();
    fetchCandidates();
  }, []);

  async function handleApproveCandidate(memoryId: string) {
    try {
      const res = await apiClient.patch('/v1/memory/' + memoryId, {
        confidence: 1.0,
        status: 'active',
      });
      if (res.error) {
        showToast(res.error.message, 'error');
        return;
      }
      setCandidates((prev) => prev.filter((item) => item.id !== memoryId));
      showToast(t('ingest.approved'), 'success');
      fetchAllMemories();
    } catch {
      showToast(t('common.error'), 'error');
    }
  }

  async function handleDismissCandidate(memoryId: string) {
    try {
      const res = await apiClient.delete('/v1/memory/' + memoryId);
      if (res.error) {
        showToast(res.error.message, 'error');
        return;
      }
      setCandidates((prev) => prev.filter((item) => item.id !== memoryId));
      showToast(t('ingest.dismissed'), 'success');
    } catch {
      showToast(t('common.error'), 'error');
    }
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('ingest.title')}
        <InfoTooltip text={t('help.ingest_title')} />
      </h1>
      <p className={styles.subtitle}>{t('ingest.subtitle')}</p>

      {toast && (
        <div
          className={`${styles.toast} ${
            toast.variant === 'success' ? styles.toastSuccess : styles.toastError
          }`}
        >
          {toast.message}
        </div>
      )}

      <KnowledgeOverviewSection
        t={t}
        locale={locale}
        memories={allMemories}
        isLoading={isLoadingOverview}
      />

      <CandidateReviewSection
        t={t}
        locale={locale}
        candidates={candidates}
        isLoading={isLoadingCandidates}
        onApprove={handleApproveCandidate}
        onDismiss={handleDismissCandidate}
      />

      <QuickAddSection t={t} onSuccess={handleSuccess} />
      <BulkImportSection t={t} onSuccess={handleSuccess} />
      <AiExtractSection t={t} onSuccess={handleSuccess} />
      <FileUploadSection t={t} onSuccess={handleSuccess} />
      <UrlIngestSection t={t} onSuccess={handleSuccess} />
      <ChatParseSection t={t} onSuccess={handleSuccess} />
    </div>
  );
}
