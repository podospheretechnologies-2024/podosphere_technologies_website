-- F7: Podo AI copilot agent — threads, append-only messages, approval-queued actions.

-- CreateTable
CREATE TABLE `social_ai_threads` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NULL,
    `title` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_ai_threads_organizationId_customerId_updatedAt_idx`(`organizationId`, `customerId`, `updatedAt`),
    INDEX `social_ai_threads_organizationId_updatedAt_idx`(`organizationId`, `updatedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_ai_messages` (
    `id` VARCHAR(191) NOT NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `role` VARCHAR(16) NOT NULL,
    `content` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_ai_messages_threadId_createdAt_idx`(`threadId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_ai_actions` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `threadId` VARCHAR(191) NOT NULL,
    `toolName` VARCHAR(64) NOT NULL,
    `payload` JSON NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'pending',
    `result` JSON NULL,
    `reviewedById` VARCHAR(191) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_ai_actions_organizationId_status_createdAt_idx`(`organizationId`, `status`, `createdAt`),
    INDEX `social_ai_actions_threadId_status_idx`(`threadId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_ai_threads` ADD CONSTRAINT `social_ai_threads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_threads` ADD CONSTRAINT `social_ai_threads_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_threads` ADD CONSTRAINT `social_ai_threads_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_messages` ADD CONSTRAINT `social_ai_messages_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `social_ai_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_actions` ADD CONSTRAINT `social_ai_actions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_actions` ADD CONSTRAINT `social_ai_actions_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_ai_actions` ADD CONSTRAINT `social_ai_actions_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `social_ai_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
