-- Org-wide default portal tab levels/order for newly created clients.
ALTER TABLE `organizations`
  ADD COLUMN `portalTabDefaults` JSON NULL;
