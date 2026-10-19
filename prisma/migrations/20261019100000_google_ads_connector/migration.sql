-- CreateTable
CREATE TABLE `social_google_ads_connections` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `picture` VARCHAR(2048) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiration` DATETIME(3) NULL,
    `scopes` TEXT NOT NULL,
    `loginCustomerId` VARCHAR(191) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(512) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_google_ads_connections_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_google_ads_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `googleCustomerId` VARCHAR(191) NOT NULL,
    `loginCustomerId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `timeZone` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_google_ads_accounts_organizationId_customerId_idx`(`organizationId`, `customerId`),
    UNIQUE INDEX `social_google_ads_accounts_connectionId_googleCustomerId_key`(`connectionId`, `googleCustomerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_google_ads_connections` ADD CONSTRAINT `social_google_ads_connections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_google_ads_accounts` ADD CONSTRAINT `social_google_ads_accounts_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `social_google_ads_connections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_google_ads_accounts` ADD CONSTRAINT `social_google_ads_accounts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
