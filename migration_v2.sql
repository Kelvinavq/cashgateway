-- HG.Cash Webhook Gateway - Migration v2
-- =========================================
-- Adds resolution tracking columns to movements,
-- unique provider_event_id index, and CBU length fix.
-- Run against hgcash_gateway database AFTER alters.sql

USE `hgcash_gateway`;

-- ------------------------------------------------
-- movements: add resolution fields
-- ------------------------------------------------
ALTER TABLE `movements`
  ADD COLUMN `provider_event_id` VARCHAR(150) NULL                                          AFTER `id`,
  ADD COLUMN `gateway_event_id`  VARCHAR(150) NULL                                          AFTER `provider_event_id`,
  ADD COLUMN `resolution_status` ENUM('resolved','unresolved','manually_resolved')
                                  NOT NULL DEFAULT 'unresolved'                             AFTER `forwarded_to_domain_at`,
  ADD COLUMN `resolution_method` ENUM('account_id','to_cbu','to_cuit','manual','none')
                                  NOT NULL DEFAULT 'none'                                   AFTER `resolution_status`,
  ADD COLUMN `unresolved_reason`  VARCHAR(255) NULL                                         AFTER `resolution_method`;

-- Backfill gateway_event_id for existing rows (MySQL 8+ supports UUID())
UPDATE `movements` SET `gateway_event_id` = UUID() WHERE `gateway_event_id` IS NULL;

-- Backfill resolution for existing rows that already resolved to a domain
UPDATE `movements`
  SET `resolution_status` = 'resolved',
      `resolution_method` = 'account_id'
  WHERE `domain_id` IS NOT NULL
    AND `hgcash_account_id` IS NOT NULL;

-- ------------------------------------------------
-- movements: add indices
-- ------------------------------------------------
ALTER TABLE `movements`
  ADD UNIQUE INDEX `idx_movements_gateway_event_id`  (`gateway_event_id`),
  ADD UNIQUE INDEX `idx_movements_provider_event_id` (`provider_event_id`),
  ADD INDEX        `idx_movements_resolution_status` (`resolution_status`);

-- ------------------------------------------------
-- hgcash_accounts: widen cbu column to 40 chars
-- ------------------------------------------------
ALTER TABLE `hgcash_accounts`
  MODIFY COLUMN `cbu` VARCHAR(40) DEFAULT NULL;
