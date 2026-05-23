-- HG.Cash Webhook Gateway - Migration v4
-- =====================================
-- Multi-destination webhook resolution by hostname.
-- Run AFTER alters.sql + migration_v2.sql + migration_v3.sql

USE `hgcash_gateway`;

-- ------------------------------------------------
-- Table: domains
-- ------------------------------------------------
ALTER TABLE `domains`
  ADD COLUMN IF NOT EXISTS `hostname` VARCHAR(255) NULL AFTER `base_url`;

-- Backfill hostname from existing base_url values when possible.
UPDATE `domains`
SET `hostname` = LOWER(
  TRIM(BOTH '/' FROM
    REPLACE(
      REPLACE(
        SUBSTRING_INDEX(
          SUBSTRING_INDEX(
            REPLACE(REPLACE(`base_url`, 'https://', ''), 'http://', ''),
            '/', 1
          ),
          '?', 1
        ),
        'www.', ''
      ),
      ' ', ''
    )
  )
)
WHERE (`hostname` IS NULL OR `hostname` = '')
  AND `base_url` IS NOT NULL
  AND `base_url` <> '';

-- Keep this unique if the dataset is clean. If it fails because of duplicate hostnames,
-- inspect the duplicates first and dedupe manually before rerunning this migration.
ALTER TABLE `domains`
  ADD UNIQUE KEY `uq_domains_hostname` (`hostname`);

-- ------------------------------------------------
-- Table: movements
-- ------------------------------------------------
ALTER TABLE `movements`
  ADD COLUMN IF NOT EXISTS `destination_domain_raw` VARCHAR(255) NULL AFTER `coelsa_code`,
  ADD COLUMN IF NOT EXISTS `destination_domains_raw` JSON NULL AFTER `destination_domain_raw`;

ALTER TABLE `movements`
  MODIFY COLUMN `resolution_status` ENUM('resolved','unresolved','manually_resolved','multi_resolved')
    NOT NULL DEFAULT 'unresolved',
  MODIFY COLUMN `resolution_method` ENUM('destination_domain','destination_domains','account_id','to_cbu','to_cuit','manual','none')
    NOT NULL DEFAULT 'none';

-- ------------------------------------------------
-- Table: webhook_deliveries
-- ------------------------------------------------
ALTER TABLE `webhook_deliveries`
  ADD UNIQUE KEY `uq_delivery_movement_domain` (`movement_id`, `domain_id`);
