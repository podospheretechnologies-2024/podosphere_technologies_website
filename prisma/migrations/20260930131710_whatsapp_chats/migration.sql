-- CreateTable
CREATE TABLE `whatsapp_conversations` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `waId` VARCHAR(191) NOT NULL,
    `contactName` VARCHAR(191) NULL,
    `lastMessageAt` DATETIME(3) NOT NULL,
    `lastInboundAt` DATETIME(3) NULL,
    `lastPreview` VARCHAR(500) NULL,
    `unreadCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `whatsapp_conversations_organizationId_lastMessageAt_idx`(`organizationId`, `lastMessageAt`),
    UNIQUE INDEX `whatsapp_conversations_organizationId_waId_key`(`organizationId`, `waId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `whatsapp_messages` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `conversationId` VARCHAR(191) NOT NULL,
    `wamid` VARCHAR(191) NULL,
    `direction` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `body` TEXT NOT NULL,
    `status` VARCHAR(191) NULL,
    `timestamp` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `whatsapp_messages_wamid_key`(`wamid`),
    INDEX `whatsapp_messages_conversationId_timestamp_idx`(`conversationId`, `timestamp`),
    INDEX `whatsapp_messages_organizationId_timestamp_idx`(`organizationId`, `timestamp`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `whatsapp_conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
