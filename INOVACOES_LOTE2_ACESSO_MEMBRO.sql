-- ================================================================
-- Inovações — Lote 2: Acesso do Membro (ficha preenchida pelo membro)
-- Banco: ldfp8965_sistema_gestao  (MySQL 5.6 — rodar no phpMyAdmin)
-- Rode ANTES do ~/deploy.sh. Se der "Duplicate column name", já foi aplicado.
-- ================================================================

-- Ficha completa enviada pelo membro (texto JSON guardado em LONGTEXT — MySQL 5.6 não tem tipo JSON)
ALTER TABLE `autocadastros`
  ADD COLUMN `dados_ficha` LONGTEXT NULL;
