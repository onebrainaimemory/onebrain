'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthContext';
import styles from './layout.module.css';

const adminTabs = [
  { href: '/dashboard/admin', labelKey: 'admin.nav_overview', exact: true },
  { href: '/dashboard/admin/users', labelKey: 'admin.nav_users' },
  { href: '/dashboard/admin/plans', labelKey: 'admin.nav_plans' },
  { href: '/dashboard/admin/audit', labelKey: 'admin.nav_audit' },
  { href: '/dashboard/admin/invites', labelKey: 'admin.nav_invites' },
  { href: '/dashboard/admin/metrics', labelKey: 'admin.nav_metrics' },
  { href: '/dashboard/admin/dsgvo', labelKey: 'admin.nav_dsgvo' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, t } = useAuth();
  const pathname = usePathname();

  if (isLoading) {
    return null;
  }

  if (user?.role !== 'admin') {
    return (
      <div className={styles.accessDenied}>
        <h1 className={styles.accessDeniedTitle}>{t('common.forbidden')}</h1>
        <p className={styles.accessDeniedText}>{t('admin.access_denied')}</p>
        <Link href="/dashboard" className={styles.backButton}>
          {t('nav.dashboard')}
        </Link>
      </div>
    );
  }

  function isActive(href: string, exact?: boolean): boolean {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <div className={styles.adminWrapper}>
      <div className={styles.adminHeader}>
        <span className={styles.adminBadge}>ADMIN</span>
      </div>
      <nav className={styles.tabBar} aria-label="Admin navigation">
        {adminTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`${styles.tabLink} ${isActive(tab.href, tab.exact) ? styles.tabLinkActive : ''}`}
          >
            {t(tab.labelKey)}
          </Link>
        ))}
      </nav>
      <div className={styles.adminContent}>{children}</div>
    </div>
  );
}
