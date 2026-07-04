-- SQL para criar tabelas ausentes no banco de produção
-- Rodar no phpMyAdmin em: ldfp8965_sistema_gestao
-- Todas as tabelas usam CREATE TABLE IF NOT EXISTS — seguro rodar mesmo se já existirem

-- ── EBD ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ebd_turmas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    nome VARCHAR(255) NOT NULL,
    ano VARCHAR(10) NULL,
    estagio VARCHAR(100) NULL,
    situacao VARCHAR(30) DEFAULT 'Ativo',
    professor VARCHAR(255) NULL,
    segundo_professor VARCHAR(255) NULL,
    telefone_professor VARCHAR(60) NULL,
    email_professor VARCHAR(255) NULL,
    dia_semana VARCHAR(30) NULL,
    horario VARCHAR(30) NULL,
    sala VARCHAR(100) NULL,
    revista_info LONGTEXT NULL,
    licoes LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ebd_turmas_igreja (igreja_id)
);

CREATE TABLE IF NOT EXISTS ebd_alunos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    turma_id INT NULL,
    nome VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) NULL,
    estagio VARCHAR(100) NULL,
    situacao VARCHAR(30) DEFAULT 'Ativo',
    sexo VARCHAR(20) NULL,
    nascimento DATE NULL,
    estado_civil VARCHAR(50) NULL,
    profissao VARCHAR(120) NULL,
    responsavel VARCHAR(255) NULL,
    telefone VARCHAR(60) NULL,
    celular VARCHAR(60) NULL,
    email VARCHAR(255) NULL,
    cep VARCHAR(20) NULL,
    endereco VARCHAR(255) NULL,
    bairro VARCHAR(120) NULL,
    cidade VARCHAR(120) NULL,
    estado VARCHAR(60) NULL,
    obs TEXT NULL,
    revista_info LONGTEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_ebd_alunos_igreja (igreja_id),
    INDEX idx_ebd_alunos_turma (turma_id)
);

CREATE TABLE IF NOT EXISTS ebd_apontamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turma_id INT NULL,
    igreja_id INT NOT NULL,
    data DATE NULL,
    licao_numero VARCHAR(30) NULL,
    licao_titulo VARCHAR(255) NULL,
    professor_presente VARCHAR(50) NULL,
    visitantes INT DEFAULT 0,
    oferta DECIMAL(10,2) DEFAULT 0,
    biblias INT DEFAULT 0,
    revistas INT DEFAULT 0,
    obs TEXT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ebd_apontamentos_igreja (igreja_id),
    INDEX idx_ebd_apontamentos_turma (turma_id)
);

CREATE TABLE IF NOT EXISTS ebd_presenca (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    apontamento_id INT NOT NULL,
    aluno_id INT NOT NULL,
    presente TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ebd_presenca_apt (apontamento_id),
    INDEX idx_ebd_presenca_aluno (aluno_id)
);

-- ── Escalas ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS escalas_eventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    church_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    start_date DATE NULL,
    recurrence_type VARCHAR(30) DEFAULT 'none',
    recurrence_end_date DATE NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_escalas_eventos_church (church_id)
);

CREATE TABLE IF NOT EXISTS escalas_instancias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    church_id INT NOT NULL,
    instance_date DATE NULL,
    is_cancelled TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_escalas_inst_event (event_id),
    INDEX idx_escalas_inst_church (church_id)
);

CREATE TABLE IF NOT EXISTS escalas_evento_funcoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    function_id INT NOT NULL,
    INDEX idx_escalas_ef_event (event_id)
);

CREATE TABLE IF NOT EXISTS escalas_grupos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    church_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    parent_id INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_escalas_grupos_church (church_id)
);

CREATE TABLE IF NOT EXISTS escalas_funcoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    church_id INT NOT NULL,
    group_id INT NULL,
    name VARCHAR(255) NOT NULL,
    max_quantity INT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_escalas_funcoes_church (church_id),
    INDEX idx_escalas_funcoes_group (group_id)
);

CREATE TABLE IF NOT EXISTS escalas_atribuicoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instance_id INT NOT NULL,
    function_id INT NOT NULL,
    member_id INT NOT NULL,
    church_id INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_escalas_atr_inst (instance_id),
    INDEX idx_escalas_atr_church (church_id)
);

-- ── Estudo / Ensino ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS estudo_versoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nome VARCHAR(120) NOT NULL,
    idioma VARCHAR(30) DEFAULT 'pt',
    licenca_nota TEXT NULL,
    ativo TINYINT(1) DEFAULT 1
);

CREATE TABLE IF NOT EXISTS estudo_passagens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    versao_id INT NOT NULL,
    livro VARCHAR(60) NOT NULL,
    capitulo INT NOT NULL,
    versiculo INT NOT NULL,
    texto TEXT NOT NULL,
    INDEX idx_ep_versao (versao_id),
    INDEX idx_ep_ref (versao_id, livro(30), capitulo, versiculo)
);

CREATE TABLE IF NOT EXISTS estudo_planos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NULL,
    titulo VARCHAR(255) NOT NULL,
    descricao TEXT NULL,
    tipo VARCHAR(50) DEFAULT 'leitura',
    passos_json LONGTEXT NULL,
    dias_total INT DEFAULT 0,
    ativo TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_estudo_planos_igreja (igreja_id)
);

CREATE TABLE IF NOT EXISTS estudo_progresso (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    igreja_id INT NOT NULL,
    plano_id INT NOT NULL,
    passo_atual INT DEFAULT 0,
    concluido TINYINT(1) DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_progresso (user_id, plano_id),
    INDEX idx_prog_user (user_id)
);

CREATE TABLE IF NOT EXISTS estudo_anotacoes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    igreja_id INT NOT NULL,
    versao_id INT NOT NULL,
    livro VARCHAR(60) NOT NULL,
    capitulo INT NOT NULL,
    versiculo_ini INT NOT NULL,
    versiculo_fim INT NULL,
    texto TEXT NULL,
    cor_realce VARCHAR(20) NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_anot_user (user_id, igreja_id)
);

CREATE TABLE IF NOT EXISTS estudo_favoritos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    igreja_id INT NOT NULL,
    versao_id INT NOT NULL,
    livro VARCHAR(60) NOT NULL,
    capitulo INT NOT NULL,
    versiculo INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_favorito (user_id, versao_id, livro(30), capitulo, versiculo),
    INDEX idx_fav_user (user_id, igreja_id)
);

CREATE TABLE IF NOT EXISTS estudo_devocionais (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NULL,
    data_ref DATE NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    versiculo_ref VARCHAR(255) NULL,
    corpo TEXT NOT NULL,
    oracao TEXT NULL,
    ativo TINYINT(1) DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_dev_data (data_ref),
    INDEX idx_dev_igreja (igreja_id)
);

-- ── Caixa ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS caixa_meses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    mes_competencia VARCHAR(7) NOT NULL,
    saldo_inicial DECIMAL(14,2) DEFAULT 0,
    observacao TEXT NULL,
    ativo TINYINT(1) DEFAULT 1,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_caixa_mes (igreja_id, mes_competencia),
    INDEX idx_caixa_mes_igreja (igreja_id)
);

CREATE TABLE IF NOT EXISTS caixa_lancamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id INT NOT NULL,
    data DATE NULL,
    doc VARCHAR(50) NULL,
    historico VARCHAR(500) NOT NULL,
    valor DECIMAL(14,2) NOT NULL DEFAULT 0,
    tipo VARCHAR(10) NOT NULL DEFAULT 'ENTRADA',
    observacao TEXT NULL,
    created_by INT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_caixa_lanc_igreja (igreja_id),
    INDEX idx_caixa_lanc_data (data)
);
