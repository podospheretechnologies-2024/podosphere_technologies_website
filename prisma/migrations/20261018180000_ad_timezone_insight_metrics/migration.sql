-- M6: Meta timezone_name on ad accounts (was `timezone`).
-- M8: tighten SocialInsightDaily.metric + index for followers/reach/impressions/profile_views/website_clicks.

ALTER TABLE `ad_accounts` CHANGE `timezone` `timezone_name` VARCHAR(191) NOT NULL;

ALTER TABLE `social_insights_daily` MODIFY `metric` VARCHAR(40) NOT NULL;

CREATE INDEX `social_insights_daily_metric_idx` ON `social_insights_daily`(`metric`);
