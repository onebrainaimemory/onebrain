/**
 * Vitest setup file for web component tests.
 * Extends expect with jest-dom matchers (toBeInTheDocument, etc.).
 * Enables auto-cleanup between tests.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
