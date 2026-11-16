-- Client Ops Desk: retainers, collections, and multi-service tracking.

CREATE TABLE `ops_clients` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `socialCustomerId` VARCHAR(191) NULL,
    `name` VARCHAR(160) NOT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'not_started',
    `engagementType` VARCHAR(24) NULL,
    `monthlyFee` DECIMAL(14, 2) NULL,
    `retainerStart` DATE NULL,
    `retainerMonths` INTEGER NULL,
    `teamNames` VARCHAR(500) NULL,
    `notes` TEXT NULL,
    `workStatus` VARCHAR(64) NULL,
    `escalation` VARCHAR(64) NULL,
    `category` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ops_clients_organizationId_status_idx`(`organizationId`, `status`),
    INDEX `ops_clients_organizationId_deletedAt_idx`(`organizationId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_client_services` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(32) NOT NULL,
    `subtype` VARCHAR(80) NOT NULL,
    `groupLabel` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ops_client_services_organizationId_category_idx`(`organizationId`, `category`),
    INDEX `ops_client_services_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `ops_payments` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(14, 2) NULL,
    `description` VARCHAR(500) NULL,
    `dueDate` DATE NULL,
    `paidAt` DATETIME(3) NULL,
    `monthKey` VARCHAR(7) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `ops_payments_organizationId_monthKey_idx`(`organizationId`, `monthKey`),
    INDEX `ops_payments_organizationId_dueDate_idx`(`organizationId`, `dueDate`),
    INDEX `ops_payments_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ops_clients` ADD CONSTRAINT `ops_clients_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ops_client_services` ADD CONSTRAINT `ops_client_services_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ops_client_services` ADD CONSTRAINT `ops_client_services_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ops_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `ops_payments` ADD CONSTRAINT `ops_payments_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `ops_payments` ADD CONSTRAINT `ops_payments_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `ops_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
