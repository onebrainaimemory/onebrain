'use client';

import type { ReactNode } from 'react';
import { AuthProvider } from '@/components/AuthContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { ToastProvider } from '@/components/ToastProvider';
import { KeyboardShortcuts } from '@/components/KeyboardShortcuts';
import { CookieConsent } from '@/components/CookieConsent';
import { RtlProvider } from '@/components/RtlProvider';

export function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RtlProvider>
          <ToastProvider>
            {children}
            <KeyboardShortcuts />
            <CookieConsent />
          </ToastProvider>
        </RtlProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
