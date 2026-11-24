-- Agency-owned Meta ad accounts are never counted in a client's spend.
ALTER TABLE `ad_accounts` ADD COLUMN `isAgencyAccount` BOOLEAN NOT NULL DEFAULT false;

-- Guard for the FK below: clear links that point at no social client at all (dangling ids), otherwise
-- the constraint cannot be created. Rows linked to real (even soft-deleted) clients are untouched.
UPDATE `ops_clients` o
LEFT JOIN `social_customers` c ON c.id = o.socialCustomerId
SET o.socialCustomerId = NULL
WHERE o.socialCustomerId IS NOT NULL AND c.id IS NULL;

-- OpsClient.socialCustomerId is a real FK to SocialCustomer (same-org check stays in the service).
ALTER TABLE `ops_clients` ADD INDEX `ops_clients_socialCustomerId_idx`(`socialCustomerId`);

ALTER TABLE `ops_clients` ADD CONSTRAINT `ops_clients_socialCustomerId_fkey` FOREIGN KEY (`socialCustomerId`) REFERENCES `social_customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
