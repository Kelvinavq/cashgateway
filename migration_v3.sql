-- HG.Cash Webhook Gateway - Migration v3
-- =========================================
-- Enterprise features: provider sources, HMAC signing, DLQ,
-- structured logs, ACK validation, rate-limit tracking.
-- Run AFTER alters.sql + migration_v2.sql

USE `hgcash_gateway`;

-- ------------------------------------------------
-- Table: provider_sources
-- Replaces per-account gateway_token auth with formal provider entities
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `provider_sources` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `name`         VARCHAR(120) NOT NULL,
  `token`        VARCHAR(255) NOT NULL UNIQUE,
  `ip_whitelist` JSON NULL COMMENT 'Array of IPs/CIDRs; NULL = allow all',
  `is_active`    TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: system_logs
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `system_logs` (
  `id`                 BIGINT AUTO_INCREMENT PRIMARY KEY,
  `level`              ENUM('info','warn','error','debug') NOT NULL DEFAULT 'info',
  `source`             VARCHAR(100) NULL,
  `event_type`         VARCHAR(100) NULL,
  `request_id`         VARCHAR(120) NULL,
  `gateway_event_id`   VARCHAR(150) NULL,
  `provider_source_id` INT NULL,
  `movement_id`        INT NULL,
  `delivery_id`        INT NULL,
  `message`            TEXT NOT NULL,
  `metadata`           JSON NULL,
  `ip_address`         VARCHAR(120) NULL,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_slog_level`              (`level`),
  INDEX `idx_slog_event_type`         (`event_type`),
  INDEX `idx_slog_source`             (`source`),
  INDEX `idx_slog_created_at`         (`created_at`),
  INDEX `idx_slog_provider_source_id` (`provider_source_id`),
  INDEX `idx_slog_movement_id`        (`movement_id`),
  INDEX `idx_slog_delivery_id`        (`delivery_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- movements: add provider_source_id FK
-- ------------------------------------------------
ALTER TABLE `movements`
  ADD COLUMN `provider_source_id` INT NULL AFTER `id`,
  ADD INDEX  `idx_movements_provider_source_id` (`provider_source_id`),
  ADD CONSTRAINT `fk_movements_provider_source`
    FOREIGN KEY (`provider_source_id`) REFERENCES `provider_sources` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ------------------------------------------------
-- domains: HMAC signing secret + ACK requirement
-- ------------------------------------------------
ALTER TABLE `domains`
  ADD COLUMN `gateway_signing_secret` VARCHAR(255) NULL  AFTER `destination_token`,
  ADD COLUMN `require_ack`            TINYINT(1) NOT NULL DEFAULT 0 AFTER `gateway_signing_secret`;

-- ------------------------------------------------
-- webhook_deliveries: DLQ state + ACK tracking
-- ------------------------------------------------
ALTER TABLE `webhook_deliveries`
  MODIFY COLUMN `status` ENUM('pending','processing','success','failed','dead') NOT NULL DEFAULT 'pending',
  ADD COLUMN `dead_at`      DATETIME NULL,
  ADD COLUMN `ack_received` TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `ack_valid`    TINYINT NOT NULL DEFAULT 0,
  ADD COLUMN `ack_payload`  JSON NULL;
