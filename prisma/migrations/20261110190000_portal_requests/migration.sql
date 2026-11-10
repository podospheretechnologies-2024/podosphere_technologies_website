-- Phase 4 client portal Requests tab (PODO_CLIENT_PORTAL_PLAN.md).

CREATE TABLE `social_portal_requests` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(24) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `detail` TEXT NULL,
    `status` VARCHAR(24) NOT NULL DEFAULT 'open',
    `reply` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE INDEX `social_portal_requests_organizationId_customerId_createdAt_idx` ON `social_portal_requests`(`organizationId`, `customerId`, `createdAt`);
CREATE INDEX `social_portal_requests_organizationId_status_idx` ON `social_portal_requests`(`organizationId`, `status`);

ALTER TABLE `social_portal_requests` ADD CONSTRAINT `social_portal_requests_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `social_portal_requests` ADD CONSTRAINT `social_portal_requests_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `social_portal_requests` ADD CONSTRAINT `social_portal_requests_approverId_fkey` FOREIGN KEY (`approverId`) REFERENCES `client_approvers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
