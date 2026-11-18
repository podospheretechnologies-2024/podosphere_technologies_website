-- WhatsApp order flows (Shopify → template messages). See PODO_WHATSAPP_ORDER_FLOWS_PLAN.md.

ALTER TABLE `social_shopify_stores`
  ADD COLUMN `webhooksEnabled` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `lastWebhookAt` DATETIME(3) NULL,
  ADD COLUMN `consecutiveSendFailures` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `orderFlowsPaused` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `orderFlowsPausedReason` VARCHAR(255) NULL;

CREATE TABLE `social_whatsapp_order_flows` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `flowKey` VARCHAR(48) NOT NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT false,
  `templateName` VARCHAR(120) NULL,
  `templateLanguage` VARCHAR(16) NULL,
  `delayValue` INTEGER NULL,
  `delayUnit` VARCHAR(16) NULL,
  `onlyIf` JSON NULL,
  `variableMap` JSON NULL,
  `stopIf` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `social_whatsapp_order_flows_storeId_flowKey_key`(`storeId`, `flowKey`),
  INDEX `social_whatsapp_order_flows_organizationId_customerId_idx`(`organizationId`, `customerId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_shopify_webhook_events` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `shopifyWebhookId` VARCHAR(64) NOT NULL,
  `topic` VARCHAR(64) NOT NULL,
  `shopDomain` VARCHAR(255) NOT NULL,
  `resourceId` VARCHAR(64) NULL,
  `payload` JSON NOT NULL,
  `processedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `social_shopify_webhook_events_shopifyWebhookId_key`(`shopifyWebhookId`),
  INDEX `social_shopify_webhook_events_storeId_topic_createdAt_idx`(`storeId`, `topic`, `createdAt`),
  INDEX `sswe_org_customer_created_idx`(`organizationId`, `customerId`, `createdAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `social_whatsapp_order_messages` (
  `id` VARCHAR(191) NOT NULL,
  `organizationId` VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NOT NULL,
  `storeId` VARCHAR(191) NOT NULL,
  `flowId` VARCHAR(191) NOT NULL,
  `flowKey` VARCHAR(48) NOT NULL,
  `status` VARCHAR(16) NOT NULL,
  `statusReason` VARCHAR(255) NULL,
  `phone` VARCHAR(32) NULL,
  `customerName` VARCHAR(120) NULL,
  `orderLabel` VARCHAR(64) NULL,
  `orderId` VARCHAR(64) NULL,
  `checkoutToken` VARCHAR(64) NULL,
  `cartTotal` DECIMAL(14, 2) NULL,
  `currency` VARCHAR(3) NULL,
  `dedupeKey` VARCHAR(160) NOT NULL,
  `dueAt` DATETIME(3) NOT NULL,
  `sentAt` DATETIME(3) NULL,
  `wamid` VARCHAR(128) NULL,
  `recoveredAt` DATETIME(3) NULL,
  `recoveredTotal` DECIMAL(14, 2) NULL,
  `resultLabel` VARCHAR(120) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `social_whatsapp_order_messages_dedupeKey_key`(`dedupeKey`),
  INDEX `social_whatsapp_order_messages_status_dueAt_idx`(`status`, `dueAt`),
  INDEX `swom_org_customer_created_idx`(`organizationId`, `customerId`, `createdAt`),
  INDEX `social_whatsapp_order_messages_storeId_flowKey_createdAt_idx`(`storeId`, `flowKey`, `createdAt`),
  INDEX `social_whatsapp_order_messages_checkoutToken_idx`(`checkoutToken`),
  INDEX `social_whatsapp_order_messages_orderId_idx`(`orderId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `social_whatsapp_order_flows`
  ADD CONSTRAINT `social_whatsapp_order_flows_organizationId_fkey`
    FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `social_whatsapp_order_flows_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `social_whatsapp_order_flows_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `social_shopify_stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `social_shopify_webhook_events`
  ADD CONSTRAINT `social_shopify_webhook_events_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `social_shopify_stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `social_whatsapp_order_messages`
  ADD CONSTRAINT `social_whatsapp_order_messages_storeId_fkey`
    FOREIGN KEY (`storeId`) REFERENCES `social_shopify_stores`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `social_whatsapp_order_messages_flowId_fkey`
    FOREIGN KEY (`flowId`) REFERENCES `social_whatsapp_order_flows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
