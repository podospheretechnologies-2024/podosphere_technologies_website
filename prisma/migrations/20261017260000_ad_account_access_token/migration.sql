-- Per-account Meta ads token (multi-tenant). Worker/service must use this; no silent global fallback.
ALTER TABLE `ad_accounts`
  ADD COLUMN `accessTokenEncrypted` TEXT NULL,
  ADD COLUMN `refreshNeeded` BOOLEAN NOT NULL DEFAULT false;
