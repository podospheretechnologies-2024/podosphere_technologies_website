-- Optional WhatsApp alert phone on portal logins + leftover Phase 5 hooks.
ALTER TABLE `client_approvers` ADD COLUMN `phone` VARCHAR(32) NULL;
