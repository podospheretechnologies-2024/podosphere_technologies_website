-- White-label custom domain per organization (Caddy on-demand TLS ask).

ALTER TABLE `organizations` ADD COLUMN `customDomain` VARCHAR(253) NULL;

CREATE UNIQUE INDEX `organizations_customDomain_key` ON `organizations`(`customDomain`);
