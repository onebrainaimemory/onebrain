'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiClient } from './ApiClient';
import { useToast } from './ToastProvider';
import styles from './NotificationSettings.module.css';

interface NotificationPrefs {
  dailyQuestionEmail: boolean;
  dailyQuestionPush: boolean;
  dailyQuestionTime: string;
}

export function NotificationSettings() {
  const { t } = useAuth();
  const { showToast } = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    dailyQuestionEmail: false,
    dailyQuestionPush: false,
    dailyQuestionTime: '09:00',
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<NotificationPrefs>('/v1/user/notifications')
      .then((res) => {
        if (res.data) setPrefs(res.data);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const handleToggle = useCallback(
    async (field: keyof NotificationPrefs, value: boolean) => {
      const updated = { ...prefs, [field]: value };
      setPrefs(updated);

      const res = await apiClient.patch<NotificationPrefs>('/v1/user/notifications', {
        [field]: value,
      });

      if (res.error) {
        showToast(res.error.message, 'error');
        setPrefs(prefs);
        return;
      }

      showToast(t('daily.notifications_saved'), 'success');
    },
    [prefs, t, showToast],
  );

  const handleTimeChange = useCallback(
    async (value: string) => {
      const updated = { ...prefs, dailyQuestionTime: value };
      setPrefs(updated);

      await apiClient.patch('/v1/user/notifications', {
        dailyQuestionTime: value,
      });
    },
    [prefs],
  );

  if (isLoading) return null;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>{t('daily.notifications_title')}</h3>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={prefs.dailyQuestionEmail}
          onChange={(event) => handleToggle('dailyQuestionEmail', event.target.checked)}
          aria-label={t('daily.email_notifications')}
        />
        <div className={styles.toggleContent}>
          <span className={styles.toggleLabel}>{t('daily.email_notifications')}</span>
          <span className={styles.toggleDesc}>{t('daily.email_notifications_desc')}</span>
        </div>
      </label>

      <label className={styles.toggle}>
        <input
          type="checkbox"
          checked={prefs.dailyQuestionPush}
          onChange={(event) => handleToggle('dailyQuestionPush', event.target.checked)}
          aria-label={t('daily.push_notifications')}
        />
        <div className={styles.toggleContent}>
          <span className={styles.toggleLabel}>{t('daily.push_notifications')}</span>
          <span className={styles.toggleDesc}>{t('daily.push_notifications_desc')}</span>
        </div>
      </label>

      <label className={styles.timeLabel}>
        <span>{t('daily.notification_time')}</span>
        <input
          type="time"
          value={prefs.dailyQuestionTime}
          onChange={(event) => handleTimeChange(event.target.value)}
          className={styles.timeInput}
          aria-label={t('daily.notification_time')}
        />
      </label>
    </div>
  );
}
