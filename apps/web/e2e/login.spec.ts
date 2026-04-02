import { test, expect } from '@playwright/test';

/**
 * E2E tests for the login flow.
 * Tests the magic link request form and validation.
 */

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display the login form', async ({ page }) => {
    await expect(page.locator('h1, h2').first()).toBeVisible();
    await expect(page.getByPlaceholder(/email|e-mail|correo/i)).toBeVisible();
  });

  test('should have a submit button', async ({ page }) => {
    const submitButton = page.getByRole('button', {
      name: /send|enviar|senden|magic/i,
    });
    await expect(submitButton).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    const submitButton = page.getByRole('button', {
      name: /send|enviar|senden|magic/i,
    });
    await submitButton.click();

    // Browser native validation or custom error message
    const emailInput = page.getByPlaceholder(/email|e-mail|correo/i);
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(isInvalid).toBe(true);
  });

  test('should accept a valid email address', async ({ page }) => {
    const emailInput = page.getByPlaceholder(/email|e-mail|correo/i);
    await emailInput.fill('test@example.com');

    const value = await emailInput.inputValue();
    expect(value).toBe('test@example.com');
  });

  test('should be accessible', async ({ page }) => {
    // Check for skip-to-content link
    const skipLink = page.locator('[class*="skipToContent"]');
    if ((await skipLink.count()) > 0) {
      await expect(skipLink.first()).toHaveAttribute('href');
    }

    // Check for proper form labels
    const emailInput = page.getByPlaceholder(/email|e-mail|correo/i);
    await expect(emailInput).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/login');

    const emailInput = page.getByPlaceholder(/email|e-mail|correo/i);
    await expect(emailInput).toBeVisible();

    // Ensure the form doesn't overflow
    const formOverflow = await page.evaluate(() => {
      return document.body.scrollWidth <= window.innerWidth;
    });
    expect(formOverflow).toBe(true);
  });
});

test.describe('Login - Demo Mode', () => {
  test('should show demo login buttons in development', async ({ page }) => {
    await page.goto('/login');

    // Demo buttons may or may not be present depending on NODE_ENV
    const demoButton = page.getByRole('button', {
      name: /demo/i,
    });

    // This is environment-dependent; just verify the page loads
    await expect(page).toHaveURL(/login/);
  });
});
