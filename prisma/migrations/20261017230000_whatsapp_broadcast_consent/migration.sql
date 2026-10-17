-- Broadcast consent acknowledgement + conversation opt-out for STOP/UNSUBSCRIBE.

ALTER TABLE `whatsapp_conversations` ADD COLUMN `optedOutAt` DATETIME(3) NULL;

ALTER TABLE `whatsapp_broadcasts` ADD COLUMN `consentAcknowledged` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `consentAt` DATETIME(3) NULL,
    ADD COLUMN `estimatedCostPaise` INTEGER NULL;
