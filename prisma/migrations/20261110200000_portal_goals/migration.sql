-- Phase 5 client portal goals + ad budget (PODO_CLIENT_PORTAL_PLAN.md).

ALTER TABLE `social_customers`
  ADD COLUMN `portalGoals` JSON NULL;
