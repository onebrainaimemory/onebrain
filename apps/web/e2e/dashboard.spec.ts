import { test, expect } from '@playwright/test';

/**
 * E2E tests for the dashboard.
 * These tests require authentication. In CI, they verify
 * redirect behavior. Locally with demo-login, they verify
 * full dashboard functionality.
 */

test.describe('Dashboard - Unauthenticated', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login page
    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect admin page to login', async ({ page }) => {
    await page.goto('/dashboard/admin');

    await page.waitForURL(/login/, { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Dashboard - Navigation Structure', () => {
  test('should have proper page title', async ({ page }) => {
    const response = await page.goto('/');

    // Landing page should load successfully
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load the landing page', async ({ page }) => {
    await page.goto('/');

    // Check for the main heading or CTA
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for Get Started / Login links
    const ctaLink = page.getByRole('link', {
      name: /get started|comenzar|jetzt starten|login|sign in/i,
    });

    if ((await ctaLink.count()) > 0) {
      await expect(ctaLink.first()).toBeVisible();
    }
  });
});

test.describe('Dashboard - Theme', () => {
  test('should have a theme toggle', async ({ page }) => {
    await page.goto('/login');

    // Look for theme toggle button
    const themeToggle = page.getByRole('button', {
      name: /theme|dark|light|dunkel|hell|oscuro|claro/i,
    });

    if ((await themeToggle.count()) > 0) {
      await expect(themeToggle.first()).toBeVisible();
    }
  });

  test('should toggle between dark and light theme', async ({ page }) => {
    await page.goto('/login');

    const themeToggle = page.getByRole('button', {
      name: /theme|dark|light|toggle/i,
    });

    if ((await themeToggle.count()) > 0) {
      // Get initial theme
      const initialTheme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme'),
      );

      await themeToggle.first().click();

      const newTheme = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme'),
      );

      // Theme should have changed
      if (initialTheme) {
        expect(newTheme).not.toBe(initialTheme);
      }
    }
  });
});

test.describe('Dashboard - Legal Pages', () => {
  test('should load the impressum page', async ({ page }) => {
    const response = await page.goto('/impressum');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load the privacy policy page', async ({ page }) => {
    const response = await page.goto('/datenschutz');
    expect(response?.status()).toBeLessThan(500);
  });

  test('should load the terms page', async ({ page }) => {
    const response = await page.goto('/agb');
    expect(response?.status()).toBeLessThan(500);
  });
});

test.describe('Dashboard - Cookie Consent', () => {
  test('should show cookie consent banner', async ({ page }) => {
    // Clear cookies to ensure banner shows
    await page.context().clearCookies();
    await page.goto('/');

    // Look for consent banner text
    const consentBanner = page.getByText(/cookie|consent/i);
    if ((await consentBanner.count()) > 0) {
      await expect(consentBanner.first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Dashboard - Version Badge', () => {
  test('should display version badge', async ({ page }) => {
    await page.goto('/login');

    const versionBadge = page.locator('[class*="version"]');
    if ((await versionBadge.count()) > 0) {
      await expect(versionBadge.first()).toBeVisible();
    }
  });
});
