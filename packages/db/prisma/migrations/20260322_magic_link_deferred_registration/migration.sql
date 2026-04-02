-- Deferred user registration: magic link tokens no longer require a user
-- to exist. Users are created only when the magic link is verified.
-- This prevents pre-registration attacks where bots submit emails to
-- create unverified user accounts.

-- Make userId nullable (tokens can exist without a user)
ALTER TABLE magic_link_tokens ALTER COLUMN user_id DROP NOT NULL;

-- Add email column for direct lookup during verify
ALTER TABLE magic_link_tokens ADD COLUMN IF NOT EXISTS email VARCHAR(255);

-- Backfill email from existing user records
UPDATE magic_link_tokens
SET email = (SELECT email FROM users WHERE id = magic_link_tokens.user_id)
WHERE email IS NULL AND user_id IS NOT NULL;

-- Set default for any orphaned tokens
UPDATE magic_link_tokens SET email = '' WHERE email IS NULL;

-- Make email NOT NULL after backfill
ALTER TABLE magic_link_tokens ALTER COLUMN email SET NOT NULL;

-- Index for email-based lookups
CREATE INDEX IF NOT EXISTS magic_link_tokens_email_idx ON magic_link_tokens (email);
