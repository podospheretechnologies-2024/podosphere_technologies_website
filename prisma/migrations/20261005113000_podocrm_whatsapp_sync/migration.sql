-- CreateTable
CREATE TABLE `social_podocrm_whatsapp_sync` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `syncSecret` TEXT NOT NULL,
    `phoneNumberId` VARCHAR(191) NOT NULL,
    `podocrmCompanyId` VARCHAR(191) NOT NULL,
    `podocrmBaseUrl` VARCHAR(512) NOT NULL,
    `linkedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastPingAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_podocrm_whatsapp_sync_organizationId_key`(`organizationId`),
    INDEX `social_podocrm_whatsapp_sync_phoneNumberId_idx`(`phoneNumberId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_podocrm_whatsapp_sync` ADD CONSTRAINT `social_podocrm_whatsapp_sync_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
