-- WhatsApp keyword/regex auto-replies (F15).

CREATE TABLE `social_whatsapp_auto_replies` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `name` VARCHAR(120) NOT NULL,
    `matchType` VARCHAR(16) NOT NULL,
    `pattern` VARCHAR(500) NOT NULL,
    `caseSensitive` BOOLEAN NOT NULL DEFAULT false,
    `replyType` VARCHAR(16) NOT NULL,
    `replyText` TEXT NULL,
    `templateName` VARCHAR(120) NULL,
    `templateLanguage` VARCHAR(16) NULL,
    `templateVariables` JSON NULL,
    `businessHoursEnabled` BOOLEAN NOT NULL DEFAULT false,
    `businessHoursStart` VARCHAR(5) NULL,
    `businessHoursEnd` VARCHAR(5) NULL,
    `businessHoursTimezone` VARCHAR(64) NULL,
    `businessHoursDays` JSON NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `social_whatsapp_auto_replies_organizationId_customerId_active_idx`
  ON `social_whatsapp_auto_replies`(`organizationId`, `customerId`, `active`);

CREATE INDEX `social_whatsapp_auto_replies_organizationId_priority_idx`
  ON `social_whatsapp_auto_replies`(`organizationId`, `priority`);

ALTER TABLE `social_whatsapp_auto_replies`
  ADD CONSTRAINT `social_whatsapp_auto_replies_organizationId_fkey`
  FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `social_whatsapp_auto_replies`
  ADD CONSTRAINT `social_whatsapp_auto_replies_customerId_fkey`
  FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
