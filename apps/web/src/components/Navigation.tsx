'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeProvider';
import { LanguageSwitcher } from './LanguageSwitcher';
import { PlanBadge } from './PlanBadge';
import { SunIcon, MoonIcon } from './Icons';
import { Logo } from './Logo';
import styles from './Navigation.module.css';

interface NavItem {
  href: string;
  labelKey: string;
  adminOnly?: boolean;
  expertOnly?: boolean;
}

const userNavItems: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard' },
  { href: '/dashboard/integrations', labelKey: 'nav.integrations' },
  { href: '/dashboard/brain', labelKey: 'nav.brain' },
  { href: '/dashboard/memory', labelKey: 'nav.memory' },
  { href: '/dashboard/ingest', labelKey: 'nav.ingest' },
  { href: '/dashboard/search', labelKey: 'nav.search' },
  { href: '/dashboard/skills', labelKey: 'nav.skills' },
  { href: '/dashboard/briefings', labelKey: 'nav.briefings' },
  { href: '/dashboard/entities', labelKey: 'nav.entities', expertOnly: true },
  { href: '/dashboard/projects', labelKey: 'nav.projects', expertOnly: true },
  { href: '/dashboard/agents', labelKey: 'nav.agents' },
  { href: '/dashboard/api-keys', labelKey: 'nav.api_keys', expertOnly: true },
  { href: '/dashboard/dev-tools', labelKey: 'nav.dev_tools', expertOnly: true },
  { href: '/dashboard/shares', labelKey: 'nav.shares', expertOnly: true },
  { href: '/dashboard/referrals', labelKey: 'nav.referrals', expertOnly: true },
  { href: '/dashboard/sessions', labelKey: 'auth.sessions.title', expertOnly: true },
  { href: '/dashboard/usage', labelKey: 'nav.usage', expertOnly: true },
  { href: '/dashboard/billing', labelKey: 'nav.billing' },
  { href: '/dashboard/admin', labelKey: 'nav.admin', adminOnly: true },
];

// Admin sub-nav is handled by the admin layout tab bar.
// Sidebar only shows "Back to Dashboard" link.

export function Navigation() {
  const pathname = usePathname();
  const { t, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isExpertMode, setIsExpertMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('navMode');
    if (saved === 'expert') {
      setIsExpertMode(true);
    }
  }, []);

  const toggleMode = useCallback(() => {
    setIsExpertMode((prev) => {
      const next = !prev;
      localStorage.setItem('navMode', next ? 'expert' : 'standard');
      return next;
    });
  }, []);

  const isAdminSection = pathname.startsWith('/dashboard/admin');
  const navItems = isAdminSection
    ? []
    : userNavItems.filter((item) => !item.expertOnly || isExpertMode);

  const isActive = (href: string): boolean => {
    if (href === '/dashboard' && !isAdminSection) {
      return pathname === '/dashboard';
    }
    if (href === '/dashboard/admin' && isAdminSection) {
      return pathname === '/dashboard/admin';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      <button
        className={styles.mobileToggle}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={t('nav.toggle_menu')}
        aria-expanded={isMobileOpen}
      >
        <span className={styles.hamburger} />
      </button>

      {isMobileOpen && <div className={styles.overlay} onClick={() => setIsMobileOpen(false)} />}

      <nav
        className={`${styles.sidebar} ${isMobileOpen ? styles.sidebarOpen : ''}`}
        aria-label={t('nav.main_navigation')}
      >
        <div className={styles.logo}>
          <div className={styles.logoWrap}>
            <Logo href="/dashboard" size="sm" />
          </div>
          <div className={styles.logoRight}>
            <LanguageSwitcher />
            {!isAdminSection && <PlanBadge />}
          </div>
        </div>

        {isAdminSection && (
          <div className={styles.backToDashboard}>
            <Link
              href="/dashboard"
              className={styles.navLink}
              onClick={() => setIsMobileOpen(false)}
            >
              {t('nav.back_to_dashboard')}
            </Link>
          </div>
        )}

        <ul className={styles.navList} role="list">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'admin')
            .map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${isActive(item.href) ? styles.navLinkActive : ''}`}
                  onClick={() => setIsMobileOpen(false)}
                  aria-label={t(item.labelKey)}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                >
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
        </ul>

        <div className={styles.sidebarFooter}>
          <button
            className={styles.modeToggle}
            onClick={toggleMode}
            title={isExpertMode ? t('nav.switch_standard') : t('nav.switch_expert')}
          >
            <span className={`${styles.modeOption} ${!isExpertMode ? styles.modeActive : ''}`}>
              {t('nav.mode_standard')}
            </span>
            <span className={`${styles.modeOption} ${isExpertMode ? styles.modeActive : ''}`}>
              {t('nav.mode_expert')}
            </span>
          </button>
          <div className={styles.footerRow}>
            <button
              className={styles.themeToggle}
              onClick={toggleTheme}
              aria-label={t('theme.toggle')}
              title={t('theme.toggle')}
            >
              {theme === 'light' ? (
                <MoonIcon width={18} height={18} />
              ) : (
                <SunIcon width={18} height={18} />
              )}
            </button>
            {user && (
              <button
                className={styles.logoutButton}
                onClick={logout}
                aria-label={t('auth.logout.button')}
              >
                {t('auth.logout.button')}
              </button>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}
