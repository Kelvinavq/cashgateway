-- HG.Cash Webhook Gateway - Migration v6
-- =====================================
-- Delivery detail for initial webhook vs update forwarding.
-- Run AFTER alters.sql + migration_v2.sql + migration_v3.sql + migration_v4.sql + migration_v5.sql

USE `hgcash_gateway`;

ALTER TABLE `webhook_deliveries`
  ADD COLUMN IF NOT EXISTS `delivery_kind` ENUM('initial','update','manual_retry','manual_resolve')
    NOT NULL DEFAULT 'initial' AFTER `provider_status`,
  ADD COLUMN IF NOT EXISTS `initial_delivered_at` DATETIME NULL AFTER `delivered_at`,
  ADD COLUMN IF NOT EXISTS `last_update_delivered_at` DATETIME NULL AFTER `initial_delivered_at`;

ALTER TABLE `webhook_deliveries`
  ADD INDEX `idx_webhook_deliveries_kind` (`delivery_kind`);
