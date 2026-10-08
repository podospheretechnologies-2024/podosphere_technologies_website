-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `maxClients` INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN `maxUsers` INTEGER NOT NULL DEFAULT 5,
    ADD COLUMN `plan` VARCHAR(191) NOT NULL DEFAULT 'agency_starter',
    ADD COLUMN `status` ENUM('TRIAL', 'ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isPlatformAdmin` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `lastLoginAt` DATETIME(3) NULL;

-- CreateTable
CREATE TABLE `invitations` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL,
    `clientAccess` JSON NOT NULL,
    `tokenHash` VARCHAR(191) NOT NULL,
    `invitedById` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `acceptedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invitations_tokenHash_key`(`tokenHash`),
    INDEX `invitations_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NULL,
    `actorUserId` VARCHAR(191) NULL,
    `impersonatorId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NULL,
    `targetId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ad_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL,
    `status` INTEGER NOT NULL,
    `tokenSource` VARCHAR(191) NOT NULL DEFAULT 'system_user',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ad_accounts_organizationId_customerId_idx`(`organizationId`, `customerId`),
    UNIQUE INDEX `ad_accounts_externalId_key`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_client_members` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `permissions` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_client_members_organizationId_idx`(`organizationId`),
    UNIQUE INDEX `social_client_members_userId_customerId_key`(`userId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_approvers` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `client_approvers_customerId_email_key`(`customerId`, `email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_sync_states` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NULL,
    `adAccountId` VARCHAR(191) NULL,
    `kind` VARCHAR(191) NOT NULL,
    `cursor` TEXT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `lastSuccessAt` DATETIME(3) NULL,
    `lastError` TEXT NULL,
    `failures` INTEGER NOT NULL DEFAULT 0,
    `backfillDoneAt` DATETIME(3) NULL,

    UNIQUE INDEX `social_sync_states_integrationId_kind_key`(`integrationId`, `kind`),
    UNIQUE INDEX `social_sync_states_adAccountId_kind_key`(`adAccountId`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ad_entities` (
    `id` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `objective` VARCHAR(191) NULL,
    `dailyBudget` DECIMAL(14, 2) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `ad_entities_adAccountId_externalId_key`(`adAccountId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ad_insights_daily` (
    `id` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NOT NULL,
    `level` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `spend` DECIMAL(14, 2) NOT NULL,
    `impressions` BIGINT NOT NULL,
    `reach` BIGINT NOT NULL,
    `clicks` INTEGER NOT NULL,
    `leads` INTEGER NOT NULL,
    `frequency` DECIMAL(8, 4) NULL,
    `ctr` DECIMAL(8, 4) NULL,
    `cpc` DECIMAL(14, 4) NULL,
    `fetchedAt` DATETIME(3) NOT NULL,

    INDEX `ad_insights_daily_adAccountId_date_idx`(`adAccountId`, `date`),
    UNIQUE INDEX `ad_insights_daily_level_entityId_date_key`(`level`, `entityId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `invitations` ADD CONSTRAINT `invitations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ad_accounts` ADD CONSTRAINT `ad_accounts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ad_accounts` ADD CONSTRAINT `ad_accounts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_client_members` ADD CONSTRAINT `social_client_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_client_members` ADD CONSTRAINT `social_client_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_client_members` ADD CONSTRAINT `social_client_members_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_approvers` ADD CONSTRAINT `client_approvers_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_approvers` ADD CONSTRAINT `client_approvers_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
