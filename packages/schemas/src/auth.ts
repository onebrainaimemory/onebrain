import { z } from 'zod';
import { emailSchema, localeSchema, regionSchema } from './common.js';

export const requestMagicLinkSchema = z.object({
  email: emailSchema,
  locale: localeSchema.optional().default('en'),
});

export const verifyMagicLinkSchema = z.object({
  token: z.string().min(1).max(512),
});

export const selectRegionSchema = z.object({
  region: regionSchema,
});

export const registerWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
  locale: localeSchema.optional().default('en'),
});

export const loginWithPasswordSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1).max(512),
});

export const setupTotpSchema = z.object({});

export const verifyTotpSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const disableTotpSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const validateTotpLoginSchema = z.object({
  tempToken: z.string().min(1).max(2048).optional(),
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export type RequestMagicLinkInput = z.infer<typeof requestMagicLinkSchema>;
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>;
export type SelectRegionInput = z.infer<typeof selectRegionSchema>;
export type RegisterWithPasswordInput = z.infer<typeof registerWithPasswordSchema>;
export type LoginWithPasswordInput = z.infer<typeof loginWithPasswordSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type SetupTotpInput = z.infer<typeof setupTotpSchema>;
export type VerifyTotpInput = z.infer<typeof verifyTotpSchema>;
export type DisableTotpInput = z.infer<typeof disableTotpSchema>;
export type ValidateTotpLoginInput = z.infer<typeof validateTotpLoginSchema>;

export const googleOAuthSchema = z.object({
  idToken: z.string().min(1).max(8192),
  locale: localeSchema.optional().default('en'),
});

export const appleOAuthSchema = z.object({
  idToken: z.string().min(1).max(8192),
  locale: localeSchema.optional().default('en'),
  displayName: z.string().min(1).max(100).optional(),
});

export const githubOAuthSchema = z.object({
  code: z.string().min(1).max(512),
  locale: localeSchema.optional().default('en'),
});

export type GoogleOAuthInput = z.infer<typeof googleOAuthSchema>;
export type AppleOAuthInput = z.infer<typeof appleOAuthSchema>;
export type GitHubOAuthInput = z.infer<typeof githubOAuthSchema>;
