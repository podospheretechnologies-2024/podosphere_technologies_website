-- F10: UTM builder + short links with click tracking.

-- CreateTable
CREATE TABLE `social_short_links` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `code` VARCHAR(32) NOT NULL,
    `targetUrl` VARCHAR(2048) NOT NULL,
    `utmSource` VARCHAR(120) NULL,
    `utmMedium` VARCHAR(120) NULL,
    `utmCampaign` VARCHAR(120) NULL,
    `utmTerm` VARCHAR(120) NULL,
    `utmContent` VARCHAR(120) NULL,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `social_short_links_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_short_links_organizationId_idx` ON `social_short_links`(`organizationId`);

-- CreateIndex
CREATE INDEX `social_short_links_organizationId_customerId_idx` ON `social_short_links`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_short_links` ADD CONSTRAINT `social_short_links_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_short_links` ADD CONSTRAINT `social_short_links_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
