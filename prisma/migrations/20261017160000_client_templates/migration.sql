-- Client templates + onboarding step on social_customers.

-- AlterTable
ALTER TABLE `social_customers` ADD COLUMN `onboardingStep` VARCHAR(32) NOT NULL DEFAULT 'created';

-- CreateTable
CREATE TABLE `social_client_templates` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `data` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_client_templates_organizationId_idx` ON `social_client_templates`(`organizationId`);

-- AddForeignKey
ALTER TABLE `social_client_templates` ADD CONSTRAINT `social_client_templates_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
