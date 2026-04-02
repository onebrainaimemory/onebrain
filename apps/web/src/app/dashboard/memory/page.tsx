'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { Pagination } from '@/components/Pagination';
import { ConflictResolution } from './ConflictResolution';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './memory.module.css';

const MEMORY_TYPES = ['fact', 'preference', 'decision', 'goal', 'experience', 'skill'] as const;

const MEMORY_STATUSES = ['active', 'archived'] as const;

const TYPE_COLORS: Record<string, string> = {
  fact: '#2563eb',
  preference: '#7c3aed',
  decision: '#dc2626',
  goal: '#059669',
  experience: '#d97706',
  skill: '#0891b2',
};

interface MemoryItem {
  id: string;
  type: string;
  title: string;
  body: string;
  sourceType: string;
  confidence: number;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface TagItem {
  id: string;
  name: string;
  color: string;
}

interface MemoryTagItem {
  tagId: string;
  tagName: string;
  tagColor: string;
}

interface DuplicatePair {
  memoryA: MemoryItem;
  memoryB: MemoryItem;
  similarity: number;
}

type ViewMode = 'cards' | 'timeline' | 'duplicates';

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.slice(0, maxLength) + '...';
}

function formatDate(isoString: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString();
  }
}

function formatDateHeader(isoString: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoString));
  } catch {
    return new Date(isoString).toLocaleDateString();
  }
}

function groupByDate(memories: MemoryItem[], locale: string): Map<string, MemoryItem[]> {
  const groups = new Map<string, MemoryItem[]>();

  for (const memory of memories) {
    const dateKey = formatDateHeader(memory.createdAt, locale);
    const existing = groups.get(dateKey) ?? [];
    existing.push(memory);
    groups.set(dateKey, existing);
  }

  return groups;
}

type MemoryTab = 'memories' | 'conflicts';

export default function MemoryPage() {
  const { t, locale } = useAuth();

  const [activeTab, setActiveTab] = useState<MemoryTab>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const [tags, setTags] = useState<TagItem[]>([]);
  const [memoryTags, setMemoryTags] = useState<Record<string, MemoryTagItem[]>>({});
  const [tagFilter, setTagFilter] = useState('');
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#6b7280');

  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false);

  const [isImporting, setIsImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    body: '',
    type: 'fact',
  });
  const [createError, setCreateError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    body: '',
    type: '',
  });
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setSearchDebounced(searchQuery);
    }, 300);
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
    };
  }, [searchQuery]);

  const fetchMemories = useCallback(
    async (cursorParam?: string) => {
      setIsLoading(true);
      setError('');
      try {
        const params: Record<string, string> = { limit: '20' };
        if (cursorParam) params['cursor'] = cursorParam;
        if (typeFilter) params['type'] = typeFilter;
        if (statusFilter) params['status'] = statusFilter;
        if (searchDebounced) params['search'] = searchDebounced;

        const response = await apiClient.get<MemoryItem[]>('/v1/memory', params);

        if (response.data) {
          setMemories(response.data);
          setCursor(response.meta?.cursor ?? null);
          setHasMore(response.meta?.hasMore ?? false);
          setTotal(response.meta?.total ?? 0);
        } else if (response.error) {
          setError(response.error.message);
        }
      } catch {
        setError(t('common.error'));
      } finally {
        setIsLoading(false);
      }
    },
    [typeFilter, statusFilter, searchDebounced, t],
  );

  const fetchTags = useCallback(async () => {
    try {
      const response = await apiClient.get<TagItem[]>('/v1/tags');
      if (response.data) {
        const data = Array.isArray(response.data)
          ? response.data
          : ((response.data as unknown as { data: TagItem[] }).data ?? []);
        setTags(data);
      }
    } catch {
      /* tags are optional */
    }
  }, []);

  useEffect(() => {
    setCursorHistory([]);
    fetchMemories();
  }, [fetchMemories]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredMemories = useMemo(() => {
    if (!tagFilter) {
      return memories;
    }
    return memories.filter((memory) => {
      const tags = memoryTags[memory.id];
      return tags?.some((mt) => mt.tagId === tagFilter);
    });
  }, [memories, tagFilter, memoryTags]);

  function handleNext(nextCursor: string) {
    if (cursor) {
      setCursorHistory((prev) => [...prev, cursor]);
    }
    fetchMemories(nextCursor);
  }

  function handlePrevious() {
    const prev = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((h) => h.slice(0, -1));
    fetchMemories(prev);
  }

  function handleOpenCreate() {
    setIsCreating(true);
    setCreateForm({ title: '', body: '', type: 'fact' });
    setCreateError('');
  }

  function handleCancelCreate() {
    setIsCreating(false);
    setCreateForm({ title: '', body: '', type: 'fact' });
    setCreateError('');
  }

  async function handleSaveCreate() {
    if (!createForm.title.trim()) {
      setCreateError(t('memory.validation.title_required'));
      return;
    }

    setIsSaving(true);
    setCreateError('');

    try {
      const response = await apiClient.post<MemoryItem>('/v1/memory', {
        type: createForm.type,
        title: createForm.title.trim(),
        body: createForm.body.trim(),
        sourceType: 'user_input',
      });

      if (response.error) {
        setCreateError(response.error.message);
        return;
      }

      setIsCreating(false);
      setCreateForm({ title: '', body: '', type: 'fact' });
      setCursorHistory([]);
      await fetchMemories();
    } catch {
      setCreateError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleStartEdit(memory: MemoryItem) {
    setEditingId(memory.id);
    setEditForm({
      title: memory.title,
      body: memory.body,
      type: memory.type,
    });
    setEditError('');
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditForm({ title: '', body: '', type: '' });
    setEditError('');
  }

  async function handleSaveEdit(memoryId: string) {
    if (!editForm.title.trim()) {
      setEditError(t('memory.validation.title_required'));
      return;
    }

    setIsUpdating(true);
    setEditError('');

    try {
      const payload = {
        type: editForm.type,
        title: editForm.title.trim(),
        body: editForm.body.trim(),
      };

      const response = await apiClient.patch<MemoryItem>(`/v1/memory/${memoryId}`, payload);

      if (response.error) {
        setEditError(response.error.message);
        return;
      }

      setEditingId(null);
      setEditForm({ title: '', body: '', type: '' });
      setMemories((prev) =>
        prev.map((m) =>
          m.id === memoryId ? { ...m, ...payload, updatedAt: new Date().toISOString() } : m,
        ),
      );
    } catch {
      setEditError(t('common.error'));
    } finally {
      setIsUpdating(false);
    }
  }

  function handleRequestDelete(memoryId: string) {
    setDeletingId(memoryId);
  }

  function handleCancelDelete() {
    setDeletingId(null);
  }

  async function handleConfirmDelete(memoryId: string) {
    setIsDeleting(true);
    try {
      const response = await apiClient.delete(`/v1/memory/${memoryId}`);
      if (response.error) {
        setError(response.error.message);
        setDeletingId(null);
        return;
      }
      setDeletingId(null);
      setMemories((prev) => prev.filter((m) => m.id !== memoryId));
    } catch {
      setError(t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;

    try {
      const response = await apiClient.post<TagItem>('/v1/tags', {
        name: newTagName.trim(),
        color: newTagColor,
      });

      if (response.data) {
        await fetchTags();
        setNewTagName('');
        setIsCreatingTag(false);
      }
    } catch {
      /* tag creation failed */
    }
  }

  async function handleAddTag(memoryId: string, tagId: string) {
    try {
      const response = await apiClient.post<MemoryTagItem>(`/v1/memory/${memoryId}/tags`, {
        tagId,
      });

      if (response.data) {
        const tagData = (response.data as unknown as { data: MemoryTagItem }).data ?? response.data;
        setMemoryTags((prev) => ({
          ...prev,
          [memoryId]: [...(prev[memoryId] ?? []), tagData],
        }));
      }
    } catch {
      /* tag add failed */
    }
  }

  async function handleRemoveTag(memoryId: string, tagId: string) {
    try {
      await apiClient.delete(`/v1/memory/${memoryId}/tags/${tagId}`);
      setMemoryTags((prev) => ({
        ...prev,
        [memoryId]: (prev[memoryId] ?? []).filter((mt) => mt.tagId !== tagId),
      }));
    } catch {
      /* tag removal failed */
    }
  }

  async function handleFetchDuplicates() {
    setViewMode('duplicates');
    setIsLoadingDuplicates(true);
    try {
      const response = await apiClient.get<DuplicatePair[]>('/v1/memory/duplicates');
      if (response.data) {
        const data = Array.isArray(response.data)
          ? response.data
          : ((response.data as unknown as { data: DuplicatePair[] }).data ?? []);
        setDuplicates(data);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoadingDuplicates(false);
    }
  }

  async function handleDismissDuplicate(index: number) {
    setDuplicates((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImportFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setError('');

    try {
      const text = await file.text();
      const extension = file.name.split('.').pop()?.toLowerCase();
      let items: { title: string; body: string; type?: string }[] = [];

      if (extension === 'json') {
        const parsed = JSON.parse(text);
        items = Array.isArray(parsed) ? parsed : [parsed];
      } else if (extension === 'csv') {
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
            items.push({
              title: cols[titleIdx] ?? '',
              body: cols[bodyIdx] ?? cols[contentIdx] ?? '',
              type: cols[typeIdx] ?? 'fact',
            });
          }
        }
      }

      items = items.filter((item) => item.title?.trim() && item.body?.trim());

      if (items.length === 0) {
        setError('No valid items found in file.');
        return;
      }

      const response = await apiClient.post<{ created: number }>('/v1/memory/import', { items });

      if (response.error) {
        setError(response.error.message);
      } else {
        const result =
          (response.data as unknown as { data: { created: number } }).data ?? response.data;
        setError('');
        await fetchMemories();
        alert(
          t('memory.import_success').replace('{count}', String(result?.created ?? items.length)),
        );
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = '';
      }
    }
  }

  function renderTypeBadge(type: string) {
    const color = TYPE_COLORS[type] || '#555';
    return (
      <span className={styles.typeBadge} style={{ backgroundColor: color }}>
        {t(`memory.types.${type}`) || type}
      </span>
    );
  }

  function renderStatusBadge(status: string) {
    const isActive = status === 'active';
    return (
      <span className={isActive ? styles.statusBadgeActive : styles.statusBadge}>
        {t(`memory.status.${status}`) || status}
      </span>
    );
  }

  function renderTagBadges(memoryId: string) {
    const tags = memoryTags[memoryId] ?? [];
    if (tags.length === 0) return null;

    return (
      <div className={styles.tagBadges}>
        {tags.map((mt) => (
          <span
            key={mt.tagId}
            className={styles.tagBadge}
            style={{ borderColor: mt.tagColor, color: mt.tagColor }}
          >
            {mt.tagName}
            <button
              type="button"
              className={styles.tagRemoveBtn}
              onClick={(event) => {
                event.stopPropagation();
                handleRemoveTag(memoryId, mt.tagId);
              }}
              aria-label={t('memory.remove_tag')}
            >
              x
            </button>
          </span>
        ))}
      </div>
    );
  }

  function renderMemoryCard(memory: MemoryItem) {
    if (editingId === memory.id) {
      return (
        <div className={styles.editForm}>
          <label className={styles.formLabel} htmlFor={`edit-title-${memory.id}`}>
            {t('memory.field_title')}
          </label>
          <input
            id={`edit-title-${memory.id}`}
            type="text"
            className={styles.formInput}
            value={editForm.title}
            onChange={(event) => setEditForm((f) => ({ ...f, title: event.target.value }))}
            autoFocus
          />

          <label className={styles.formLabel} htmlFor={`edit-body-${memory.id}`}>
            {t('memory.field_body')}
          </label>
          <textarea
            id={`edit-body-${memory.id}`}
            className={styles.formTextarea}
            value={editForm.body}
            onChange={(event) => setEditForm((f) => ({ ...f, body: event.target.value }))}
            rows={4}
          />

          <label className={styles.formLabel} htmlFor={`edit-type-${memory.id}`}>
            {t('memory.field_type')}
          </label>
          <select
            id={`edit-type-${memory.id}`}
            className={styles.select}
            value={editForm.type}
            onChange={(event) => setEditForm((f) => ({ ...f, type: event.target.value }))}
          >
            {MEMORY_TYPES.map((memType) => (
              <option key={memType} value={memType}>
                {t(`memory.types.${memType}`)}
              </option>
            ))}
          </select>

          {editError && <p className={styles.formError}>{editError}</p>}

          <div className={styles.formActions}>
            <button
              className={styles.saveButton}
              onClick={() => handleSaveEdit(memory.id)}
              disabled={isUpdating}
            >
              {isUpdating ? t('common.saving') : t('common.save')}
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancelEdit}
              disabled={isUpdating}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className={styles.cardHeader}>
          <div className={styles.cardBadges}>
            {renderTypeBadge(memory.type)}
            {renderStatusBadge(memory.status)}
          </div>
          <div className={styles.cardActions}>
            {tags.length > 0 && (
              <select
                className={styles.tagSelect}
                onChange={(event) => {
                  if (event.target.value) {
                    handleAddTag(memory.id, event.target.value);
                    event.target.value = '';
                  }
                }}
                aria-label={t('memory.add_tag')}
              >
                <option value="">{t('memory.add_tag')}</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}
            <button
              className={styles.editButton}
              onClick={() => handleStartEdit(memory)}
              aria-label={t('common.edit')}
            >
              {t('common.edit')}
            </button>
            {deletingId === memory.id ? (
              <div className={styles.deleteConfirm}>
                <span className={styles.deletePrompt}>{t('memory.confirm_delete')}</span>
                <button
                  className={styles.deleteConfirmYes}
                  onClick={() => handleConfirmDelete(memory.id)}
                  disabled={isDeleting}
                >
                  {t('common.yes')}
                </button>
                <button
                  className={styles.deleteConfirmNo}
                  onClick={handleCancelDelete}
                  disabled={isDeleting}
                >
                  {t('common.no')}
                </button>
              </div>
            ) : (
              <button
                className={styles.deleteButton}
                onClick={() => handleRequestDelete(memory.id)}
                aria-label={t('common.delete')}
              >
                {t('common.delete')}
              </button>
            )}
          </div>
        </div>

        {renderTagBadges(memory.id)}

        <h3 className={styles.cardTitle}>{memory.title}</h3>

        {memory.body && <p className={styles.cardBody}>{truncateText(memory.body, 200)}</p>}

        <div className={styles.cardFooter}>
          <span className={styles.cardDate}>{formatDate(memory.createdAt, locale)}</span>
          {memory.sourceType && (
            <span className={styles.cardSource}>
              {t(`memory.source.${memory.sourceType}`) || memory.sourceType}
            </span>
          )}
        </div>
      </>
    );
  }

  function renderCardsView() {
    return (
      <>
        <ul className={styles.list}>
          {filteredMemories.map((memory) => (
            <li key={memory.id} className={styles.card}>
              {renderMemoryCard(memory)}
            </li>
          ))}
        </ul>

        <Pagination
          cursor={cursor}
          hasMore={hasMore}
          onNext={handleNext}
          onPrevious={handlePrevious}
          hasPrevious={cursorHistory.length > 0}
        />
      </>
    );
  }

  function renderTimelineView() {
    const dateGroups = groupByDate(filteredMemories, locale);

    if (dateGroups.size === 0) {
      return <p className={styles.empty}>{t('memory.timeline_empty')}</p>;
    }

    return (
      <div className={styles.timeline}>
        {Array.from(dateGroups.entries()).map(([dateLabel, items]) => (
          <div key={dateLabel} className={styles.timelineGroup}>
            <div className={styles.timelineDateBadge}>{dateLabel}</div>
            <div className={styles.timelineLine} />
            <div className={styles.timelineCards}>
              {items.map((memory) => (
                <div key={memory.id} className={styles.timelineCard}>
                  <div className={styles.timelineDot} />
                  <div className={styles.card}>{renderMemoryCard(memory)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <Pagination
          cursor={cursor}
          hasMore={hasMore}
          onNext={handleNext}
          onPrevious={handlePrevious}
          hasPrevious={cursorHistory.length > 0}
        />
      </div>
    );
  }

  function renderDuplicatesView() {
    if (isLoadingDuplicates) {
      return <p className={styles.loading}>{t('common.loading')}</p>;
    }

    if (duplicates.length === 0) {
      return <p className={styles.empty}>{t('memory.duplicates_empty')}</p>;
    }

    return (
      <div className={styles.duplicatesList}>
        <p className={styles.duplicatesDesc}>{t('memory.duplicates_desc')}</p>
        {duplicates.map((pair, index) => (
          <div key={index} className={styles.duplicatePair}>
            <div className={styles.duplicateCard}>
              <div className={styles.cardBadges}>{renderTypeBadge(pair.memoryA.type)}</div>
              <h4 className={styles.cardTitle}>{pair.memoryA.title}</h4>
              <p className={styles.cardBody}>{truncateText(pair.memoryA.body, 150)}</p>
            </div>
            <div className={styles.duplicateSimilarity}>
              <span className={styles.similarityBadge}>{Math.round(pair.similarity * 100)}%</span>
              <span className={styles.similarityLabel}>{t('memory.similarity')}</span>
            </div>
            <div className={styles.duplicateCard}>
              <div className={styles.cardBadges}>{renderTypeBadge(pair.memoryB.type)}</div>
              <h4 className={styles.cardTitle}>{pair.memoryB.title}</h4>
              <p className={styles.cardBody}>{truncateText(pair.memoryB.body, 150)}</p>
            </div>
            <div className={styles.duplicateActions}>
              <button className={styles.editButton} onClick={() => handleDismissDuplicate(index)}>
                {t('memory.dismiss_duplicate')}
              </button>
              <button
                className={styles.deleteButton}
                onClick={async () => {
                  await handleConfirmDelete(pair.memoryB.id);
                  setDuplicates((prev) => prev.filter((_, i) => i !== index));
                }}
              >
                {t('common.delete')} B
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t('memory.title')}
            <InfoTooltip text={t('help.memory_title')} />
          </h1>
          {!isLoading && total > 0 && (
            <span className={styles.totalCount}>
              {total} {t('memory.items_total')}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          <label className={styles.importLabel}>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.csv"
              onChange={handleImportFile}
              className={styles.importInput}
              disabled={isImporting}
            />
            <span className={styles.importButton}>
              {isImporting ? t('common.loading') : t('memory.import_file')}
            </span>
          </label>
          {!isCreating && (
            <button className={styles.addButton} onClick={handleOpenCreate}>
              + {t('memory.add')}
            </button>
          )}
        </div>
      </div>

      <div className={styles.viewToggle}>
        <button
          className={viewMode === 'cards' ? styles.viewToggleActive : styles.viewToggleBtn}
          onClick={() => setViewMode('cards')}
        >
          {t('memory.view_cards')}
        </button>
        <button
          className={viewMode === 'timeline' ? styles.viewToggleActive : styles.viewToggleBtn}
          onClick={() => setViewMode('timeline')}
        >
          {t('memory.view_timeline')}
        </button>
        <button
          className={viewMode === 'duplicates' ? styles.viewToggleActive : styles.viewToggleBtn}
          onClick={handleFetchDuplicates}
        >
          {t('memory.duplicates_title')}
        </button>
        <button
          className={activeTab === 'conflicts' ? styles.viewToggleActive : styles.viewToggleBtn}
          onClick={() => setActiveTab(activeTab === 'conflicts' ? 'memories' : 'conflicts')}
        >
          {t('memory.conflicts_tab')}
        </button>
      </div>

      {activeTab === 'conflicts' && <ConflictResolution t={t} locale={locale} />}

      {activeTab !== 'conflicts' && viewMode !== 'duplicates' && (
        <>
          <div className={styles.searchBar}>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder={t('memory.search_placeholder')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label={t('memory.search_placeholder')}
            />
            {searchQuery && (
              <button
                className={styles.searchClear}
                onClick={() => setSearchQuery('')}
                aria-label={t('common.clear')}
              >
                x
              </button>
            )}
          </div>

          <div className={styles.filters}>
            <select
              className={styles.select}
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              aria-label={t('memory.filter_type')}
            >
              <option value="">{t('memory.all_types')}</option>
              {MEMORY_TYPES.map((memType) => (
                <option key={memType} value={memType}>
                  {t(`memory.types.${memType}`)}
                </option>
              ))}
            </select>

            <select
              className={styles.select}
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label={t('memory.filter_status')}
            >
              <option value="">{t('memory.all_statuses')}</option>
              {MEMORY_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`memory.status.${status}`)}
                </option>
              ))}
            </select>

            {tags.length > 0 && (
              <select
                className={styles.select}
                value={tagFilter}
                onChange={(event) => setTagFilter(event.target.value)}
                aria-label={t('memory.filter_tag')}
              >
                <option value="">{t('memory.all_tags')}</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            )}

            {!isCreatingTag ? (
              <button className={styles.editButton} onClick={() => setIsCreatingTag(true)}>
                + {t('memory.create_tag')}
              </button>
            ) : (
              <div className={styles.inlineTagForm}>
                <input
                  type="text"
                  className={styles.tagNameInput}
                  value={newTagName}
                  onChange={(event) => setNewTagName(event.target.value)}
                  placeholder={t('memory.tag_name')}
                  maxLength={50}
                />
                <input
                  type="color"
                  className={styles.tagColorInput}
                  value={newTagColor}
                  onChange={(event) => setNewTagColor(event.target.value)}
                  title={t('memory.tag_color')}
                />
                <button
                  className={styles.saveButton}
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim()}
                >
                  {t('common.save')}
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsCreatingTag(false);
                    setNewTagName('');
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {isCreating && (
        <div className={styles.createForm}>
          <h2 className={styles.createFormTitle}>{t('memory.create_title')}</h2>

          <label className={styles.formLabel} htmlFor="create-title">
            {t('memory.field_title')}
          </label>
          <input
            id="create-title"
            type="text"
            className={styles.formInput}
            value={createForm.title}
            onChange={(event) =>
              setCreateForm((f) => ({
                ...f,
                title: event.target.value,
              }))
            }
            placeholder={t('memory.placeholder_title')}
            autoFocus
          />

          <label className={styles.formLabel} htmlFor="create-body">
            {t('memory.field_body')}
          </label>
          <textarea
            id="create-body"
            className={styles.formTextarea}
            value={createForm.body}
            onChange={(event) =>
              setCreateForm((f) => ({
                ...f,
                body: event.target.value,
              }))
            }
            placeholder={t('memory.placeholder_body')}
            rows={4}
          />

          <label className={styles.formLabel} htmlFor="create-type">
            {t('memory.field_type')}
          </label>
          <select
            id="create-type"
            className={styles.select}
            value={createForm.type}
            onChange={(event) =>
              setCreateForm((f) => ({
                ...f,
                type: event.target.value,
              }))
            }
          >
            {MEMORY_TYPES.map((memType) => (
              <option key={memType} value={memType}>
                {t(`memory.types.${memType}`)}
              </option>
            ))}
          </select>

          {createError && <p className={styles.formError}>{createError}</p>}

          <div className={styles.formActions}>
            <button className={styles.saveButton} onClick={handleSaveCreate} disabled={isSaving}>
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
            <button
              className={styles.cancelButton}
              onClick={handleCancelCreate}
              disabled={isSaving}
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {isLoading && <p className={styles.loading}>{t('common.loading')}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {!isLoading && !error && viewMode === 'duplicates' && renderDuplicatesView()}

      {!isLoading && !error && viewMode !== 'duplicates' && filteredMemories.length === 0 && (
        <p className={styles.empty}>{searchQuery ? t('memory.no_results') : t('memory.empty')}</p>
      )}

      {!isLoading &&
        !error &&
        filteredMemories.length > 0 &&
        viewMode === 'cards' &&
        renderCardsView()}

      {!isLoading &&
        !error &&
        filteredMemories.length > 0 &&
        viewMode === 'timeline' &&
        renderTimelineView()}
    </div>
  );
}
