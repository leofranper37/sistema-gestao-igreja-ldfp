-- ============================================================================
-- LDFP — Inovações Lote 7: Verificação em duas etapas (app autenticador / TOTP)
-- Banco: MySQL 5.6 (sem tipo JSON, sem JSON_SET)
-- Rodar no phpMyAdmin de produção ANTES do ~/deploy.sh
-- Se aparecer "Duplicate column", a coluna já existe — pode ignorar e seguir.
-- ============================================================================

ALTER TABLE usuarios ADD COLUMN totp_secret VARCHAR(255) NULL;          -- segredo CRIPTOGRAFADO (AES-256-GCM)
ALTER TABLE usuarios ADD COLUMN totp_ativo TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN totp_recuperacao TEXT NULL;             -- hashes SHA-256 dos códigos de recuperação (texto)
ALTER TABLE usuarios ADD COLUMN totp_ultimo_passo INT NULL;             -- impede reutilizar o mesmo código
ALTER TABLE usuarios ADD COLUMN totp_ativado_em DATETIME NULL;

-- EMERGÊNCIA (perdeu o celular E os códigos de recuperação):
-- UPDATE usuarios SET totp_ativo = 0, totp_secret = NULL, totp_recuperacao = NULL WHERE email = 'email@do.usuario';
