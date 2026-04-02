'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { Pagination } from '@/components/Pagination';
import { EntityGraph } from './EntityGraph';
import { EntityDuplicates } from './EntityDuplicates';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './entities.module.css';

interface Entity {
  id: string;
  name: string;
  type: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface EntityWithLinks extends Entity {
  links: {
    id: string;
    memoryItemId: string;
    linkType: string;
    createdAt: string;
  }[];
}

interface EntityFormData {
  name: string;
  type: string;
  description: string;
}

type ViewTab = 'list' | 'graph' | 'duplicates';

const ENTITY_TYPES = ['person', 'organization', 'place', 'concept', 'tool'] as const;

const EMPTY_FORM: EntityFormData = {
  name: '',
  type: 'person',
  description: '',
};

function getTypeBadgeClass(type: string): string {
  switch (type.toLowerCase()) {
    case 'person':
      return styles.typePerson ?? '';
    case 'organization':
      return styles.typeOrganization ?? '';
    case 'place':
      return styles.typePlace ?? '';
    case 'concept':
      return styles.typeConcept ?? '';
    default:
      return styles.typeDefault ?? '';
  }
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function EntitiesPage() {
  const { t } = useAuth();

  const [activeTab, setActiveTab] = useState<ViewTab>('list');
  const [entities, setEntities] = useState<Entity[]>([]);
  const [graphEntities, setGraphEntities] = useState<EntityWithLinks[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [typeFilter, setTypeFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<EntityFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EntityFormData>(EMPTY_FORM);
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntities = useCallback(
    async (cursorParam?: string) => {
      setIsLoading(true);
      setError('');

      try {
        const params: Record<string, string> = { limit: '20' };
        if (cursorParam) {
          params['cursor'] = cursorParam;
        }
        if (typeFilter) {
          params['type'] = typeFilter;
        }

        const response = await apiClient.get<Entity[]>('/v1/entities', params);

        if (response.data) {
          setEntities(response.data);
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
    [t, typeFilter],
  );

  const fetchGraphEntities = useCallback(async () => {
    try {
      const response = await apiClient.get<EntityWithLinks[]>('/v1/entities/graph');

      if (response.data) {
        setGraphEntities(response.data);
      }
    } catch {
      // Graph data is optional; do not block
    }
  }, []);

  useEffect(() => {
    setCursorHistory([]);
    fetchEntities();
  }, [fetchEntities]);

  useEffect(() => {
    if (activeTab === 'graph') {
      fetchGraphEntities();
    }
  }, [activeTab, fetchGraphEntities]);

  function handleNext(nextCursor: string) {
    if (cursor) {
      setCursorHistory((prev) => [...prev, cursor]);
    }
    fetchEntities(nextCursor);
  }

  function handlePrevious() {
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((prev) => prev.slice(0, -1));
    fetchEntities(previousCursor);
  }

  function handleFilterChange(value: string) {
    setTypeFilter(value);
  }

  function openCreateForm() {
    setIsCreating(true);
    setCreateForm(EMPTY_FORM);
    setEditingId(null);
  }

  function closeCreateForm() {
    setIsCreating(false);
    setCreateForm(EMPTY_FORM);
  }

  async function handleCreate() {
    if (!createForm.name.trim()) return;

    setIsSaving(true);
    setError('');

    try {
      const response = await apiClient.post<Entity>('/v1/entities', {
        name: createForm.name.trim(),
        type: createForm.type,
        description: createForm.description.trim(),
      });

      if (response.data) {
        closeCreateForm();
        fetchEntities();
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(entity: Entity) {
    setEditingId(entity.id);
    setEditForm({
      name: entity.name,
      type: entity.type,
      description: entity.description ?? '',
    });
    setIsCreating(false);
    setDeletingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  async function handleUpdate() {
    if (!editingId || !editForm.name.trim()) return;

    setIsUpdating(true);
    setError('');

    try {
      const response = await apiClient.patch<Entity>(`/v1/entities/${editingId}`, {
        name: editForm.name.trim(),
        type: editForm.type,
        description: editForm.description.trim(),
      });

      if (response.data) {
        cancelEdit();
        fetchEntities();
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsUpdating(false);
    }
  }

  function confirmDelete(entityId: string) {
    setDeletingId(entityId);
    setEditingId(null);
  }

  function cancelDelete() {
    setDeletingId(null);
  }

  async function handleDelete(entityId: string) {
    setIsDeleting(true);
    setError('');

    try {
      const response = await apiClient.delete(`/v1/entities/${entityId}`);

      if (response.error) {
        setError(response.error.message);
      } else {
        setDeletingId(null);
        fetchEntities();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }

  function handleDuplicatesMerged() {
    fetchEntities();
    if (activeTab === 'graph') {
      fetchGraphEntities();
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t('entities.title')}
          <InfoTooltip text={t('help.entities_title')} />
        </h1>
        <div className={styles.toolbar}>
          <select
            className={styles.filterSelect}
            value={typeFilter}
            onChange={(event) => handleFilterChange(event.target.value)}
            aria-label={t('entities.filterByType')}
          >
            <option value="">{t('entities.allTypes')}</option>
            {ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {t(`entities.type.${entityType}`)}
              </option>
            ))}
          </select>
          <button className={styles.addButton} onClick={openCreateForm} disabled={isCreating}>
            + {t('entities.add')}
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className={styles.tabBar}>
        <button
          className={activeTab === 'list' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('list')}
        >
          {t('entities.list_view')}
        </button>
        <button
          className={activeTab === 'graph' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('graph')}
        >
          {t('entities.graph_view')}
        </button>
        <button
          className={activeTab === 'duplicates' ? styles.tabActive : styles.tab}
          onClick={() => setActiveTab('duplicates')}
        >
          {t('entities.duplicates')}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isCreating && (
        <div className={styles.formCard}>
          <p className={styles.formTitle}>{t('entities.create')}</p>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="create-name">
                {t('entities.name')}
              </label>
              <input
                id="create-name"
                className={styles.formInput}
                type="text"
                value={createForm.name}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    name: event.target.value,
                  }))
                }
                placeholder={t('entities.name_placeholder')}
                autoFocus
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="create-type">
                {t('entities.type')}
              </label>
              <select
                id="create-type"
                className={styles.formSelect}
                value={createForm.type}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    type: event.target.value,
                  }))
                }
              >
                {ENTITY_TYPES.map((entityType) => (
                  <option key={entityType} value={entityType}>
                    {t(`entities.type.${entityType}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formFieldFull}>
              <label className={styles.formLabel} htmlFor="create-description">
                {t('entities.description')}
              </label>
              <textarea
                id="create-description"
                className={styles.formTextarea}
                value={createForm.description}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                placeholder={t('entities.description_placeholder')}
                rows={2}
              />
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              className={styles.saveButton}
              onClick={handleCreate}
              disabled={isSaving || !createForm.name.trim()}
            >
              {isSaving ? t('common.saving') : t('common.save')}
            </button>
            <button className={styles.cancelButton} onClick={closeCreateForm} disabled={isSaving}>
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* Graph View */}
      {activeTab === 'graph' && <EntityGraph entities={graphEntities} t={t} />}

      {/* Duplicates View */}
      {activeTab === 'duplicates' && <EntityDuplicates t={t} onMerged={handleDuplicatesMerged} />}

      {/* List View */}
      {activeTab === 'list' && (
        <>
          {isLoading && <p className={styles.loading}>{t('common.loading')}</p>}

          {!isLoading && !error && entities.length === 0 && !isCreating && (
            <p className={styles.empty}>{t('entities.empty')}</p>
          )}

          {!isLoading && entities.length > 0 && (
            <>
              <div className={styles.list}>
                {entities.map((entity) => (
                  <div key={entity.id} className={styles.card}>
                    {editingId === entity.id ? (
                      <div>
                        <div className={styles.formGrid}>
                          <div className={styles.formField}>
                            <label className={styles.formLabel} htmlFor={`edit-name-${entity.id}`}>
                              {t('entities.name')}
                            </label>
                            <input
                              id={`edit-name-${entity.id}`}
                              className={styles.formInput}
                              type="text"
                              value={editForm.name}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  name: event.target.value,
                                }))
                              }
                              autoFocus
                            />
                          </div>
                          <div className={styles.formField}>
                            <label className={styles.formLabel} htmlFor={`edit-type-${entity.id}`}>
                              {t('entities.type')}
                            </label>
                            <select
                              id={`edit-type-${entity.id}`}
                              className={styles.formSelect}
                              value={editForm.type}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  type: event.target.value,
                                }))
                              }
                            >
                              {ENTITY_TYPES.map((entityType) => (
                                <option key={entityType} value={entityType}>
                                  {t(`entities.type.${entityType}`)}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className={styles.formFieldFull}>
                            <label className={styles.formLabel} htmlFor={`edit-desc-${entity.id}`}>
                              {t('entities.description')}
                            </label>
                            <textarea
                              id={`edit-desc-${entity.id}`}
                              className={styles.formTextarea}
                              value={editForm.description}
                              onChange={(event) =>
                                setEditForm((prev) => ({
                                  ...prev,
                                  description: event.target.value,
                                }))
                              }
                              rows={2}
                            />
                          </div>
                        </div>
                        <div className={styles.formActions}>
                          <button
                            className={styles.saveButton}
                            onClick={handleUpdate}
                            disabled={isUpdating || !editForm.name.trim()}
                          >
                            {isUpdating ? t('common.saving') : t('common.save')}
                          </button>
                          <button
                            className={styles.cancelButton}
                            onClick={cancelEdit}
                            disabled={isUpdating}
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className={styles.cardHeader}>
                          <div className={styles.cardInfo}>
                            <p className={styles.cardName}>{entity.name}</p>
                            {entity.description && (
                              <p className={styles.cardDescription}>{entity.description}</p>
                            )}
                          </div>
                          <div className={styles.cardMeta}>
                            <span
                              className={`${styles.typeBadge} ${getTypeBadgeClass(entity.type)}`}
                            >
                              {entity.type}
                            </span>
                            <div className={styles.cardActions}>
                              <button
                                className={styles.editButton}
                                onClick={() => startEdit(entity)}
                                disabled={isDeleting}
                              >
                                {t('common.edit')}
                              </button>
                              <button
                                className={styles.deleteButton}
                                onClick={() => confirmDelete(entity.id)}
                                disabled={isDeleting}
                              >
                                {t('common.delete')}
                              </button>
                            </div>
                          </div>
                        </div>
                        <p className={styles.cardDate}>{formatDate(entity.createdAt)}</p>
                        {deletingId === entity.id && (
                          <div className={styles.confirmOverlay}>
                            <span className={styles.confirmText}>
                              {t('entities.confirm_delete')}
                            </span>
                            <button
                              className={styles.confirmYes}
                              onClick={() => handleDelete(entity.id)}
                              disabled={isDeleting}
                            >
                              {isDeleting ? t('common.deleting') : t('common.yes')}
                            </button>
                            <button
                              className={styles.confirmNo}
                              onClick={cancelDelete}
                              disabled={isDeleting}
                            >
                              {t('common.no')}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>

              <Pagination
                cursor={cursor}
                hasMore={hasMore}
                onNext={handleNext}
                onPrevious={handlePrevious}
                hasPrevious={cursorHistory.length > 0}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
