-- CreateTable
CREATE TABLE `social_ai_settings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `provider` VARCHAR(16) NOT NULL,
    `model` VARCHAR(64) NULL,
    `apiKeyEncrypted` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_ai_settings_organizationId_customerId_key`(`organizationId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AlterTable
ALTER TABLE `social_ai_usages` ADD COLUMN `provider` VARCHAR(16) NULL;

-- AddForeignKey
ALTER TABLE `social_ai_settings` ADD CONSTRAINT `social_ai_settings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_settings` ADD CONSTRAINT `social_ai_settings_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
