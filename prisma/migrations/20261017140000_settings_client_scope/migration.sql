-- Settings entities (tags, signatures, sets, autoposts): nullable customerId + index + FK.

-- AlterTable
ALTER TABLE `social_tags` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_tags_organizationId_customerId_idx` ON `social_tags`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_tags` ADD CONSTRAINT `social_tags_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_signatures` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_signatures_organizationId_customerId_idx` ON `social_signatures`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_signatures` ADD CONSTRAINT `social_signatures_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_sets` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_sets_organizationId_customerId_idx` ON `social_sets`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_sets` ADD CONSTRAINT `social_sets_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `social_auto_posts` ADD COLUMN `customerId` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `social_auto_posts_organizationId_customerId_idx` ON `social_auto_posts`(`organizationId`, `customerId`);

-- AddForeignKey
ALTER TABLE `social_auto_posts` ADD CONSTRAINT `social_auto_posts_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
