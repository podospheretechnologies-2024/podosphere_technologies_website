-- SLA breach flag for inbox threads + template bootstrap blob on customers.

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `slaBreachedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `social_inbox_threads_slaDueAt_firstResponseAt_slaBreachedAt_idx` ON `social_inbox_threads`(`slaDueAt`, `firstResponseAt`, `slaBreachedAt`);

-- AlterTable
ALTER TABLE `social_customers` ADD COLUMN `templateBootstrap` JSON NULL;
