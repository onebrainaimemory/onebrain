export const Region = {
  EU: 'EU',
  GLOBAL: 'GLOBAL',
} as const;

export type Region = (typeof Region)[keyof typeof Region];

export const Locale = {
  DE: 'de',
  EN: 'en',
  ES: 'es',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  region: Region;
  locale: Locale;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
