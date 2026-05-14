-- ============================================================
-- SCRIPT COMPLETO DE SETUP DO BANCO DE DADOS - LDFP SISTEMA
-- Execute no PhpMyAdmin do cPanel (aba SQL)
-- Seguro para rodar em banco já existente (usa IF NOT EXISTS)
-- ============================================================

-- 1. TABELA PRINCIPAL: igrejas
-- ============================================================
CREATE TABLE IF NOT EXISTS igrejas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(255) NOT NULL UNIQUE,
    plano VARCHAR(100) NOT NULL DEFAULT 'teste-7-dias',
    status_assinatura VARCHAR(30) NOT NULL DEFAULT 'trial',
    trial_starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at DATETIME NULL,
    max_cadastros INT NOT NULL DEFAULT 40,
    max_congregacoes INT NOT NULL DEFAULT 1,
    modulo_app_membro TINYINT(1) NOT NULL DEFAULT 0,
    modulo_app_midia TINYINT(1) NOT NULL DEFAULT 0,
    modulo_ebd TINYINT(1) NOT NULL DEFAULT 0,
    modulo_agenda_eventos TINYINT(1) NOT NULL DEFAULT 1,
    modulo_escala_culto TINYINT(1) NOT NULL DEFAULT 0,
    modulo_pedidos_oracao TINYINT(1) NOT NULL DEFAULT 1,
    modulo_mural_oracao TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Colunas extras da tabela igrejas (adicionadas depois do lançamento)
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS responsavel VARCHAR(255) NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS email_admin VARCHAR(255) NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS telefone VARCHAR(60) NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS cnpj VARCHAR(30) NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS mensalidade_valor DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS ultimo_pagamento DATETIME NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS proximo_vencimento DATETIME NULL;
ALTER TABLE igrejas ADD COLUMN IF NOT EXISTS config_personalizada_json LONGTEXT NULL;

-- 2. TABELA: membros
-- ============================================================
CREATE TABLE IF NOT EXISTS membros (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL DEFAULT 1,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    telefone VARCHAR(60) NULL,
    apelido VARCHAR(120) NULL,
    nascimento VARCHAR(30) NULL,
    sexo VARCHAR(30) NULL,
    estado_civil VARCHAR(50) NULL,
    profissao VARCHAR(120) NULL,
    cep VARCHAR(30) NULL,
    endereco VARCHAR(255) NULL,
    numero VARCHAR(30) NULL,
    bairro VARCHAR(120) NULL,
    cidade VARCHAR(120) NULL,
    estado VARCHAR(60) NULL,
    celular VARCHAR(60) NULL,
    cpf VARCHAR(30) NULL,
    rg VARCHAR(30) NULL,
    nacionalidade VARCHAR(120) NULL,
    naturalidade VARCHAR(120) NULL,
    data_nascimento VARCHAR(30) NULL,
    situacao VARCHAR(30) DEFAULT 'Ativo',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_membros_igreja (igreja_id)
);

-- Coluna extra da tabela membros
ALTER TABLE membros ADD COLUMN IF NOT EXISTS app_senha VARCHAR(255) NULL;

-- 3. TABELA: usuarios
-- ============================================================
CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja VARCHAR(255) NOT NULL,
    igreja_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA: payment_links
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_links (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    payment_method VARCHAR(30) DEFAULT 'pix',
    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
    reference_code VARCHAR(255) NOT NULL UNIQUE,
    provider_external_id VARCHAR(255) NULL,
    url TEXT NULL,
    qr_code TEXT NULL,
    qr_code_base64 LONGTEXT NULL,
    status_detail TEXT NULL,
    plano_destino VARCHAR(120) NULL,
    plano_duracao_dias INT NOT NULL DEFAULT 30,
    modulos_json LONGTEXT NULL,
    paid_at DATETIME NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_links_igreja (igreja_id),
    INDEX idx_payment_links_reference (reference_code)
);

-- 5. TABELA: banco_contas
-- ============================================================
CREATE TABLE IF NOT EXISTS banco_contas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    banco VARCHAR(255) NULL,
    agencia VARCHAR(120) NULL,
    conta VARCHAR(120) NULL,
    tipo VARCHAR(50) NOT NULL DEFAULT 'corrente',
    saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
    observacao TEXT NULL,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_banco_contas_igreja (igreja_id)
);

-- 6. TABELA: banco_lancamentos
-- ============================================================
CREATE TABLE IF NOT EXISTS banco_lancamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conta_id INT NOT NULL,
    igreja_id INT NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    tipo VARCHAR(30) NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    data_lancamento DATE NOT NULL,
    observacao TEXT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_banco_lancamentos_conta (conta_id),
    INDEX idx_banco_lancamentos_igreja (igreja_id)
);

-- 7. TABELA: pedidos_oracao
-- ============================================================
CREATE TABLE IF NOT EXISTS pedidos_oracao (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL DEFAULT 1,
    solicitante VARCHAR(255) NOT NULL,
    alvo_oracao VARCHAR(255) NOT NULL,
    descricao TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ativo',
    is_private TINYINT(1) NOT NULL DEFAULT 0,
    resposta TEXT NULL,
    intercessores INT NOT NULL DEFAULT 0,
    usuario_id INT NULL,
    user_name VARCHAR(255) NULL,
    data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_atualizado DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pedidos_oracao_igreja (igreja_id),
    INDEX idx_pedidos_oracao_status (status)
);

-- 8. TABELA: oracao_intercessores
-- ============================================================
CREATE TABLE IF NOT EXISTS oracao_intercessores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_id INT NOT NULL,
    usuario_id INT NULL,
    nome_intercessor VARCHAR(255) NULL,
    data_intercessao DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_oracao_intercessores_pedido (pedido_id)
);

-- 9. TABELA: saas_planos
-- ============================================================
CREATE TABLE IF NOT EXISTS saas_planos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    slug VARCHAR(50) NOT NULL UNIQUE,
    nome VARCHAR(120) NOT NULL,
    subtitulo VARCHAR(255),
    versiculo TEXT,
    preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
    preco_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_cadastros INT NOT NULL DEFAULT 30,
    max_congregacoes INT NOT NULL DEFAULT 1,
    modulo_app_membro TINYINT(1) NOT NULL DEFAULT 0,
    features_json LONGTEXT,
    ativo TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE saas_planos ADD COLUMN IF NOT EXISTS versiculo TEXT NULL;

-- Dados padrão dos planos
INSERT IGNORE INTO saas_planos (slug,nome,subtitulo,preco_mensal,preco_anual,max_cadastros,max_congregacoes,modulo_app_membro,features_json) VALUES
    ('eden','Éden','O começo de tudo',0,0,30,1,0,'["App Web (PWA)","Até 30 cadastros","1 congregação","EBD Dominical","Grupos/Células","Financeiro (com limites)","Relatórios (com limites)"]'),
    ('hebrom','Hebrom','Igrejas em formação',50,540,150,1,0,'["App Web (PWA)","Até 150 cadastros","1 congregação","Suporte via e-mail"]'),
    ('betel','Betel','Igrejas em crescimento',80,864,300,5,1,'["App Web (PWA)","App do Membro","Até 300 cadastros","Até 5 congregações","Credencial de Membro","Grupos/Células","Suporte via e-mail","Suporte via WhatsApp"]'),
    ('siao','Sião','Igrejas consolidadas',100,1080,500,10,1,'["App Web (PWA)","App do Membro","Até 500 cadastros","Até 10 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via Telefone","Consultoria Contábil"]');

UPDATE saas_planos SET preco_anual=540 WHERE slug='hebrom' AND preco_anual=500;
UPDATE saas_planos SET preco_anual=864 WHERE slug='betel' AND preco_anual=800;
UPDATE saas_planos SET preco_anual=1080 WHERE slug='siao' AND preco_anual=1000;

-- 10. TABELA: password_reset_tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_prt_token (token),
    INDEX idx_prt_usuario (usuario_id)
);

-- ============================================================
-- FIM DO SCRIPT - Todas as tabelas e colunas criadas com sucesso!
-- ============================================================
