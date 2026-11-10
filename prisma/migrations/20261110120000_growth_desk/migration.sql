-- AlterTable
ALTER TABLE `ad_insights_daily` ADD COLUMN `add_to_cart` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `purchase_value` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `purchases` INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `social_shopify_stores` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `shopDomain` VARCHAR(255) NOT NULL,
    `shopName` VARCHAR(255) NULL,
    `primaryUrl` VARCHAR(512) NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'INR',
    `timeZone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata',
    `authMode` VARCHAR(24) NOT NULL DEFAULT 'token',
    `accessTokenEncrypted` TEXT NULL,
    `clientId` VARCHAR(255) NULL,
    `clientSecretEncrypted` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` TEXT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'active',
    `lastError` VARCHAR(1024) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `trafficAvailable` BOOLEAN NULL,
    `trafficError` VARCHAR(1024) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_shopify_stores_customerId_key`(`customerId`),
    UNIQUE INDEX `social_shopify_stores_shopDomain_key`(`shopDomain`),
    INDEX `social_shopify_stores_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_daily_metrics` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `orders` INTEGER NOT NULL DEFAULT 0,
    `sales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `cancelledOrders` INTEGER NOT NULL DEFAULT 0,
    `cancelledSales` DECIMAL(14, 2) NOT NULL DEFAULT 0,
    `sessions` INTEGER NULL,
    `addToCart` INTEGER NULL,
    `checkouts` INTEGER NULL,
    `fetchedAt` DATETIME(3) NOT NULL,

    INDEX `shopify_daily_metrics_organizationId_customerId_date_idx`(`organizationId`, `customerId`, `date`),
    UNIQUE INDEX `shopify_daily_metrics_storeId_date_key`(`storeId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `shopify_traffic_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `storeId` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `sessions` INTEGER NOT NULL DEFAULT 0,
    `addToCart` INTEGER NOT NULL DEFAULT 0,
    `orders` INTEGER NOT NULL DEFAULT 0,
    `landing` JSON NOT NULL,
    `sources` JSON NOT NULL,
    `devices` JSON NOT NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `shopify_traffic_snapshots_organizationId_customerId_createdA_idx`(`organizationId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_growth_settings` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `targetRoas` DECIMAL(8, 2) NOT NULL DEFAULT 10,
    `dailyBudget` DECIMAL(14, 2) NULL,
    `budgetCap` DECIMAL(14, 2) NULL,
    `blogsPerMonth` INTEGER NOT NULL DEFAULT 5,
    `reportEveryDays` INTEGER NOT NULL DEFAULT 15,
    `contentSheetUrl` VARCHAR(2048) NULL,
    `brandContext` TEXT NULL,
    `insightsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `lastInsightsAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `social_growth_settings_customerId_key`(`customerId`),
    INDEX `social_growth_settings_organizationId_idx`(`organizationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_tasks` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `detail` TEXT NULL,
    `area` VARCHAR(24) NOT NULL DEFAULT 'ads',
    `priority` VARCHAR(8) NOT NULL DEFAULT 'med',
    `status` VARCHAR(12) NOT NULL DEFAULT 'todo',
    `dueDate` DATE NULL,
    `assigneeId` VARCHAR(191) NULL,
    `link` VARCHAR(2048) NULL,
    `source` VARCHAR(16) NOT NULL DEFAULT 'manual',
    `sourceRef` VARCHAR(191) NULL,
    `doneNote` TEXT NULL,
    `doneAt` DATETIME(3) NULL,
    `doneById` VARCHAR(191) NULL,
    `reviewNote` TEXT NULL,
    `reviewedAt` DATETIME(3) NULL,
    `reviewedById` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_tasks_organizationId_customerId_status_idx`(`organizationId`, `customerId`, `status`),
    INDEX `social_tasks_organizationId_assigneeId_idx`(`organizationId`, `assigneeId`),
    UNIQUE INDEX `social_tasks_customerId_sourceRef_key`(`customerId`, `sourceRef`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_change_logs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `place` VARCHAR(255) NOT NULL,
    `what` TEXT NOT NULL,
    `why` TEXT NULL,
    `byName` VARCHAR(120) NULL,
    `userId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_change_logs_organizationId_customerId_createdAt_idx`(`organizationId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_growth_insights` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `date` DATE NOT NULL,
    `severity` VARCHAR(8) NOT NULL DEFAULT 'info',
    `title` VARCHAR(255) NOT NULL,
    `body` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_growth_insights_organizationId_customerId_date_idx`(`organizationId`, `customerId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_ad_plan_items` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `campaignName` VARCHAR(255) NOT NULL,
    `objective` VARCHAR(120) NULL,
    `budgetNote` VARCHAR(255) NULL,
    `adsetName` VARCHAR(255) NOT NULL,
    `audience` TEXT NULL,
    `adName` VARCHAR(255) NOT NULL,
    `format` VARCHAR(120) NULL,
    `hook` TEXT NULL,
    `primaryText` TEXT NULL,
    `headline` VARCHAR(255) NULL,
    `description` VARCHAR(512) NULL,
    `cta` VARCHAR(64) NULL,
    `landingPage` VARCHAR(2048) NULL,
    `product` VARCHAR(255) NULL,
    `placements` VARCHAR(255) NULL,
    `imageNote` TEXT NULL,
    `imageUrl` VARCHAR(2048) NULL,
    `rationale` TEXT NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'pending',
    `feedback` TEXT NULL,
    `decidedAt` DATETIME(3) NULL,
    `decidedById` VARCHAR(191) NULL,
    `liveAt` DATETIME(3) NULL,
    `source` VARCHAR(16) NOT NULL DEFAULT 'bot',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_ad_plan_items_organizationId_customerId_status_idx`(`organizationId`, `customerId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_blogs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NULL,
    `metaDescription` VARCHAR(512) NULL,
    `keywords` VARCHAR(512) NULL,
    `angle` TEXT NULL,
    `bodyHtml` LONGTEXT NULL,
    `productLinks` JSON NULL,
    `coverImageUrl` VARCHAR(2048) NULL,
    `status` VARCHAR(12) NOT NULL DEFAULT 'idea',
    `feedback` TEXT NULL,
    `writeNext` BOOLEAN NOT NULL DEFAULT false,
    `shopifyBlogId` VARCHAR(191) NULL,
    `shopifyArticleId` VARCHAR(191) NULL,
    `publishedUrl` VARCHAR(2048) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_blogs_organizationId_customerId_status_idx`(`organizationId`, `customerId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_briefs` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `area` VARCHAR(40) NOT NULL,
    `ask` TEXT NOT NULL,
    `output` JSON NULL,
    `tasksAdded` BOOLEAN NOT NULL DEFAULT false,
    `createdById` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_briefs_organizationId_customerId_createdAt_idx`(`organizationId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_video_ideas` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `length` VARCHAR(40) NULL,
    `hook` TEXT NULL,
    `tool` VARCHAR(120) NULL,
    `product` VARCHAR(255) NULL,
    `landingPage` VARCHAR(2048) NULL,
    `prompts` JSON NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_video_ideas_organizationId_customerId_createdAt_idx`(`organizationId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_post_boosts` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `postId` VARCHAR(191) NOT NULL,
    `boost` BOOLEAN NOT NULL DEFAULT true,
    `budget` DECIMAL(14, 2) NULL,
    `spend` DECIMAL(14, 2) NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_post_boosts_postId_key`(`postId`),
    INDEX `social_post_boosts_organizationId_customerId_idx`(`organizationId`, `customerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_growth_reports` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `periodStart` DATE NOT NULL,
    `periodEnd` DATE NOT NULL,
    `kpis` JSON NOT NULL,
    `summary` TEXT NOT NULL,
    `insights` JSON NOT NULL,
    `done` JSON NOT NULL,
    `poa` JSON NOT NULL,
    `targets` JSON NOT NULL,
    `by` VARCHAR(12) NOT NULL DEFAULT 'ai',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `social_growth_reports_organizationId_customerId_createdAt_idx`(`organizationId`, `customerId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

