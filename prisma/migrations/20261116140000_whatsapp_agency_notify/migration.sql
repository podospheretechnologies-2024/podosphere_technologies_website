-- AlterTable
ALTER TABLE `social_customers`
    ADD COLUMN `whatsapp_phone` VARCHAR(32) NULL,
    ADD COLUMN `whatsapp_report_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsapp_approval_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsapp_payment_enabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `whatsapp_approval_last_at` DATETIME(3) NULL,
    ADD COLUMN `whatsapp_approval_remind_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `whatsapp_approval_remind_key` VARCHAR(120) NULL,
    ADD COLUMN `whatsapp_payment_last_key` VARCHAR(80) NULL;

-- CreateTable
CREATE TABLE `social_whatsapp_agency_notify` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `report_template` VARCHAR(120) NULL,
    `report_language` VARCHAR(16) NULL,
    `approval_template` VARCHAR(120) NULL,
    `approval_language` VARCHAR(16) NULL,
    `payment_template` VARCHAR(120) NULL,
    `payment_language` VARCHAR(16) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_whatsapp_agency_notify_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_whatsapp_agency_notify` ADD CONSTRAINT `social_whatsapp_agency_notify_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
