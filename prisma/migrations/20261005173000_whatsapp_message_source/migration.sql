-- AlterTable
ALTER TABLE `whatsapp_messages`
  ADD COLUMN `source` VARCHAR(191) NULL,
  ADD COLUMN `senderLabel` VARCHAR(191) NULL;
