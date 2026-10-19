-- F9: repeat posts — SocialRecurrence linked to a post group.

-- CreateTable
CREATE TABLE `social_recurrences` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `group` VARCHAR(191) NOT NULL,
    `rule` ENUM('DAILY', 'WEEKLY', 'MONTHLY') NOT NULL,
    `until` DATETIME(3) NULL,
    `max_runs` INTEGER NULL,
    `run_count` INTEGER NOT NULL DEFAULT 0,
    `evergreen` BOOLEAN NOT NULL DEFAULT false,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `social_recurrences_group_key`(`group`),
    INDEX `social_recurrences_organization_id_active_idx`(`organization_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `social_recurrences` ADD CONSTRAINT `social_recurrences_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
