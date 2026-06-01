-- ================================================================
-- Módulo: Batismos
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- ================================================================

CREATE TABLE IF NOT EXISTS `batismos` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `igreja_id`       INT NOT NULL,
  `descricao`       VARCHAR(255) NOT NULL,
  `data_batismo`    DATE DEFAULT NULL,
  `horario`         VARCHAR(10)  DEFAULT NULL,
  `local_batismo`   VARCHAR(255) DEFAULT NULL,
  `pastor`          VARCHAR(255) DEFAULT NULL,
  `encerrado`       ENUM('Não','Sim') NOT NULL DEFAULT 'Não',
  `congregacao`     VARCHAR(255) DEFAULT NULL,
  `data_aula`       DATE DEFAULT NULL,
  `professor_aula`  VARCHAR(255) DEFAULT NULL,
  `local_aula`      VARCHAR(255) DEFAULT NULL,
  `obs`             TEXT         DEFAULT NULL,
  `total_batizados` INT          DEFAULT 0,
  `fotografo`       VARCHAR(255) DEFAULT NULL,
  `link_midia`      VARCHAR(500) DEFAULT NULL,
  `created_by`      INT          DEFAULT NULL,
  `created_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batismos_igreja` (`igreja_id`),
  KEY `idx_batismos_data`   (`data_batismo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batismo_candidatos` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `batismo_id`  INT NOT NULL,
  `igreja_id`   INT NOT NULL,
  `nome`        VARCHAR(255) NOT NULL,
  `telefone`    VARCHAR(50)  DEFAULT NULL,
  `status`      ENUM('Pendente','Confirmado','Desistiu') NOT NULL DEFAULT 'Pendente',
  `membro_id`   INT DEFAULT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bat_cand_batismo` (`batismo_id`),
  KEY `idx_bat_cand_membro`  (`membro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
