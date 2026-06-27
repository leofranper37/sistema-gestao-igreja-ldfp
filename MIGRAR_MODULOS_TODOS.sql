-- ================================================================
-- MIGRAÇÃO UNIFICADA — Todos os módulos pendentes
-- Banco: ldfp8965_sistema_gestao
-- Executar no phpMyAdmin (aba SQL)
-- Seguro re-executar: usa CREATE TABLE IF NOT EXISTS
-- MySQL 5.6 compatível: sem JSON, sem IF NOT EXISTS em ALTER
-- ================================================================

-- ============================================================
-- 1. EBD (Escola Bíblica Dominical)
-- ============================================================

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
  KEY `idx_ebd_turmas_igreja`   (`igreja_id`),
  KEY `idx_ebd_turmas_situacao` (`situacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ebd_alunos` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `igreja_id`    INT NOT NULL,
  `turma_id`     INT          DEFAULT NULL,
  `nome`         VARCHAR(255) NOT NULL,
  `matricula`    VARCHAR(60)  DEFAULT NULL,
  `estagio`      VARCHAR(100) DEFAULT NULL,
  `situacao`     VARCHAR(30)  NOT NULL DEFAULT 'Ativo',
  `sexo`         VARCHAR(20)  DEFAULT NULL,
  `nascimento`   DATE         DEFAULT NULL,
  `estado_civil` VARCHAR(50)  DEFAULT NULL,
  `profissao`    VARCHAR(120) DEFAULT NULL,
  `responsavel`  VARCHAR(255) DEFAULT NULL,
  `telefone`     VARCHAR(60)  DEFAULT NULL,
  `celular`      VARCHAR(60)  DEFAULT NULL,
  `email`        VARCHAR(255) DEFAULT NULL,
  `cep`          VARCHAR(10)  DEFAULT NULL,
  `endereco`     VARCHAR(255) DEFAULT NULL,
  `bairro`       VARCHAR(120) DEFAULT NULL,
  `cidade`       VARCHAR(120) DEFAULT NULL,
  `estado`       VARCHAR(10)  DEFAULT NULL,
  `obs`          TEXT         DEFAULT NULL,
  `revista_info` LONGTEXT     DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebd_alunos_igreja`   (`igreja_id`),
  KEY `idx_ebd_alunos_turma`    (`turma_id`),
  KEY `idx_ebd_alunos_situacao` (`situacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ebd_apontamentos` (
  `id`                 INT NOT NULL AUTO_INCREMENT,
  `igreja_id`          INT NOT NULL,
  `turma_id`           INT           DEFAULT NULL,
  `data`               DATE          NOT NULL,
  `licao_numero`       VARCHAR(20)   DEFAULT NULL,
  `licao_titulo`       VARCHAR(255)  DEFAULT NULL,
  `professor_presente` VARCHAR(255)  DEFAULT NULL,
  `visitantes`         INT           NOT NULL DEFAULT 0,
  `oferta`             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `biblias`            INT           NOT NULL DEFAULT 0,
  `revistas`           INT           NOT NULL DEFAULT 0,
  `obs`                TEXT          DEFAULT NULL,
  `created_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`         DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ebd_apt_igreja` (`igreja_id`),
  KEY `idx_ebd_apt_turma`  (`turma_id`),
  KEY `idx_ebd_apt_data`   (`data`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `ebd_presenca` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `igreja_id`      INT NOT NULL,
  `apontamento_id` INT NOT NULL,
  `aluno_id`       INT NOT NULL,
  `presente`       TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_ebd_presenca`     (`apontamento_id`, `aluno_id`),
  KEY  `idx_ebd_presenca_igreja`     (`igreja_id`),
  KEY  `idx_ebd_presenca_aluno`      (`aluno_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. Batismos
-- ============================================================

CREATE TABLE IF NOT EXISTS `batismos` (
  `id`              INT NOT NULL AUTO_INCREMENT,
  `igreja_id`       INT NOT NULL,
  `descricao`       VARCHAR(255) NOT NULL,
  `data_batismo`    DATE         DEFAULT NULL,
  `horario`         VARCHAR(10)  DEFAULT NULL,
  `local_batismo`   VARCHAR(255) DEFAULT NULL,
  `pastor`          VARCHAR(255) DEFAULT NULL,
  `encerrado`       ENUM('Não','Sim') NOT NULL DEFAULT 'Não',
  `congregacao`     VARCHAR(255) DEFAULT NULL,
  `data_aula`       DATE         DEFAULT NULL,
  `professor_aula`  VARCHAR(255) DEFAULT NULL,
  `local_aula`      VARCHAR(255) DEFAULT NULL,
  `obs`             TEXT         DEFAULT NULL,
  `total_batizados` INT          DEFAULT 0,
  `fotografo`       VARCHAR(255) DEFAULT NULL,
  `link_midia`      VARCHAR(500) DEFAULT NULL,
  `created_by`      INT          DEFAULT NULL,
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_batismos_igreja` (`igreja_id`),
  KEY `idx_batismos_data`   (`data_batismo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batismo_candidatos` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `batismo_id` INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `nome`       VARCHAR(255) NOT NULL,
  `telefone`   VARCHAR(50)  DEFAULT NULL,
  `status`     ENUM('Pendente','Confirmado','Desistiu') NOT NULL DEFAULT 'Pendente',
  `membro_id`  INT          DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_bat_cand_batismo` (`batismo_id`),
  KEY `idx_bat_cand_membro`  (`membro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 3. Escalas de Serviço
-- ============================================================

CREATE TABLE IF NOT EXISTS `escalas_grupos` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `church_id`  INT NOT NULL,
  `name`       VARCHAR(255) NOT NULL,
  `parent_id`  INT          DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_grupos_church` (`church_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_funcoes` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `church_id`    INT NOT NULL,
  `group_id`     INT NOT NULL,
  `name`         VARCHAR(255) NOT NULL,
  `max_quantity` INT          DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_esc_funcoes_church` (`church_id`),
  KEY `idx_esc_funcoes_group`  (`group_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `escalas_eventos` (
  `id`                  INT NOT NULL AUTO_INCREMENT,
  `church_id`           INT NOT NULL,
  `title`               VARCHAR(255) NOT NULL,
  `start_date`          DATE         NOT NULL,
  `recurrence_type`     ENUM('none','weekly','biweekly','monthly') NOT NULL DEFAULT 'none',
  `recurrence_end_date` DATE         DEFAULT NULL,
  `created_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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
  `instance_date` DATE         NOT NULL,
  `is_cancelled`  TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
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
  UNIQUE KEY `uniq_atrib`          (`instance_id`, `function_id`, `member_id`),
  KEY `idx_esc_atrib_inst`         (`instance_id`),
  KEY `idx_esc_atrib_member`       (`member_id`),
  KEY `idx_esc_atrib_church`       (`church_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 4. Grupos & Células
-- ============================================================

CREATE TABLE IF NOT EXISTS `grupos` (
  `id`             INT NOT NULL AUTO_INCREMENT,
  `igreja_id`      INT NOT NULL,
  `nome`           VARCHAR(255) NOT NULL,
  `categoria`      VARCHAR(100) DEFAULT NULL,
  `situacao`       ENUM('Ativo','Inativo') NOT NULL DEFAULT 'Ativo',
  `lider`          VARCHAR(255) DEFAULT NULL,
  `colider`        VARCHAR(255) DEFAULT NULL,
  `telefone_lider` VARCHAR(50)  DEFAULT NULL,
  `email_lider`    VARCHAR(255) DEFAULT NULL,
  `dia_semana`     VARCHAR(50)  DEFAULT NULL,
  `horario`        VARCHAR(50)  DEFAULT NULL,
  `local`          VARCHAR(255) DEFAULT NULL,
  `max_membros`    INT          DEFAULT NULL,
  `descricao`      TEXT         DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_grupos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grupo_membros` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `grupo_id`   INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `membro_id`  INT          DEFAULT NULL,
  `nome`       VARCHAR(255) NOT NULL,
  `funcao`     VARCHAR(100) DEFAULT NULL,
  `desde`      DATE         DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gm_grupo`  (`grupo_id`),
  KEY `idx_gm_igreja` (`igreja_id`),
  KEY `idx_gm_membro` (`membro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `grupo_reunioes` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `grupo_id`   INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `data`       DATE         NOT NULL,
  `tema`       VARCHAR(255) DEFAULT NULL,
  `presentes`  INT          NOT NULL DEFAULT 0,
  `obs`        TEXT         DEFAULT NULL,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gr_grupo`  (`grupo_id`),
  KEY `idx_gr_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 5. Bíblia & Estudo
-- ============================================================

CREATE TABLE IF NOT EXISTS `estudo_versoes` (
  `id`           INT NOT NULL AUTO_INCREMENT,
  `codigo`       VARCHAR(20)  NOT NULL,
  `nome`         VARCHAR(120) NOT NULL,
  `idioma`       VARCHAR(10)  NOT NULL DEFAULT 'pt',
  `licenca_nota` VARCHAR(255) DEFAULT NULL,
  `ativo`        TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_versoes_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_passagens` (
  `id`          INT      NOT NULL AUTO_INCREMENT,
  `versao_id`   INT      NOT NULL,
  `livro`       VARCHAR(40) NOT NULL,
  `livro_ordem` SMALLINT NOT NULL,
  `capitulo`    SMALLINT NOT NULL,
  `versiculo`   SMALLINT NOT NULL,
  `texto`       TEXT     NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_passagens_ref`   (`versao_id`, `livro_ordem`, `capitulo`, `versiculo`),
  KEY `idx_estudo_passagens_livro` (`versao_id`, `livro`, `capitulo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_anotacoes` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `capitulo`      SMALLINT    NOT NULL,
  `versiculo_ini` SMALLINT    NOT NULL,
  `versiculo_fim` SMALLINT    DEFAULT NULL,
  `texto`         TEXT        DEFAULT NULL,
  `cor_realce`    VARCHAR(20) DEFAULT NULL,
  `created_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_anot_user` (`user_id`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_favoritos` (
  `id`         INT NOT NULL AUTO_INCREMENT,
  `user_id`    INT NOT NULL,
  `igreja_id`  INT NOT NULL,
  `versao_id`  INT NOT NULL,
  `livro`      VARCHAR(40) NOT NULL,
  `capitulo`   SMALLINT    NOT NULL,
  `versiculo`  SMALLINT    NOT NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_fav` (`user_id`, `versao_id`, `livro`, `capitulo`, `versiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_planos` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `igreja_id`   INT          DEFAULT NULL,
  `titulo`      VARCHAR(255) NOT NULL,
  `descricao`   TEXT         DEFAULT NULL,
  `tipo`        ENUM('leitura','tematico','devocional') NOT NULL DEFAULT 'leitura',
  `passos_json` LONGTEXT     NOT NULL,
  `dias_total`  INT          NOT NULL DEFAULT 0,
  `ativo`       TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_planos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_progresso` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `user_id`     INT NOT NULL,
  `igreja_id`   INT NOT NULL,
  `plano_id`    INT NOT NULL,
  `passo_atual` INT NOT NULL DEFAULT 0,
  `concluido`   TINYINT(1)   NOT NULL DEFAULT 0,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_prog` (`user_id`, `plano_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_devocionais` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT          DEFAULT NULL,
  `data_ref`      DATE         NOT NULL,
  `titulo`        VARCHAR(255) NOT NULL,
  `versiculo_ref` VARCHAR(80)  DEFAULT NULL,
  `corpo`         LONGTEXT     NOT NULL,
  `oracao`        TEXT         DEFAULT NULL,
  `ativo`         TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_dev_data` (`data_ref`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 6. Visitantes — Follow-up e consolidação
-- ============================================================

-- Adiciona colunas na tabela visitantes (ignora erro se já existir)
ALTER TABLE `visitantes` ADD COLUMN `status_consolidacao` VARCHAR(50) DEFAULT 'Novo';
ALTER TABLE `visitantes` ADD COLUMN `responsavel_id` INT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS `visitante_followup` (
  `id`               INT NOT NULL AUTO_INCREMENT,
  `igreja_id`        INT NOT NULL,
  `visitante_id`     INT NOT NULL,
  `tipo_contato`     VARCHAR(50)  NOT NULL,
  `observacao`       TEXT         NOT NULL,
  `data_contato`     DATETIME     DEFAULT CURRENT_TIMESTAMP,
  `responsavel_nome` VARCHAR(255) DEFAULT NULL,
  `created_at`       DATETIME     DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vf_visitante` (`visitante_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 7. Redefinição de senha (esqueci minha senha)
-- ============================================================

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `id`          INT NOT NULL AUTO_INCREMENT,
  `usuario_id`  INT          NOT NULL,
  `token`       VARCHAR(128) NOT NULL,
  `expires_at`  DATETIME     NOT NULL,
  `used`        TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prt_token`   (`token`),
  KEY  `idx_prt_usuario`      (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- FIM
-- ============================================================
SELECT 'MIGRAÇÃO COMPLETA — todos os módulos criados com sucesso' AS resultado;
