-- ============================================================================
-- LDFP — Inovações Lote 5: Cadastros auxiliares da Tesouraria (11/11/2026)
-- Fornecedores, Centros de Custo, Tipos de Documento + vínculos em
-- contas_pagar, caixa_lancamentos e banco_lancamentos.
--
-- MySQL 5.6 — rodar no phpMyAdmin de produção ANTES do ~/deploy.sh.
-- Se alguma coluna já existir, o phpMyAdmin acusa "Duplicate column name":
-- pode ignorar e seguir com as próximas instruções.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `fornecedores` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `igreja_id`  INT NOT NULL,
  `nome`       VARCHAR(255) NOT NULL,
  `cpf_cnpj`   VARCHAR(30)  NULL,
  `telefone`   VARCHAR(60)  NULL,
  `email`      VARCHAR(255) NULL,
  `endereco`   VARCHAR(255) NULL,
  `cidade`     VARCHAR(120) NULL,
  `observacao` TEXT NULL,
  `ativo`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_fornecedores_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `centros_custo` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `igreja_id`  INT NOT NULL,
  `codigo`     VARCHAR(30)  NULL,
  `nome`       VARCHAR(150) NOT NULL,
  `descricao`  VARCHAR(255) NULL,
  `ativo`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_centros_custo_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tipos_documento` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `igreja_id`  INT NOT NULL,
  `nome`       VARCHAR(100) NOT NULL,
  `ativo`      TINYINT(1) NOT NULL DEFAULT 1,
  `created_by` INT NULL,
  `created_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tipos_documento_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `contas_pagar`
  ADD COLUMN `fornecedor_id`     INT NULL,
  ADD COLUMN `centro_custo_id`   INT NULL,
  ADD COLUMN `tipo_documento_id` INT NULL,
  ADD COLUMN `numero_documento`  VARCHAR(60) NULL;

ALTER TABLE `caixa_lancamentos`
  ADD COLUMN `centro_custo_id` INT NULL,
  ADD COLUMN `fornecedor_id`   INT NULL;

ALTER TABLE `banco_lancamentos`
  ADD COLUMN `centro_custo_id` INT NULL,
  ADD COLUMN `fornecedor_id`   INT NULL;
