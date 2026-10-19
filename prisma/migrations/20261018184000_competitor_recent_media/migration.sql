-- F16: store recent competitor media (caption, likes, comments, type) on each snapshot.

-- AlterTable
ALTER TABLE `competitor_snapshots` ADD COLUMN `recent_media` JSON NULL;
