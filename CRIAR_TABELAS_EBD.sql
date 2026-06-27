-- ================================================================
-- Módulo: EBD (Escola Bíblica Dominical)
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- Compatível com MySQL 5.6 — sem tipo JSON, usa LONGTEXT
-- ================================================================

-- 1. Turmas da EBD
CREATE TABLE IF NOT EXISTS `ebd_turmas` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `igreja_id`         INT NOT NULL,
  `nome`              VARCHAR(255) NOT NULL,
  `ano`               VARCHAR(10)  DEFAULT NULL,
  `estagio`           VARCHAR(100) DEFAULT NULL,
  `situacao`          VARCHAR(30)  NOT NULL DEFAULT 'Ativo',
  `professor`         VARCHAR(255) DEFAULT NULL,
  `segundo_professor` VARCHAR(255) DEFAULT NULL,
  `telefone_professor`VARCHAR(60)  DEFAULT NULL,
  `email_professor`   VARCHAR(255) DEFAULT NULL,
  `dia_semana`        VARCHAR(50)  DEFAULT NULL,
  `horario`           VARCHAR(30)  DEFAULT NULL,
  `sala`              VARCHAR(120) DEFAULT NULL,
  `revista_info`      LONGTEXT     DEFAULT NULL,
  `licoes`            LONGTEXT     DEFAULT NULL,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebd_turmas_igreja` (`igreja_id`),
  KEY `idx_ebd_turmas_situacao` (`situacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Alunos da EBD
CREATE TABLE IF NOT EXISTS `ebd_alunos` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `igreja_id`   INT NOT NULL,
  `turma_id`    INT          DEFAULT NULL,
  `nome`        VARCHAR(255) NOT NULL,
  `matricula`   VARCHAR(60)  DEFAULT NULL,
  `estagio`     VARCHAR(100) DEFAULT NULL,
  `situacao`    VARCHAR(30)  NOT NULL DEFAULT 'Ativo',
  `sexo`        VARCHAR(20)  DEFAULT NULL,
  `nascimento`  DATE         DEFAULT NULL,
  `estado_civil`VARCHAR(50)  DEFAULT NULL,
  `profissao`   VARCHAR(120) DEFAULT NULL,
  `responsavel` VARCHAR(255) DEFAULT NULL,
  `telefone`    VARCHAR(60)  DEFAULT NULL,
  `celular`     VARCHAR(60)  DEFAULT NULL,
  `email`       VARCHAR(255) DEFAULT NULL,
  `cep`         VARCHAR(10)  DEFAULT NULL,
  `endereco`    VARCHAR(255) DEFAULT NULL,
  `bairro`      VARCHAR(120) DEFAULT NULL,
  `cidade`      VARCHAR(120) DEFAULT NULL,
  `estado`      VARCHAR(10)  DEFAULT NULL,
  `obs`         TEXT         DEFAULT NULL,
  `revista_info`LONGTEXT     DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebd_alunos_igreja`  (`igreja_id`),
  KEY `idx_ebd_alunos_turma`   (`turma_id`),
  KEY `idx_ebd_alunos_situacao`(`situacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Apontamentos de aula (chamada + estatísticas)
CREATE TABLE IF NOT EXISTS `ebd_apontamentos` (
  `id`                INT NOT NULL AUTO_INCREMENT,
  `igreja_id`         INT NOT NULL,
  `turma_id`          INT          DEFAULT NULL,
  `data`              DATE         NOT NULL,
  `licao_numero`      VARCHAR(20)  DEFAULT NULL,
  `licao_titulo`      VARCHAR(255) DEFAULT NULL,
  `professor_presente`VARCHAR(255) DEFAULT NULL,
  `visitantes`        INT          NOT NULL DEFAULT 0,
  `oferta`            DECIMAL(12,2)NOT NULL DEFAULT 0.00,
  `biblias`           INT          NOT NULL DEFAULT 0,
  `revistas`          INT          NOT NULL DEFAULT 0,
  `obs`               TEXT         DEFAULT NULL,
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebd_apt_igreja` (`igreja_id`),
  KEY `idx_ebd_apt_turma`  (`turma_id`),
  KEY `idx_ebd_apt_data`   (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Presença individual por apontamento
CREATE TABLE IF NOT EXISTS `ebd_presenca` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `igreja_id`      INT NOT NULL,
  `apontamento_id` INT NOT NULL,
  `aluno_id`       INT NOT NULL,
  `presente`       TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ebd_presenca` (`apontamento_id`, `aluno_id`),
  KEY `idx_ebd_presenca_igreja` (`igreja_id`),
  KEY `idx_ebd_presenca_aluno`  (`aluno_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
