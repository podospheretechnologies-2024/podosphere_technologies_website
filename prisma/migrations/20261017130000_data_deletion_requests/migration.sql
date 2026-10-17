-- Meta App Review: persist data-deletion confirmation codes for the public status URL.

CREATE TABLE `data_deletion_requests` (
    `id` VARCHAR(191) NOT NULL,
    `confirmationCode` VARCHAR(191) NOT NULL,
    `metaUserId` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `workspaceName` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'received',
    `source` VARCHAR(191) NOT NULL DEFAULT 'meta_callback',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `data_deletion_requests_confirmationCode_key` ON `data_deletion_requests`(`confirmationCode`);

CREATE INDEX `data_deletion_requests_status_createdAt_idx` ON `data_deletion_requests`(`status`, `createdAt`);
