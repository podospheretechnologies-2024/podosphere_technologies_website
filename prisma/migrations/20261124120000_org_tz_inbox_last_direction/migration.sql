-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `timeZone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Kolkata';

-- AlterTable
ALTER TABLE `social_inbox_threads` ADD COLUMN `lastDirection` VARCHAR(16) NULL;

-- CreateIndex
CREATE INDEX `social_inbox_threads_organizationId_lastDirection_idx` ON `social_inbox_threads`(`organizationId`, `lastDirection`);

-- Backfill lastDirection from the latest message on each thread (additive, local/dev).
UPDATE `social_inbox_threads` t
INNER JOIN (
  SELECT m.threadId, m.direction
  FROM `social_inbox_messages` m
  INNER JOIN (
    SELECT threadId, MAX(createdAt) AS lastAt
    FROM `social_inbox_messages`
    GROUP BY threadId
  ) latest ON latest.threadId = m.threadId AND latest.lastAt = m.createdAt
) last_msg ON last_msg.threadId = t.id
SET t.lastDirection = last_msg.direction;
