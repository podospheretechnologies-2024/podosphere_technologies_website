-- AlterTable
ALTER TABLE `social_media` ADD COLUMN `format` ENUM('POST', 'REEL', 'STORY') NOT NULL DEFAULT 'POST';

-- CreateIndex
CREATE INDEX `social_media_format_idx` ON `social_media`(`format`);
