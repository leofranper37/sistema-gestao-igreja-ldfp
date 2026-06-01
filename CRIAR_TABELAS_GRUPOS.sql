-- ================================================================
-- Módulo: Grupos & Células + Congregados
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- ================================================================

CREATE TABLE IF NOT EXISTS `grupos` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `igreja_id`      INT NOT NULL,
  `nome`           VARCHAR(255) NOT NULL,
  `categoria`      VARCHAR(100) DEFAULT NULL,
  `situacao`       ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  `lider`          VARCHAR(255) DEFAULT NULL,
  `colider`        VARCHAR(255) DEFAULT NULL,
  `telefone_lider` VARCHAR(50) DEFAULT NULL,
  `email_lider`    VARCHAR(255) DEFAULT NULL,
  `dia_semana`     VARCHAR(50) DEFAULT NULL,
  `horario`        VARCHAR(50) DEFAULT NULL,
  `local`          VARCHAR(255) DEFAULT NULL,
  `max_membros`    INT DEFAULT NULL,
  `descricao`      TEXT DEFAULT NULL,
  `created_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_grupos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grupo_membros` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `grupo_id`   INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `membro_id`  INT DEFAULT NULL,
  `nome`       VARCHAR(255) NOT NULL,
  `funcao`     VARCHAR(100) DEFAULT NULL,
  `desde`      DATE DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gm_grupo`   (`grupo_id`),
  KEY `idx_gm_igreja`  (`igreja_id`),
  KEY `idx_gm_membro`  (`membro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grupo_reunioes` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `grupo_id`   INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `data`       DATE NOT NULL,
  `tema`       VARCHAR(255) DEFAULT NULL,
  `presentes`  INT NOT NULL DEFAULT 0,
  `obs`        TEXT DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gr_grupo`  (`grupo_id`),
  KEY `idx_gr_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `congregados` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT NOT NULL,
  `nome`          VARCHAR(255) NOT NULL,
  `nascimento`    DATE DEFAULT NULL,
  `sexo`          VARCHAR(20) DEFAULT NULL,
  `estado_civil`  VARCHAR(50) DEFAULT NULL,
  `cpf`           VARCHAR(20) DEFAULT NULL,
  `cep`           VARCHAR(10) DEFAULT NULL,
  `endereco`      VARCHAR(255) DEFAULT NULL,
  `numero`        VARCHAR(20) DEFAULT NULL,
  `bairro`        VARCHAR(100) DEFAULT NULL,
  `cidade`        VARCHAR(100) DEFAULT NULL,
  `estado`        VARCHAR(10) DEFAULT NULL,
  `telefone`      VARCHAR(30) DEFAULT NULL,
  `celular`       VARCHAR(30) DEFAULT NULL,
  `email`         VARCHAR(255) DEFAULT NULL,
  `data_cadastro` DATE DEFAULT NULL,
  `obs`           TEXT DEFAULT NULL,
  `foto_url`      VARCHAR(500) DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cong_igreja` (`igreja_id`),
  KEY `idx_cong_nome`   (`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
