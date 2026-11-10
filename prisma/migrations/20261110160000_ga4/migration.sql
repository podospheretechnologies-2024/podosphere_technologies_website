-- CreateTable
CREATE TABLE `social_ga4_connections` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiration` DATETIME(3) NULL,
    `scopes` TEXT NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `lastError` VARCHAR(1024) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_ga4_connections_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_ga4_properties` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(32) NOT NULL,
    `displayName` VARCHAR(255) NOT NULL,
    `accountName` VARCHAR(255) NULL,
    `currency` VARCHAR(3) NULL,
    `timeZone` VARCHAR(64) NULL,
    `customerId` VARCHAR(191) NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'active',
    `lastError` VARCHAR(1024) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_ga4_properties_customerId_key`(`customerId`),
    UNIQUE INDEX `social_ga4_properties_organizationId_propertyId_key`(`organizationId`, `propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ga4_daily_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(32) NOT NULL,
    `date` DATE NOT NULL,
    `sessions` INTEGER NOT NULL DEFAULT 0,
    `totalUsers` INTEGER NOT NULL DEFAULT 0,
    `newUsers` INTEGER NOT NULL DEFAULT 0,
    `engagedSessions` INTEGER NOT NULL DEFAULT 0,
    `addToCarts` INTEGER NOT NULL DEFAULT 0,
    `checkouts` INTEGER NOT NULL DEFAULT 0,
    `purchases` INTEGER NOT NULL DEFAULT 0,
    `revenue` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `keyEvents` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `fetchedAt` DATETIME(3) NOT NULL,

    INDEX `ga4_daily_metrics_organizationId_customerId_date_idx`(`organizationId`, `customerId`, `date`),
    UNIQUE INDEX `ga4_daily_metrics_organizationId_propertyId_date_key`(`organizationId`, `propertyId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ga4_traffic_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `propertyId` VARCHAR(32) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `totals` JSON NOT NULL,
    `channels` JSON NOT NULL,
    `sources` JSON NOT NULL,
    `landing` JSON NOT NULL,
    `devices` JSON NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ga4_traffic_snapshots_organizationId_customerId_idx`(`organizationId`, `customerId`),
    UNIQUE INDEX `ga4_traffic_snapshots_organizationId_propertyId_key`(`organizationId`, `propertyId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

