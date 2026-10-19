-- Extend social_notifications for typed alerts + unread tracking (F12 / B2).

ALTER TABLE `social_notifications` ADD COLUMN `type` VARCHAR(40) NOT NULL DEFAULT 'alert';
ALTER TABLE `social_notifications` ADD COLUMN `readAt` DATETIME(3) NULL;

CREATE INDEX `social_notifications_organizationId_readAt_idx` ON `social_notifications`(`organizationId`, `readAt`);
CREATE INDEX `social_notifications_organizationId_type_idx` ON `social_notifications`(`organizationId`, `type`);
