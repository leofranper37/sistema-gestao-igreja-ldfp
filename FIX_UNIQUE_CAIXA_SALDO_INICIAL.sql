-- ============================================================
-- FIX: condição de corrida no saldo inicial do caixa
-- Execute no PhpMyAdmin do cPanel (aba SQL) ANTES do deploy do
-- código que usa upsertSaldoInicial (INSERT ... ON DUPLICATE KEY UPDATE)
-- ============================================================

-- 1. Remove duplicatas existentes para a mesma igreja+competência,
--    mantendo a linha mais recente (maior id) de cada par
DELETE t1 FROM caixa_saldo_inicial t1
INNER JOIN caixa_saldo_inicial t2
WHERE t1.igreja_id = t2.igreja_id
  AND t1.competencia = t2.competencia
  AND t1.id < t2.id;

-- 2. Garante unicidade daqui pra frente (impede duplo clique/corrida
--    de criar duas linhas de saldo inicial para o mesmo mês)
CREATE UNIQUE INDEX IF NOT EXISTS uq_csi_igreja_comp ON caixa_saldo_inicial (igreja_id, competencia);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
