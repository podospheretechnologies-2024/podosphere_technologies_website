-- Phase 2 client portal shell: per-client tab toggles (PODO_CLIENT_PORTAL_PLAN.md).

ALTER TABLE `social_customers`
  ADD COLUMN `portalTabs` JSON NULL;
