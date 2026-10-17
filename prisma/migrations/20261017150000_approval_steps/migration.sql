-- Multi-step per-client approvals: INTERNAL → CLIENT → APPROVED | REJECTED.

-- AlterTable
ALTER TABLE `social_posts`
  ADD COLUMN `approvalStep` ENUM('INTERNAL', 'CLIENT', 'APPROVED', 'REJECTED') NULL;

-- CreateIndex
CREATE INDEX `social_posts_organizationId_customerId_approvalStep_idx`
  ON `social_posts`(`organizationId`, `customerId`, `approvalStep`);
