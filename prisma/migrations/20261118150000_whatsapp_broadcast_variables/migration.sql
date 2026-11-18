-- AlterTable
ALTER TABLE `whatsapp_broadcasts` ADD COLUMN `variables` JSON NULL;

-- CreateIndex
CREATE INDEX `whatsapp_broadcasts_organizationId_status_idx` ON `whatsapp_broadcasts`(`organizationId`, `status`);
