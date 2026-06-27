-- ================================================================
-- Módulo: LDFP Estudo (Bíblia, Devocionais e Planos) - MVP
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- Compatibilidade: MySQL 5.6+ (Uso de LONGTEXT em vez de JSON)
-- ================================================================

-- 1. Versões da Bíblia disponíveis no sistema
CREATE TABLE IF NOT EXISTS `estudo_versoes` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `codigo`        VARCHAR(20) NOT NULL COMMENT 'ex: arc, proprio_ldfp',
  `nome`          VARCHAR(120) NOT NULL,
  `idioma`        VARCHAR(10) NOT NULL DEFAULT 'pt',
  `licenca_nota`  VARCHAR(255) DEFAULT NULL,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_versoes_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Passagens bíblicas (Texto sagrado)
CREATE TABLE IF NOT EXISTS `estudo_passagens` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `livro_ordem`   SMALLINT NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo`     SMALLINT NOT NULL,
  `texto`         TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_passagens_ref` (`versao_id`, `livro_ordem`, `capitulo`, `versiculo`),
  KEY `idx_estudo_passagens_livro` (`versao_id`, `livro`, `capitulo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Anotações pessoais dos membros
CREATE TABLE IF NOT EXISTS `estudo_anotacoes` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo_ini` SMALLINT NOT NULL,
  `versiculo_fim` SMALLINT DEFAULT NULL,
  `texto`         TEXT DEFAULT NULL,
  `cor_realce`    VARCHAR(20) DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_anot_user` (`user_id`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Versículos favoritos dos membros
CREATE TABLE IF NOT EXISTS `estudo_favoritos` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo`     SMALLINT NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_fav` (`user_id`, `versao_id`, `livro`, `capitulo`, `versiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Planos de leitura e estudo temático
CREATE TABLE IF NOT EXISTS `estudo_planos` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT DEFAULT NULL COMMENT 'NULL = plano global LDFP',
  `titulo`        VARCHAR(255) NOT NULL,
  `descricao`     TEXT DEFAULT NULL,
  `tipo`          ENUM('leitura','tematico','devocional') NOT NULL DEFAULT 'leitura',
  `passos_json`   LONGTEXT NOT NULL COMMENT 'array JSON: [{dia, refs[]}]',
  `dias_total`    INT NOT NULL DEFAULT 0,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_planos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Acompanhamento de progresso nos planos por usuário
CREATE TABLE IF NOT EXISTS `estudo_progresso` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `plano_id`      INT NOT NULL,
  `passo_atual`   INT NOT NULL DEFAULT 0,
  `concluido`     TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_prog` (`user_id`, `plano_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Devocionais diários
CREATE TABLE IF NOT EXISTS `estudo_devocionais` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT DEFAULT NULL,
  `data_ref`      DATE NOT NULL,
  `titulo`        VARCHAR(255) NOT NULL,
  `versiculo_ref` VARCHAR(80) DEFAULT NULL,
  `corpo`         LONGTEXT NOT NULL,
  `oracao`        TEXT DEFAULT NULL,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_dev_data` (`data_ref`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;