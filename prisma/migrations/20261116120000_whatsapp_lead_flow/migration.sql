-- AlterTable
ALTER TABLE `social_leads`
    ADD COLUMN `wa_id` VARCHAR(32) NULL,
    ADD COLUMN `wa_step` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `wa_last_sent_at` DATETIME(3) NULL,
    ADD COLUMN `wa_next_at` DATETIME(3) NULL,
    ADD COLUMN `wa_replied_at` DATETIME(3) NULL,
    ADD COLUMN `wa_error` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `whatsapp_conversations`
    ADD COLUMN `ad_source_id` VARCHAR(64) NULL,
    ADD COLUMN `ad_headline` VARCHAR(255) NULL,
    ADD COLUMN `ad_source_url` VARCHAR(1024) NULL;

-- CreateTable
CREATE TABLE `social_whatsapp_lead_flows` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `welcome_template` VARCHAR(120) NULL,
    `welcome_language` VARCHAR(16) NULL,
    `follow_up1_template` VARCHAR(120) NULL,
    `follow_up1_language` VARCHAR(16) NULL,
    `follow_up1_after_hours` INTEGER NOT NULL DEFAULT 24,
    `follow_up2_template` VARCHAR(120) NULL,
    `follow_up2_language` VARCHAR(16) NULL,
    `follow_up2_after_hours` INTEGER NOT NULL DEFAULT 48,
    `alert_phone` VARCHAR(32) NULL,
    `alert_template` VARCHAR(120) NULL,
    `alert_language` VARCHAR(16) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_whatsapp_lead_flows_organizationId_customerId_idx`(`organizationId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_leads_organizationId_wa_id_idx` ON `social_leads`(`organizationId`, `wa_id`);

-- CreateIndex
CREATE INDEX `social_leads_wa_next_at_idx` ON `social_leads`(`wa_next_at`);

-- AddForeignKey
ALTER TABLE `social_whatsapp_lead_flows` ADD CONSTRAINT `social_whatsapp_lead_flows_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_whatsapp_lead_flows` ADD CONSTRAINT `social_whatsapp_lead_flows_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
