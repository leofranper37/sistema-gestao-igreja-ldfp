-- =====================================================================
-- FIX_TRIAL_ABSURDO.sql  (MySQL 5.6)
-- Corrige igrejas com período de teste absurdo (ex.: trial_ends_at em 2099,
-- que aparece no painel como "26710 dia(s) restante(s)").
--
-- COMO USAR (phpMyAdmin > banco ldfp8965_sistema_gestao > aba SQL):
--   1) Rode SOMENTE o PASSO 1 (SELECT) e anote os ids que aparecerem.
--   2) Decida, igreja por igreja, a nova data de fim do trial.
--   3) No PASSO 2, tire o "-- " da frente do UPDATE, troque 999 pelo id
--      e rode um UPDATE por vez.
-- Nada aqui apaga dados. A igreja LDFP Master (is_system = 1) nunca é tocada.
-- =====================================================================

-- PASSO 1 — Diagnóstico: igrejas clientes com trial terminando daqui a mais de 1 ano
SELECT id,
       nome,
       status_assinatura,
       trial_starts_at,
       trial_ends_at,
       DATEDIFF(trial_ends_at, NOW()) AS dias_restantes
FROM igrejas
WHERE is_system = 0
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at > DATE_ADD(NOW(), INTERVAL 1 YEAR)
ORDER BY trial_ends_at DESC;

-- PASSO 2 — Ajuste (um id por vez). Escolha UMA das opções abaixo.

-- Opção A: dar mais 30 dias de teste a partir de hoje
-- UPDATE igrejas SET trial_ends_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = 999 AND is_system = 0;

-- Opção B: o cliente já paga — marcar como ativa e limpar o fim do trial
-- UPDATE igrejas SET status_assinatura = 'ativa', trial_ends_at = NULL WHERE id = 999 AND is_system = 0;

-- PASSO 3 — Conferência: rode o PASSO 1 de novo; não deve voltar nenhuma linha.
