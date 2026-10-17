-- Step 1 of client-wise data (PODO_SOCIAL_CLIENT_PLAN.md 4.2): nullable customerId + index + FK. No data is changed.

-- AlterTable
ALTER TABLE `social_posts` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_posts_organizationId_customerId_idx` ON `social_posts`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_media` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_media_organizationId_customerId_idx` ON `social_media`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_media` ADD CONSTRAINT `social_media_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_brand_kits` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_brand_kits_organizationId_customerId_idx` ON `social_brand_kits`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_brand_kits` ADD CONSTRAINT `social_brand_kits_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_customerId_idx` ON `social_inbox_threads`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_inbox_threads` ADD CONSTRAINT `social_inbox_threads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_leads` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_leads_organizationId_customerId_idx` ON `social_leads`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_leads` ADD CONSTRAINT `social_leads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_client_reports` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_client_reports_organizationId_customerId_idx` ON `social_client_reports`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_client_reports` ADD CONSTRAINT `social_client_reports_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `whatsapp_conversations` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `whatsapp_conversations_organizationId_customerId_idx` ON `whatsapp_conversations`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `whatsapp_broadcasts` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `whatsapp_broadcasts_organizationId_customerId_idx` ON `whatsapp_broadcasts`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `whatsapp_broadcasts` ADD CONSTRAINT `whatsapp_broadcasts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_whatsapp_connections` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_whatsapp_connections_organizationId_customerId_idx` ON `social_whatsapp_connections`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_whatsapp_connections` ADD CONSTRAINT `social_whatsapp_connections_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
