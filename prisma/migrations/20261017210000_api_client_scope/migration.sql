-- White-label portal title + client-scoped API keys.

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `portalTitle` VARCHAR(120) NULL;

-- AlterTable
ALTER TABLE `social_api_clients` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_api_clients_organizationId_customerId_idx` ON `social_api_clients`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_api_clients` ADD CONSTRAINT `social_api_clients_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
