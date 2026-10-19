-- A4: per-client AI usage attribution + optional soft monthly cap on SocialCustomer.

-- AlterTable
ALTER TABLE `social_customers` ADD COLUMN `aiMonthlyBudgetUsd` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `social_ai_usages` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_ai_usages_organizationId_customerId_createdAt_idx` ON `social_ai_usages`(`organizationId`, `customerId`, `createdAt`);

-- AddForeignKey
ALTER TABLE `social_ai_usages` ADD CONSTRAINT `social_ai_usages_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
