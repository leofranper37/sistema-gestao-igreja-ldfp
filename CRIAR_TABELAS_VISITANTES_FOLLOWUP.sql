-- ================================================================
-- Módulo: Acompanhamento de Visitantes (Follow-up e Consolidação)
-- Executar no banco: ldfp8965_sistema_gestao (via phpMyAdmin)
-- ================================================================

-- 1. Adicionando campos de status na tabela existente (Ignorar se der erro caso já exista)
ALTER TABLE `visitantes` ADD COLUMN `status_consolidacao` VARCHAR(50) DEFAULT 'Novo';
ALTER TABLE `visitantes` ADD COLUMN `responsavel_id` INT DEFAULT NULL;

-- 2. Tabela de histórico de contatos com o visitante
CREATE TABLE IF NOT EXISTS `visitante_followup` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `igreja_id` INT NOT NULL,
  `visitante_id` INT NOT NULL,
  `tipo_contato` VARCHAR(50) NOT NULL COMMENT 'Ligação, WhatsApp, Visita, E-mail',
  `observacao` TEXT NOT NULL,
  `data_contato` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `responsavel_nome` VARCHAR(255) DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vf_visitante` (`visitante_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;