-- ================================================================
-- Inovações — Lote 1 (novembro/2026)
-- Banco: ldfp8965_sistema_gestao  (MySQL 5.6 — rodar no phpMyAdmin)
-- Rode ANTES do ~/deploy.sh. Cada bloco roda uma vez só:
-- se der "Duplicate column name" / "already exists", aquele bloco já foi aplicado.
-- ================================================================

-- 1) Escalas: confirmação de disponibilidade pelo escalado
ALTER TABLE `escalas_atribuicoes`
  ADD COLUMN `status`        VARCHAR(20)  NOT NULL DEFAULT 'pendente',
  ADD COLUMN `status_motivo` VARCHAR(255) NULL,
  ADD COLUMN `status_at`     DATETIME     NULL;

-- 2) Pedidos de oração: testemunho de oração respondida
ALTER TABLE `oracoes_pedidos`
  ADD COLUMN `testemunho`    TEXT     NULL,
  ADD COLUMN `testemunho_at` DATETIME NULL;

-- 3) Editor de cartas e certificados (modelos por igreja)
CREATE TABLE IF NOT EXISTS `documentos_modelos` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `igreja_id`  INT NOT NULL,
  `nome`       VARCHAR(150) NOT NULL,
  `tipo`       VARCHAR(20)  NOT NULL DEFAULT 'carta',
  `orientacao` VARCHAR(10)  NOT NULL DEFAULT 'retrato',
  `conteudo`   LONGTEXT     NOT NULL,
  `created_by` INT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_doc_modelos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
