-- ============================================================================
-- LDFP — Inovações Lote 8: Login com Google (painel)
-- Banco: MySQL 5.6 (sem tipo JSON, sem JSON_SET)
-- Rodar no phpMyAdmin de produção ANTES do ~/deploy.sh
-- Se aparecer "Duplicate column"/"Duplicate key name", já existe — pode ignorar.
-- O login com Google só aparece depois de colocar GOOGLE_CLIENT_ID no .env do servidor.
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN google_sub VARCHAR(64) NULL;      -- id fixo da conta Google vinculada
ALTER TABLE usuarios ADD COLUMN google_email VARCHAR(255) NULL;   -- e-mail da conta Google (exibição)
ALTER TABLE usuarios ADD COLUMN google_vinculado_em DATETIME NULL;
ALTER TABLE usuarios ADD UNIQUE INDEX uq_usuarios_google_sub (google_sub);

-- Desvincular o Google de alguém (ex.: trocou de conta Google):
-- UPDATE usuarios SET google_sub = NULL, google_email = NULL, google_vinculado_em = NULL WHERE email = 'email@do.usuario';
