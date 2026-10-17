-- GST invoice rows created on successful Razorpay payment webhooks.

CREATE TABLE `billing_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `organizationId` VARCHAR(191) NOT NULL,
    `number` VARCHAR(191) NOT NULL,
    `gstin` VARCHAR(191) NULL,
    `plan` VARCHAR(191) NULL,
    `taxableAmountPaise` INTEGER NOT NULL DEFAULT 0,
    `cgstPaise` INTEGER NOT NULL DEFAULT 0,
    `sgstPaise` INTEGER NOT NULL DEFAULT 0,
    `igstPaise` INTEGER NOT NULL DEFAULT 0,
    `totalPaise` INTEGER NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'INR',
    `pdfUrl` VARCHAR(2048) NULL,
    `razorpayPaymentId` VARCHAR(191) NULL,
    `razorpayOrderId` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'issued',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE UNIQUE INDEX `billing_invoices_organizationId_number_key` ON `billing_invoices`(`organizationId`, `number`);

CREATE INDEX `billing_invoices_organizationId_createdAt_idx` ON `billing_invoices`(`organizationId`, `createdAt`);

ALTER TABLE `billing_invoices` ADD CONSTRAINT `billing_invoices_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
