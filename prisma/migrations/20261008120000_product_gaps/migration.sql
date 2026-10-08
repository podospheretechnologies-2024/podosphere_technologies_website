-- Public API clients
CREATE TABLE `social_api_clients` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `tokenHash` VARCHAR(191) NOT NULL,
  `tokenPrefix` VARCHAR(16) NOT NULL,
  `permissions` JSON NOT NULL,
  `dailyLimit` INTEGER NOT NULL DEFAULT 1000,
  `ipAllowlist` TEXT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'active',
  `lastUsedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `social_api_clients_tokenHash_key`(`tokenHash`),
  INDEX `social_api_clients_organizationId_idx`(`organizationId`),
  CONSTRAINT `social_api_clients_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_api_usage_logs` (
  `id` VARCHAR(191) NOT NULL,
  `apiClientId` VARCHAR(191) NOT NULL,
  `path` VARCHAR(191) NOT NULL,
  `statusCode` INTEGER NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `social_api_usage_logs_apiClientId_createdAt_idx`(`apiClientId`, `createdAt`),
  CONSTRAINT `social_api_usage_logs_apiClientId_fkey` FOREIGN KEY (`apiClientId`) REFERENCES `social_api_clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_inbox_threads` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `platform` VARCHAR(191) NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `contactName` VARCHAR(191) NULL,
  `lastPreview` VARCHAR(500) NULL,
  `lastMessageAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `social_inbox_threads_organizationId_platform_externalId_key`(`organizationId`, `platform`, `externalId`),
  INDEX `social_inbox_threads_organizationId_lastMessageAt_idx`(`organizationId`, `lastMessageAt`),
  CONSTRAINT `social_inbox_threads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_inbox_messages` (
  `id` VARCHAR(191) NOT NULL,
  `threadId` VARCHAR(191) NOT NULL,
  `direction` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `externalId` VARCHAR(191) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `social_inbox_messages_threadId_createdAt_idx`(`threadId`, `createdAt`),
  CONSTRAINT `social_inbox_messages_threadId_fkey` FOREIGN KEY (`threadId`) REFERENCES `social_inbox_threads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_leads` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `source` VARCHAR(191) NOT NULL,
  `externalId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NULL,
  `email` VARCHAR(191) NULL,
  `phone` VARCHAR(191) NULL,
  `payload` JSON NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `social_leads_organizationId_source_externalId_key`(`organizationId`, `source`, `externalId`),
  INDEX `social_leads_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  CONSTRAINT `social_leads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_client_reports` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `periodStart` DATETIME(3) NOT NULL,
  `periodEnd` DATETIME(3) NOT NULL,
  `body` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `social_client_reports_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  CONSTRAINT `social_client_reports_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_subscriptions` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `plan` VARCHAR(191) NOT NULL,
  `razorpaySubscriptionId` VARCHAR(191) NULL,
  `razorpayOrderId` VARCHAR(191) NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'created',
  `currentPeriodEnd` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `social_subscriptions_organizationId_key`(`organizationId`),
  CONSTRAINT `social_subscriptions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_broadcasts` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `templateName` VARCHAR(191) NOT NULL,
  `language` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
  `recipientCount` INTEGER NOT NULL DEFAULT 0,
  `sentCount` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `whatsapp_broadcasts_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
  CONSTRAINT `whatsapp_broadcasts_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `whatsapp_broadcast_recipients` (
  `id` VARCHAR(191) NOT NULL,
  `broadcastId` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(191) NOT NULL,
  `status` VARCHAR(191) NOT NULL DEFAULT 'pending',
  `wamid` VARCHAR(191) NULL,
  `error` TEXT NULL,
  PRIMARY KEY (`id`),
  INDEX `whatsapp_broadcast_recipients_broadcastId_idx`(`broadcastId`),
  CONSTRAINT `whatsapp_broadcast_recipients_broadcastId_fkey` FOREIGN KEY (`broadcastId`) REFERENCES `whatsapp_broadcasts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_whatsapp_connections` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `wabaId` VARCHAR(191) NOT NULL,
  `phoneNumberId` VARCHAR(191) NOT NULL,
  `displayPhone` VARCHAR(191) NULL,
  `businessName` VARCHAR(191) NULL,
  `accessToken` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `social_whatsapp_connections_organizationId_key`(`organizationId`),
  CONSTRAINT `social_whatsapp_connections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
