-- CreateTable
CREATE TABLE `social_hashtag_groups` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `name` VARCHAR(80) NOT NULL,
    `hashtags` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_hashtag_groups_organizationId_idx` ON `social_hashtag_groups`(`organizationId`);

-- CreateIndex
CREATE INDEX `social_hashtag_groups_organizationId_customerId_idx` ON `social_hashtag_groups`(`organizationId`, `customerId`);

-- CreateTable
CREATE TABLE `social_bio_pages` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NULL,
    `slug` VARCHAR(60) NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `headline` VARCHAR(200) NULL,
    `avatarUrl` VARCHAR(2048) NULL,
    `theme` VARCHAR(20) NOT NULL DEFAULT 'light',
    `published` BOOLEAN NOT NULL DEFAULT false,
    `views` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `social_bio_pages_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_bio_pages_organizationId_idx` ON `social_bio_pages`(`organizationId`);

-- CreateIndex
CREATE INDEX `social_bio_pages_organizationId_customerId_idx` ON `social_bio_pages`(`organizationId`, `customerId`);

-- CreateTable
CREATE TABLE `social_bio_links` (
    `id` VARCHAR(191) NOT NULL,
    `bioPageId` VARCHAR(191) NOT NULL,
    `label` VARCHAR(120) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `social_bio_links_bioPageId_idx` ON `social_bio_links`(`bioPageId`);

-- AddForeignKey
ALTER TABLE `social_hashtag_groups` ADD CONSTRAINT `social_hashtag_groups_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_hashtag_groups` ADD CONSTRAINT `social_hashtag_groups_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_bio_pages` ADD CONSTRAINT `social_bio_pages_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_bio_pages` ADD CONSTRAINT `social_bio_pages_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_bio_links` ADD CONSTRAINT `social_bio_links_bioPageId_fkey` FOREIGN KEY (`bioPageId`) REFERENCES `social_bio_pages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
