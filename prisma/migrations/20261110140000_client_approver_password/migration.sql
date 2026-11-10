-- Phase 1 client portal password login (PODO_CLIENT_PORTAL_PLAN.md).
-- Email becomes unique per organization so login can look up by email (+ host org when white-label).

ALTER TABLE `client_approvers`
  ADD COLUMN `passwordHash` VARCHAR(191) NULL,
  ADD COLUMN `mustChangePassword` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lastLoginAt` DATETIME(3) NULL,
  ADD COLUMN `disabledAt` DATETIME(3) NULL;

-- Org FK may rely on the leftmost prefix of the new unique; keep a plain customer index for client lists.
CREATE INDEX `client_approvers_customerId_idx` ON `client_approvers`(`customerId`);

-- Drop customer+email unique (replace with org+email).
DROP INDEX `client_approvers_customerId_email_key` ON `client_approvers`;

CREATE UNIQUE INDEX `client_approvers_organizationId_email_key` ON `client_approvers`(`organizationId`, `email`);
