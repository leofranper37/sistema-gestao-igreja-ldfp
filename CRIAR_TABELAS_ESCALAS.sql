-- ================================================================
-- Módulo: Escalas de Serviço
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- ================================================================

CREATE TABLE IF NOT EXISTS `escalas_grupos` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `church_id`  INT NOT NULL,
  `name`       VARCHAR(255) NOT NULL,
  `parent_id`  INT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_grupos_church` (`church_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_funcoes` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `church_id`    INT NOT NULL,
  `group_id`     INT NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `max_quantity` INT DEFAULT NULL,
  `created_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_funcoes_church` (`church_id`),
  KEY `idx_esc_funcoes_group`  (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_eventos` (
  `id`                   INT NOT NULL AUTO_INCREMENT,
  `church_id`            INT NOT NULL,
  `title`                VARCHAR(255) NOT NULL,
  `start_date`           DATE NOT NULL,
  `recurrence_type`      ENUM('none','weekly','biweekly','monthly') NOT NULL DEFAULT 'none',
  `recurrence_end_date`  DATE DEFAULT NULL,
  `created_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_eventos_church` (`church_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_evento_funcoes` (
  `event_id`    INT NOT NULL,
  `function_id` INT NOT NULL,
  PRIMARY KEY (`event_id`, `function_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_instancias` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `event_id`      INT NOT NULL,
  `church_id`     INT NOT NULL,
  `instance_date` DATE NOT NULL,
  `is_cancelled`  TINYINT(1) NOT NULL DEFAULT 0,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_inst_event`  (`event_id`),
  KEY `idx_esc_inst_church` (`church_id`),
  KEY `idx_esc_inst_date`   (`instance_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_atribuicoes` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `instance_id` INT NOT NULL,
  `function_id` INT NOT NULL,
  `member_id`   INT NOT NULL,
  `church_id`   INT NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_atrib` (`instance_id`, `function_id`, `member_id`),
  KEY `idx_esc_atrib_inst`   (`instance_id`),
  KEY `idx_esc_atrib_member` (`member_id`),
  KEY `idx_esc_atrib_church` (`church_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
