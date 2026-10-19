-- F5: inbox AI triage fields. F6: lead score + PodoCRM sync markers.

-- AlterTable
ALTER TABLE `social_inbox_threads`
  ADD COLUMN `ai_label` VARCHAR(32) NULL,
  ADD COLUMN `ai_priority` VARCHAR(16) NULL,
  ADD COLUMN `ai_sentiment` VARCHAR(16) NULL,
  ADD COLUMN `ai_draft` TEXT NULL,
  ADD COLUMN `ai_triaged_at` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_ai_label_idx` ON `social_inbox_threads`(`organizationId`, `ai_label`);

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_ai_priority_idx` ON `social_inbox_threads`(`organizationId`, `ai_priority`);

-- AlterTable
ALTER TABLE `social_leads`
  ADD COLUMN `score` INTEGER NULL,
  ADD COLUMN `score_reasons` JSON NULL,
  ADD COLUMN `scored_at` DATETIME(3) NULL,
  ADD COLUMN `crm_synced_at` DATETIME(3) NULL,
  ADD COLUMN `crm_external_id` VARCHAR(128) NULL;

-- CreateIndex
CREATE INDEX `social_leads_organizationId_score_idx` ON `social_leads`(`organizationId`, `score`);

-- CreateIndex
CREATE INDEX `social_leads_organizationId_crm_synced_at_idx` ON `social_leads`(`organizationId`, `crm_synced_at`);
