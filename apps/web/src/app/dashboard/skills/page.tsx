'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { InfoTooltip } from '@/components/InfoTooltip';
import styles from './skills.module.css';

type SkillStatus = 'all' | 'candidate' | 'active' | 'archived';
type SortBy = 'confidence' | 'usage' | 'recency';

interface SkillItem {
  id: string;
  title: string;
  body: string;
  status: string;
  confidence: number;
  usageCount: number;
  triggerConditions: string[];
  createdAt: string;
  updatedAt: string;
}

const STATUS_TABS: SkillStatus[] = ['all', 'candidate', 'active', 'archived'];

const STATUS_COLORS: Record<string, string> = {
  candidate: '#d97706',
  active: '#059669',
  archived: '#888',
};

function truncateText(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) {
    return text || '';
  }
  return text.slice(0, maxLength) + '...';
}

export default function SkillsPage() {
  const { t } = useAuth();

  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<SkillStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('confidence');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchSkills = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params: Record<string, string> = {
        limit: '20',
        sortBy,
      };
      if (statusFilter !== 'all') {
        params['status'] = statusFilter;
      }

      const response = await apiClient.get<SkillItem[]>('/v1/skills', params);
      if (response.data) {
        setSkills(response.data);
      } else if (response.error) {
        setError(response.error.message);
      }
    } catch {
      setError(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, sortBy, t]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            {t('skills.title')}
            <InfoTooltip text={t('help.skills_title')} />
          </h1>
          <span className={styles.subtitle}>{t('skills.subtitle')}</span>
        </div>
      </div>

      {/* Status Tabs */}
      <div className={styles.statusTabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            className={statusFilter === tab ? styles.statusTabActive : styles.statusTab}
            onClick={() => setStatusFilter(tab)}
          >
            {t(`skills.status.${tab}`)}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div className={styles.filters}>
        <select
          className={styles.select}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          <option value="confidence">{t('skills.sort.confidence')}</option>
          <option value="usage">{t('skills.sort.usage')}</option>
          <option value="recency">{t('skills.sort.recency')}</option>
        </select>
      </div>

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Loading */}
      {isLoading && <div className={styles.loading}>{t('common.loading')}</div>}

      {/* Empty state */}
      {!isLoading && !error && skills.length === 0 && (
        <div className={styles.empty}>{t('skills.empty')}</div>
      )}

      {/* Skill cards */}
      {!isLoading && skills.length > 0 && (
        <ul className={styles.list}>
          {skills.map((skill) => (
            <li key={skill.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <div className={styles.cardBadges}>
                  <span
                    className={styles.statusBadge}
                    style={{
                      color: STATUS_COLORS[skill.status] || '#888',
                      background:
                        skill.status === 'active'
                          ? '#ecfdf5'
                          : skill.status === 'candidate'
                            ? '#fffbeb'
                            : '#f5f5f5',
                    }}
                  >
                    {skill.status}
                  </span>
                </div>
                <span className={styles.usageCount}>
                  {skill.usageCount}x {t('skills.used')}
                </span>
              </div>

              <h3 className={styles.cardTitle}>{skill.title}</h3>
              <p className={styles.cardBody}>{truncateText(skill.body, 120)}</p>

              {/* Confidence bar */}
              <div className={styles.confidenceRow}>
                <span className={styles.confidenceLabel}>{t('skills.confidence')}</span>
                <div className={styles.confidenceBar}>
                  <div
                    className={styles.confidenceBarFill}
                    style={{ width: `${Math.round(skill.confidence)}%` }}
                  />
                </div>
                <span className={styles.confidenceValue}>{Math.round(skill.confidence)}%</span>
              </div>

              {/* Trigger condition tags */}
              {skill.triggerConditions && skill.triggerConditions.length > 0 && (
                <div className={styles.triggerTags}>
                  {skill.triggerConditions.map((condition) => (
                    <span key={condition} className={styles.triggerTag}>
                      {condition}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
