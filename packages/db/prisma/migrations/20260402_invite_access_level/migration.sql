-- Add access_level to invite_links (default: read)
ALTER TABLE "invite_links" ADD COLUMN "access_level" VARCHAR(20) NOT NULL DEFAULT 'read';
