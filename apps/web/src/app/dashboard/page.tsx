'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthContext';
import { apiClient } from '@/components/ApiClient';
import { PlusIcon, GearIcon, ArrowsIcon, FlameIcon } from '@/components/Icons';
import { InfoTooltip } from '@/components/InfoTooltip';
import { SkeletonCard, SkeletonList } from '@/components/Skeleton';
import { formatDate } from '@/lib/format';
import styles from './overview.module.css';

interface BrainContext {
  profile?: {
    summary?: string;
  };
  totalMemories: number;
  totalEntities: number;
  totalProjects: number;
}

interface MemoryItem {
  id: string;
  title: string;
  body: string;
  type: string;
  status: string;
  createdAt: string;
}

interface StreakData {
  streakCount: number;
  lastDate: string | null;
}

export default function DashboardPage() {
  const { t, locale } = useAuth();
  const [stats, setStats] = useState<BrainContext | null>(null);
  const [recentMemories, setRecentMemories] = useState<MemoryItem[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [contextRes, memoryRes, streakRes] = await Promise.all([
          apiClient.get<BrainContext>('/v1/brain/context'),
          apiClient.get<MemoryItem[]>('/v1/memory', { limit: '5' }),
          apiClient.get<StreakData>('/v1/user/streak'),
        ]);

        if (contextRes.data) setStats(contextRes.data);
        if (memoryRes.data) setRecentMemories(memoryRes.data);
        if (streakRes.data) setStreak(streakRes.data);
      } catch {
        // Silently handle -- stats just won't show
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <SkeletonCard />
        <div style={{ marginTop: 16 }}>
          <SkeletonList count={3} />
        </div>
      </div>
    );
  }

  const hasProfile = stats?.profile?.summary;
  const hasMemories = (stats?.totalMemories ?? 0) > 0;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>
        {t('dashboard.welcome')}
        <InfoTooltip text={t('help.dashboard_welcome')} />
      </h1>

      {streak && streak.streakCount > 0 && (
        <div className={styles.streakRow}>
          <div className={styles.streakBadge}>
            <FlameIcon width={16} height={16} />
            <span>{streak.streakCount}</span>
          </div>
        </div>
      )}

      {!hasProfile && !hasMemories && (
        <div className={styles.onboarding}>
          <h2 className={styles.onboardingTitle}>
            {t('dashboard.get_started')}
            <InfoTooltip text={t('help.dashboard_get_started')} />
          </h2>
          <div className={styles.steps}>
            <Link href="/dashboard/brain" className={styles.step}>
              <span className={styles.stepNumber}>1</span>
              <span className={styles.stepText}>{t('dashboard.step_profile')}</span>
            </Link>
            <Link href="/dashboard/ingest" className={styles.step}>
              <span className={styles.stepNumber}>2</span>
              <span className={styles.stepText}>{t('dashboard.step_memories')}</span>
            </Link>
            <Link href="/dashboard/integrations" className={styles.step}>
              <span className={styles.stepNumber}>3</span>
              <span className={styles.stepText}>{t('dashboard.step_connect')}</span>
            </Link>
          </div>
          <div className={styles.quickstart}>
            <span className={styles.quickstartTitle}>{t('dashboard.quickstart_title')}</span>
            <p className={styles.quickstartText}>{t('dashboard.quickstart_text')}</p>
            <Link href="/dashboard/integrations" className={styles.quickstartButton}>
              {t('dashboard.quickstart_button')}
            </Link>
          </div>
        </div>
      )}

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats?.totalMemories ?? 0}</span>
          <span className={styles.statLabel}>{t('dashboard.stats.total_memories')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats?.totalEntities ?? 0}</span>
          <span className={styles.statLabel}>{t('dashboard.stats.total_entities')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{stats?.totalProjects ?? 0}</span>
          <span className={styles.statLabel}>{t('dashboard.stats.total_projects')}</span>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h2 className={styles.sectionTitle}>
          {t('dashboard.quick_actions')}
          <InfoTooltip text={t('help.dashboard_quick_actions')} />
        </h2>
        <div className={styles.actionGrid}>
          <Link href="/dashboard/ingest" className={styles.actionCard}>
            <span className={styles.actionIcon}>
              <PlusIcon />
            </span>
            <span className={styles.actionLabel}>{t('dashboard.action_add_memory')}</span>
          </Link>
          <Link href="/dashboard/brain" className={styles.actionCard}>
            <span className={styles.actionIcon}>
              <GearIcon />
            </span>
            <span className={styles.actionLabel}>{t('dashboard.action_edit_profile')}</span>
          </Link>
          <Link href="/dashboard/integrations" className={styles.actionCard}>
            <span className={styles.actionIcon}>
              <ArrowsIcon />
            </span>
            <span className={styles.actionLabel}>{t('dashboard.action_connect_ai')}</span>
          </Link>
        </div>
      </div>

      <section className={styles.recentSection}>
        <h2 className={styles.sectionTitle}>
          {t('dashboard.recent_memories')}
          <InfoTooltip text={t('help.dashboard_recent_memories')} />
        </h2>

        {recentMemories.length === 0 ? (
          <p className={styles.empty}>{t('memory.empty')}</p>
        ) : (
          <ul className={styles.memoryList}>
            {recentMemories.map((memory) => (
              <li key={memory.id} className={styles.memoryItem}>
                <span className={styles.memoryType}>
                  {t(`memory.types.${memory.type}`) || memory.type}
                </span>
                <div className={styles.memoryBody}>
                  {memory.title && <span className={styles.memoryTitle}>{memory.title}</span>}
                  <span className={styles.memoryContent}>{memory.body}</span>
                </div>
                <span className={styles.memoryDate}>{formatDate(memory.createdAt, locale)}</span>
              </li>
            ))}
          </ul>
        )}

        {recentMemories.length > 0 && (
          <Link href="/dashboard/memory" className={styles.viewAll}>
            {t('dashboard.view_all_memories')}
          </Link>
        )}
      </section>
    </div>
  );
}
