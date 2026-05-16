-- HG.Cash Webhook Gateway - Complete MySQL Schema
-- ================================================

CREATE DATABASE IF NOT EXISTS `hgcash_gateway` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hgcash_gateway`;

-- ------------------------------------------------
-- Table: users
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `name`          VARCHAR(100) NOT NULL,
  `email`         VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `role`          ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: domains
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `domains` (
  `id`                       INT AUTO_INCREMENT PRIMARY KEY,
  `name`                     VARCHAR(100) NOT NULL,
  `slug`                     VARCHAR(100) NOT NULL UNIQUE,
  `base_url`                 VARCHAR(255) NOT NULL,
  `destination_webhook_url`  VARCHAR(255) NOT NULL,
  `destination_token`        VARCHAR(255) DEFAULT NULL,
  `is_active`                TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: hgcash_accounts
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `hgcash_accounts` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `name`            VARCHAR(100) NOT NULL,
  `account_id`      VARCHAR(100) NOT NULL UNIQUE,
  `cuit`            VARCHAR(20) DEFAULT NULL,
  `cbu`             VARCHAR(30) DEFAULT NULL,
  `alias`           VARCHAR(100) DEFAULT NULL,
  `domain_id`       INT NOT NULL,
  `webhook_secret`  VARCHAR(255) DEFAULT NULL,
  `gateway_token`   VARCHAR(255) NOT NULL UNIQUE,
  `provider_token`  VARCHAR(255) DEFAULT NULL,
  `is_active`       TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_hgcash_accounts_domain`
    FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: movements
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `movements` (
  `id`                        INT AUTO_INCREMENT PRIMARY KEY,
  `hg_id`                     VARCHAR(100) NOT NULL UNIQUE,
  `external_id`               VARCHAR(200) DEFAULT NULL,
  `account_id`                VARCHAR(100) DEFAULT NULL,
  `hgcash_account_id`         INT DEFAULT NULL,
  `domain_id`                 INT DEFAULT NULL,
  `amount`                    DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  `currency`                  VARCHAR(10) NOT NULL DEFAULT 'ARS',
  `direction`                 VARCHAR(20) DEFAULT NULL,
  `status`                    VARCHAR(30) DEFAULT NULL,
  `type`                      VARCHAR(30) DEFAULT NULL,
  `movement_date`             DATETIME DEFAULT NULL,
  `timezone`                  VARCHAR(50) DEFAULT NULL,
  `from_name`                 VARCHAR(200) DEFAULT NULL,
  `to_name`                   VARCHAR(200) DEFAULT NULL,
  `from_cbu`                  VARCHAR(30) DEFAULT NULL,
  `to_cbu`                    VARCHAR(30) DEFAULT NULL,
  `from_cuit`                 VARCHAR(20) DEFAULT NULL,
  `to_cuit`                   VARCHAR(20) DEFAULT NULL,
  `coelsa_code`               VARCHAR(100) DEFAULT NULL,
  `provider_name`             VARCHAR(100) DEFAULT NULL,
  `provider_token_id`         VARCHAR(255) DEFAULT NULL,
  `original_hg_signature`     VARCHAR(255) DEFAULT NULL,
  `received_from_provider_at` DATETIME DEFAULT NULL,
  `forwarded_to_domain_at`    DATETIME DEFAULT NULL,
  `raw_payload`               JSON DEFAULT NULL,
  `received_at`               DATETIME DEFAULT NULL,
  `created_at`                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_movements_hgcash_account`
    FOREIGN KEY (`hgcash_account_id`) REFERENCES `hgcash_accounts` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_movements_domain`
    FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: webhook_deliveries
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `webhook_deliveries` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `movement_id`        INT DEFAULT NULL,
  `domain_id`          INT DEFAULT NULL,
  `destination_url`    VARCHAR(255) NOT NULL,
  `status`             ENUM('pending','processing','success','failed') NOT NULL DEFAULT 'pending',
  `attempts`           INT NOT NULL DEFAULT 0,
  `last_http_status`   INT DEFAULT NULL,
  `last_response_body` TEXT DEFAULT NULL,
  `last_error`         TEXT DEFAULT NULL,
  `next_retry_at`      DATETIME DEFAULT NULL,
  `delivered_at`       DATETIME DEFAULT NULL,
  `created_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_deliveries_movement`
    FOREIGN KEY (`movement_id`) REFERENCES `movements` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_deliveries_domain`
    FOREIGN KEY (`domain_id`) REFERENCES `domains` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------
-- Table: audit_logs
-- ------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT DEFAULT NULL,
  `action`      VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_id`   INT DEFAULT NULL,
  `metadata`    JSON DEFAULT NULL,
  `ip_address`  VARCHAR(45) DEFAULT NULL,
  `created_at`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_logs_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================
-- Indices
-- ================================================

-- movements indices
ALTER TABLE `movements`
  ADD INDEX `idx_movements_coelsa_code`  (`coelsa_code`),
  ADD INDEX `idx_movements_account_id`   (`account_id`),
  ADD INDEX `idx_movements_domain_id`    (`domain_id`),
  ADD INDEX `idx_movements_created_at`   (`created_at`);

-- webhook_deliveries indices
ALTER TABLE `webhook_deliveries`
  ADD INDEX `idx_deliveries_status`      (`status`),
  ADD INDEX `idx_deliveries_movement_id` (`movement_id`);

-- hgcash_accounts indices
ALTER TABLE `hgcash_accounts`
  ADD INDEX `idx_hgcash_accounts_cuit` (`cuit`),
  ADD INDEX `idx_hgcash_accounts_cbu`  (`cbu`);

-- ================================================
-- Seed Data
-- ================================================

-- Default admin user (password: admin123)
INSERT INTO `users` (`name`, `email`, `password_hash`, `role`, `is_active`)
VALUES (
  'Administrator',
  'admin@hgcash.com',
  '$2b$10$rOzJqQZQmGPmJeTcHtqpMOuEKo3N8FUJhWuFbNdGv1v7b0UQHV.Ue',
  'admin',
  1
);

-- Sample domain
INSERT INTO `domains` (`name`, `slug`, `base_url`, `destination_webhook_url`, `destination_token`, `is_active`)
VALUES (
  'Demo Project',
  'demo',
  'http://localhost:4000',
  'http://localhost:4000/webhooks/hgcash',
  'demo-token-123',
  1
);

-- Sample hgcash_account
INSERT INTO `hgcash_accounts` (`name`, `account_id`, `cuit`, `cbu`, `domain_id`, `gateway_token`, `provider_token`, `is_active`)
VALUES (
  'AGROFORESTAL PAMPA',
  'c68ec492-6a49-40f1-8060-7c1cb38ac1f9',
  '30718856740',
  '0000151500036579912174',
  1,
  'gw-token-agroforestal-2024',
  'prov-token-123',
  1
);
