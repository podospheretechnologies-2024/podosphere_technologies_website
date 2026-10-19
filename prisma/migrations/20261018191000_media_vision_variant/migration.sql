-- F13 partial: vision caption ideas + one stored platform variant + original dimensions.

-- AlterTable
ALTER TABLE `social_media`
  ADD COLUMN `width` INTEGER NULL,
  ADD COLUMN `height` INTEGER NULL,
  ADD COLUMN `caption_ideas` JSON NULL,
  ADD COLUMN `variant_path` VARCHAR(1024) NULL,
  ADD COLUMN `variant_key` VARCHAR(32) NULL;
