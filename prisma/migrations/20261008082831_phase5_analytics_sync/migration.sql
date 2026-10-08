-- CreateTable
CREATE TABLE `social_insights_daily` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `metric` VARCHAR(191) NOT NULL,
    `value` DECIMAL(20, 4) NOT NULL,
    `fetchedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_insights_daily_integrationId_date_metric_key`(`integrationId`, `date`, `metric`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_external_posts` (
    `id` VARCHAR(191) NOT NULL,
    `integrationId` VARCHAR(191) NOT NULL,
    `externalId` VARCHAR(191) NOT NULL,
    `socialPostId` VARCHAR(191) NULL,
    `type` VARCHAR(191) NOT NULL,
    `caption` TEXT NULL,
    `permalink` VARCHAR(2048) NULL,
    `thumbnailUrl` VARCHAR(2048) NULL,
    `publishedAt` DATETIME(3) NOT NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `shares` INTEGER NULL,
    `saves` INTEGER NULL,
    `reach` INTEGER NULL,
    `impressions` INTEGER NULL,
    `videoViews` INTEGER NULL,
    `engagementRate` DECIMAL(8, 4) NULL,
    `metricsAt` DATETIME(3) NULL,

    INDEX `social_external_posts_integrationId_publishedAt_idx`(`integrationId`, `publishedAt`),
    UNIQUE INDEX `social_external_posts_integrationId_externalId_key`(`integrationId`, `externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
