-- Step 3 unique constraints (PODO_SOCIAL_CLIENT_PLAN.md 4.2).
-- MySQL may use the (organizationId, customerId) index to satisfy the organizationId FK,
-- so add a dedicated org index and drop the org FK before replacing the composite index.
-- Unique (organizationId, customerId) allows multiple NULLs for customerId in MySQL;
-- agency brand kits (customerId NULL) are still de-duped in application code.

-- Ensure org FK has its own index before we drop the composite.
CREATE INDEX `social_brand_kits_organizationId_idx` ON `social_brand_kits`(`organizationId`);

-- DropIndex (org-level unique from original schema)
DROP INDEX `social_brand_kits_organizationId_key` ON `social_brand_kits`;

-- DropForeignKey (org — may depend on composite leftmost prefix)
ALTER TABLE `social_brand_kits` DROP FOREIGN KEY `social_brand_kits_organizationId_fkey`;

-- DropForeignKey (customer)
ALTER TABLE `social_brand_kits` DROP FOREIGN KEY `social_brand_kits_customerId_fkey`;

-- DropIndex (non-unique composite from client_scope_columns)
DROP INDEX `social_brand_kits_organizationId_customerId_idx` ON `social_brand_kits`;

-- CreateIndex
CREATE UNIQUE INDEX `social_brand_kits_organizationId_customerId_key` ON `social_brand_kits`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_brand_kits` ADD CONSTRAINT `social_brand_kits_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_brand_kits` ADD CONSTRAINT `social_brand_kits_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- WhatsApp: org FK may use the org unique index — give it a non-unique index first.
CREATE INDEX `social_whatsapp_connections_organizationId_idx` ON `social_whatsapp_connections`(`organizationId`);

ALTER TABLE `social_whatsapp_connections` DROP FOREIGN KEY `social_whatsapp_connections_organizationId_fkey`;

DROP INDEX `social_whatsapp_connections_organizationId_key` ON `social_whatsapp_connections`;

ALTER TABLE `social_whatsapp_connections` ADD CONSTRAINT `social_whatsapp_connections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX `social_whatsapp_connections_phoneNumberId_key` ON `social_whatsapp_connections`(`phoneNumberId`);
