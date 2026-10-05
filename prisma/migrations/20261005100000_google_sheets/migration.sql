-- CreateTable
CREATE TABLE `social_google_sheets_connections` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `picture` VARCHAR(2048) NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NULL,
    `tokenExpiration` DATETIME(3) NULL,
    `scopes` TEXT NOT NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_google_sheets_connections_organizationId_key`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_google_spreadsheets` (
    `id` VARCHAR(191) NOT NULL,
    `connectionId` VARCHAR(191) NOT NULL,
    `spreadsheetId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `modifiedTime` DATETIME(3) NULL,
    `sheetNames` JSON NOT NULL,
    `headers` JSON NOT NULL,
    `rows` JSON NOT NULL,
    `rowCount` INTEGER NOT NULL DEFAULT 0,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_google_spreadsheets_connectionId_idx`(`connectionId`),
    UNIQUE INDEX `social_google_spreadsheets_connectionId_spreadsheetId_key`(`connectionId`, `spreadsheetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_google_sheets_connections` ADD CONSTRAINT `social_google_sheets_connections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_google_spreadsheets` ADD CONSTRAINT `social_google_spreadsheets_connectionId_fkey` FOREIGN KEY (`connectionId`) REFERENCES `social_google_sheets_connections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
