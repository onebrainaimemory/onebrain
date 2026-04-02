'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import styles from './KeyboardShortcuts.module.css';

export function KeyboardShortcuts() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();
  const { t } = useAuth();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isCtrlOrMeta = event.ctrlKey || event.metaKey;
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

      if (event.key === 'Escape') {
        setIsModalOpen(false);
        return;
      }

      if (isInputFocused && !isCtrlOrMeta) return;

      if (isCtrlOrMeta && event.key === '/') {
        event.preventDefault();
        setIsModalOpen((prev) => !prev);
        return;
      }

      if (isCtrlOrMeta && event.key === 'k') {
        event.preventDefault();
        router.push('/dashboard/memory');
        return;
      }

      if (isCtrlOrMeta && event.key === 'n') {
        event.preventDefault();
        router.push('/dashboard/ingest');
      }
    },
    [router],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isModalOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={() => setIsModalOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={t('shortcuts.title')}
    >
      <div className={styles.modal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>{t('shortcuts.title')}</h2>
          <button
            className={styles.closeBtn}
            onClick={() => setIsModalOpen(false)}
            aria-label={t('common.close')}
          >
            x
          </button>
        </div>
        <ul className={styles.list}>
          <li className={styles.item}>
            <span className={styles.keys}>
              <kbd>Ctrl</kbd> + <kbd>/</kbd>
            </span>
            <span>{t('shortcuts.show_shortcuts')}</span>
          </li>
          <li className={styles.item}>
            <span className={styles.keys}>
              <kbd>Ctrl</kbd> + <kbd>K</kbd>
            </span>
            <span>{t('shortcuts.search')}</span>
          </li>
          <li className={styles.item}>
            <span className={styles.keys}>
              <kbd>Ctrl</kbd> + <kbd>N</kbd>
            </span>
            <span>{t('shortcuts.new_memory')}</span>
          </li>
          <li className={styles.item}>
            <span className={styles.keys}>
              <kbd>Esc</kbd>
            </span>
            <span>{t('shortcuts.close_modal')}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
