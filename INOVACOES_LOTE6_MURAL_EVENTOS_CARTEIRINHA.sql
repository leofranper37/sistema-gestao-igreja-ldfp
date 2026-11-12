-- ============================================================================
-- LDFP — Inovações Lote 6: Mural da Igreja, Inscrição em Eventos, Carteirinha
-- Banco: MySQL 5.6 (sem tipo JSON, sem JSON_SET)
-- Rodar no phpMyAdmin de produção ANTES do ~/deploy.sh
-- A carteirinha NÃO precisa de tabela (o QR é assinado com HMAC).
-- Se alguma coluna já existir, o ALTER dá erro "Duplicate column" — pode ignorar
-- e seguir com as linhas seguintes.
-- ============================================================================

-- ── MURAL ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mural_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    autor_tipo VARCHAR(10) NOT NULL,            -- 'equipe' (usuario) | 'membro' (app)
    autor_id INT NULL,
    autor_nome VARCHAR(150) NULL,
    texto TEXT NOT NULL,
    fixado TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(15) NOT NULL DEFAULT 'publicado', -- publicado | pendente | oculto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NULL,
    INDEX idx_mural_posts_igreja (igreja_id, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mural_comentarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    post_id INT NOT NULL,
    autor_tipo VARCHAR(10) NOT NULL,
    autor_id INT NULL,
    autor_nome VARCHAR(150) NULL,
    texto TEXT NOT NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'publicado', -- publicado | oculto
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_mural_coment_post (igreja_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mural_reacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    post_id INT NOT NULL,
    autor_tipo VARCHAR(10) NOT NULL,
    autor_id INT NOT NULL,
    tipo VARCHAR(15) NOT NULL,                  -- amem | orando | gratidao | curtir
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mural_reacao (post_id, autor_tipo, autor_id),
    INDEX idx_mural_reacoes_igreja (igreja_id, post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mural_denuncias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    alvo_tipo VARCHAR(12) NOT NULL,             -- post | comentario
    alvo_id INT NOT NULL,
    autor_tipo VARCHAR(10) NOT NULL,
    autor_id INT NOT NULL,
    motivo VARCHAR(255) NULL,
    resolvida TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_mural_denuncia (alvo_tipo, alvo_id, autor_tipo, autor_id),
    INDEX idx_mural_denuncias_igreja (igreja_id, resolvida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS mural_config (
    igreja_id INT NOT NULL PRIMARY KEY,
    membros_publicam TINYINT(1) NOT NULL DEFAULT 1,
    exige_aprovacao TINYINT(1) NOT NULL DEFAULT 1,
    comentarios TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── EVENTOS COM INSCRIÇÃO ──────────────────────────────────────────────────
ALTER TABLE agenda_eventos ADD COLUMN inscricao_aberta TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE agenda_eventos ADD COLUMN vagas INT NULL;
ALTER TABLE agenda_eventos ADD COLUMN inscricao_ate DATETIME NULL;

CREATE TABLE IF NOT EXISTS evento_inscricoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    evento_id INT NOT NULL,
    membro_id INT NOT NULL,
    nome VARCHAR(150) NULL,
    celular VARCHAR(30) NULL,
    status VARCHAR(15) NOT NULL DEFAULT 'inscrito', -- inscrito | cancelado
    presente TINYINT(1) NOT NULL DEFAULT 0,
    presente_em DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_evento_membro (evento_id, membro_id),
    INDEX idx_evento_inscricoes_igreja (igreja_id, evento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
