-- Inbox assignment + SLA, and lead pipeline stages.

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `assigneeId` VARCHAR(191) NULL,
    ADD COLUMN `slaDueAt` DATETIME(3) NULL,
    ADD COLUMN `firstResponseAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_assigneeId_idx` ON `social_inbox_threads`(`organizationId`, `assigneeId`);

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_slaDueAt_idx` ON `social_inbox_threads`(`organizationId`, `slaDueAt`);

-- AddForeignKey
ALTER TABLE `social_inbox_threads` ADD CONSTRAINT `social_inbox_threads_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_leads` ADD COLUMN `stage` VARCHAR(191) NOT NULL DEFAULT 'new';

-- CreateIndex
CREATE INDEX `social_leads_organizationId_stage_idx` ON `social_leads`(`organizationId`, `stage`);
