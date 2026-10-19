-- Inbox reply/hide: distinguish comments vs DMs and remember the webhook channel.

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `kind` VARCHAR(191) NULL,
    ADD COLUMN `channelInternalId` VARCHAR(191) NULL;
