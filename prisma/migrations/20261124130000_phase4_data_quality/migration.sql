-- AlterTable
ALTER TABLE `social_external_posts` ADD COLUMN `engagement` INTEGER NULL,
    ADD COLUMN `clicks` INTEGER NULL;

-- AlterTable
ALTER TABLE `social_customers` ADD COLUMN `clientType` VARCHAR(16) NULL;
