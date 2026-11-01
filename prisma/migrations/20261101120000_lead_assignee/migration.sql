-- AlterTable
ALTER TABLE `social_leads` ADD COLUMN `assignee_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_leads_organizationId_assignee_id_idx` ON `social_leads`(`organizationId`, `assignee_id`);

-- AddForeignKey
ALTER TABLE `social_leads` ADD CONSTRAINT `social_leads_assignee_id_fkey` FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
