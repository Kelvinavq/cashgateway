-- HG.Cash Webhook Gateway - Migration v5
-- =====================================
-- Provider status kept separate from HG.Cash/bank payload status.
-- Run AFTER alters.sql + migration_v2.sql + migration_v3.sql + migration_v4.sql

USE `hgcash_gateway`;

-- ------------------------------------------------
-- Table: movements
-- ------------------------------------------------
ALTER TABLE `movements`
  ADD COLUMN IF NOT EXISTS `provider_status` VARCHAR(50) NULL AFTER `status`;

ALTER TABLE `movements`
  ADD INDEX `idx_movements_provider_status` (`provider_status`);

-- ------------------------------------------------
-- Table: webhook_deliveries
-- ------------------------------------------------
ALTER TABLE `webhook_deliveries`
  ADD COLUMN IF NOT EXISTS `provider_status` VARCHAR(50) NULL AFTER `status`;

