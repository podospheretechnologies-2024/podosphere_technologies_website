-- Buyer GSTIN / place of supply for GST invoices + PDF generation.

ALTER TABLE `organizations`
  ADD COLUMN `buyerGstin` VARCHAR(20) NULL,
  ADD COLUMN `placeOfSupply` VARCHAR(120) NULL;

ALTER TABLE `billing_invoices`
  ADD COLUMN `buyerGstin` VARCHAR(20) NULL,
  ADD COLUMN `placeOfSupply` VARCHAR(120) NULL;
