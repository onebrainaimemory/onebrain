'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { Pagination } from '@/components/Pagination';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './projects.module.css';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFormData {
  name: string;
  description: string;
  status: string;
}

const PROJECT_STATUSES = ['active', 'completed', 'archived'] as const;

const EMPTY_FORM: ProjectFormData = {
  name: '',
  description: '',
  status: 'active',
};

function getStatusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return styles.statusActive ?? '';
    case 'completed':
      return styles.statusCompleted ?? '';
    case 'archived':
      return styles.statusArchived ?? '';
    default:
      return styles.statusDefault ?? '';
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

export default function ProjectsPage() {
  const { t } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProjectFormData>(EMPTY_FORM);
  const [isUpdating, setIsUpdating] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchProjects = useCallback(
    async (cursorParam?: string) => {
      setIsLoading(true);
      setError('');

      try {
        const params: Record<string, string> = { limit: '20' };
        if (cursorParam) {
          params['cursor'] = cursorParam;
        }
        if (statusFilter) {
          params['status'] = statusFilter;
        }

        const response = await apiClient.get<Project[]>('/v1/projects', params);

        if (response.data) {
          setProjects(response.data);
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
    [t, statusFilter],
  );

  useEffect(() => {
    setCursorHistory([]);
    fetchProjects();
  }, [fetchProjects]);

  function handleNext(nextCursor: string) {
    if (cursor) {
      setCursorHistory((prev) => [...prev, cursor]);
    }
    fetchProjects(nextCursor);
  }

  function handlePrevious() {
    const previousCursor = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((prev) => prev.slice(0, -1));
    fetchProjects(previousCursor);
  }

  function handleFilterChange(value: string) {
    setStatusFilter(value);
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
    if (!createForm.name.trim()) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await apiClient.post<Project>('/v1/projects', {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        status: createForm.status,
      });

      if (response.data) {
        closeCreateForm();
        fetchProjects();
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(project: Project) {
    setEditingId(project.id);
    setEditForm({
      name: project.name,
      description: project.description ?? '',
      status: project.status,
    });
    setIsCreating(false);
    setDeletingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(EMPTY_FORM);
  }

  async function handleUpdate() {
    if (!editingId || !editForm.name.trim()) {
      return;
    }

    setIsUpdating(true);
    setError('');

    try {
      const response = await apiClient.patch<Project>(`/v1/projects/${editingId}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        status: editForm.status,
      });

      if (response.data) {
        cancelEdit();
        fetchProjects();
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsUpdating(false);
    }
  }

  function confirmDelete(projectId: string) {
    setDeletingId(projectId);
    setEditingId(null);
  }

  function cancelDelete() {
    setDeletingId(null);
  }

  async function handleDelete(projectId: string) {
    setIsDeleting(true);
    setError('');

    try {
      const response = await apiClient.delete(`/v1/projects/${projectId}`);

      if (response.error) {
        setError(response.error.message);
      } else {
        setDeletingId(null);
        fetchProjects();
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          {t('projects.title')}
          <InfoTooltip text={t('help.projects_title')} />
        </h1>
        <div className={styles.toolbar}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(event) => handleFilterChange(event.target.value)}
            aria-label={t('projects.filterByStatus')}
          >
            <option value="">{t('projects.allStatuses')}</option>
            {PROJECT_STATUSES.map((projectStatus) => (
              <option key={projectStatus} value={projectStatus}>
                {t(`projects.status.${projectStatus}`)}
              </option>
            ))}
          </select>
          <button className={styles.addButton} onClick={openCreateForm} disabled={isCreating}>
            + {t('projects.add')}
          </button>
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {isCreating && (
        <div className={styles.formCard}>
          <p className={styles.formTitle}>{t('projects.create')}</p>
          <div className={styles.formGrid}>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="create-name">
                {t('projects.name')}
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
                placeholder={t('projects.namePlaceholder')}
                autoFocus
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.formLabel} htmlFor="create-status">
                {t('projects.status')}
              </label>
              <select
                id="create-status"
                className={styles.formSelect}
                value={createForm.status}
                onChange={(event) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }))
                }
              >
                {PROJECT_STATUSES.map((projectStatus) => (
                  <option key={projectStatus} value={projectStatus}>
                    {t(`projects.status.${projectStatus}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.formFieldFull}>
              <label className={styles.formLabel} htmlFor="create-description">
                {t('projects.description')}
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
                placeholder={t('projects.descriptionPlaceholder')}
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

      {isLoading && <p className={styles.loading}>{t('common.loading')}</p>}

      {!isLoading && !error && projects.length === 0 && !isCreating && (
        <p className={styles.empty}>{t('projects.empty')}</p>
      )}

      {!isLoading && projects.length > 0 && (
        <>
          <div className={styles.list}>
            {projects.map((project) => (
              <div key={project.id} className={styles.card}>
                {editingId === project.id ? (
                  <div>
                    <div className={styles.formGrid}>
                      <div className={styles.formField}>
                        <label className={styles.formLabel} htmlFor={`edit-name-${project.id}`}>
                          {t('projects.name')}
                        </label>
                        <input
                          id={`edit-name-${project.id}`}
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
                        <label className={styles.formLabel} htmlFor={`edit-status-${project.id}`}>
                          {t('projects.status')}
                        </label>
                        <select
                          id={`edit-status-${project.id}`}
                          className={styles.formSelect}
                          value={editForm.status}
                          onChange={(event) =>
                            setEditForm((prev) => ({
                              ...prev,
                              status: event.target.value,
                            }))
                          }
                        >
                          {PROJECT_STATUSES.map((projectStatus) => (
                            <option key={projectStatus} value={projectStatus}>
                              {t(`projects.status.${projectStatus}`)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className={styles.formFieldFull}>
                        <label className={styles.formLabel} htmlFor={`edit-desc-${project.id}`}>
                          {t('projects.description')}
                        </label>
                        <textarea
                          id={`edit-desc-${project.id}`}
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
                        <p className={styles.cardName}>{project.name}</p>
                        {project.description && (
                          <p className={styles.cardDescription}>{project.description}</p>
                        )}
                      </div>
                      <div className={styles.cardMeta}>
                        <span
                          className={`${styles.statusBadge} ${getStatusBadgeClass(project.status)}`}
                        >
                          {project.status}
                        </span>
                        <div className={styles.cardActions}>
                          <button
                            className={styles.editButton}
                            onClick={() => startEdit(project)}
                            disabled={isDeleting}
                          >
                            {t('common.edit')}
                          </button>
                          <button
                            className={styles.deleteButton}
                            onClick={() => confirmDelete(project.id)}
                            disabled={isDeleting}
                          >
                            {t('common.delete')}
                          </button>
                        </div>
                      </div>
                    </div>
                    <p className={styles.cardDate}>{formatDate(project.createdAt)}</p>
                    {deletingId === project.id && (
                      <div className={styles.confirmOverlay}>
                        <span className={styles.confirmText}>{t('projects.confirmDelete')}</span>
                        <button
                          className={styles.confirmYes}
                          onClick={() => handleDelete(project.id)}
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
    </div>
  );
}
