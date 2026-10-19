-- Hide FB/IG comments locally after Graph is_hidden, plus canned inbox replies.

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `hiddenAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `social_inbox_messages` ADD COLUMN `hiddenAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `social_saved_replies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `title` VARCHAR(120) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_saved_replies_organizationId_idx` ON `social_saved_replies`(`organizationId`);

-- CreateIndex
CREATE INDEX `social_saved_replies_organizationId_customerId_idx` ON `social_saved_replies`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_saved_replies` ADD CONSTRAINT `social_saved_replies_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_saved_replies` ADD CONSTRAINT `social_saved_replies_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
