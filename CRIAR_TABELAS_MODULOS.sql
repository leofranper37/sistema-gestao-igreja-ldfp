-- ============================================================
-- MIGRAÇÃO: Tabelas do catálogo de módulos SaaS
-- Execute no PhpMyAdmin do cPanel (aba SQL)
-- Seguro para rodar em banco já existente (usa IF NOT EXISTS)
-- ============================================================

-- 1. Catálogo de módulos disponíveis no SaaS
CREATE TABLE IF NOT EXISTS saas_modulos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    slug          VARCHAR(100) NOT NULL UNIQUE,
    nome          VARCHAR(255) NOT NULL,
    descricao     TEXT NULL,
    icon          VARCHAR(120) NOT NULL DEFAULT 'fa-puzzle-piece',
    feature_key   VARCHAR(120) NOT NULL,
    route_path    VARCHAR(255) NULL,
    ativo         TINYINT(1) NOT NULL DEFAULT 1,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_saas_modulos_slug (slug),
    INDEX idx_saas_modulos_ativo (ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. Vínculo de módulos por plano (quais módulos estão habilitados em cada plano)
CREATE TABLE IF NOT EXISTS saas_plano_modulos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    plano_slug    VARCHAR(100) NOT NULL,
    modulo_slug   VARCHAR(100) NOT NULL,
    ativo         TINYINT(1) NOT NULL DEFAULT 1,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_plano_modulo (plano_slug, modulo_slug),
    INDEX idx_spm_plano (plano_slug),
    INDEX idx_spm_modulo (modulo_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Overrides de módulos por igreja (exceções individuais acima do plano)
CREATE TABLE IF NOT EXISTS igreja_modulos (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    igreja_id     INT NOT NULL,
    modulo_slug   VARCHAR(100) NOT NULL,
    ativo         TINYINT(1) NOT NULL DEFAULT 1,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_igreja_modulo (igreja_id, modulo_slug),
    INDEX idx_im_igreja (igreja_id),
    INDEX idx_im_modulo (modulo_slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- Dados iniciais: módulos padrão do sistema LDFP
-- (INSERT IGNORE: seguro re-executar sem duplicar)
-- ============================================================
INSERT IGNORE INTO saas_modulos (slug, nome, descricao, icon, feature_key, route_path, ativo) VALUES
('membros',           'Membros',               'Cadastro completo de membros da igreja',             'fa-users',                  'membros',           'membros.html',           1),
('visitantes',        'Visitantes',            'Registro e acompanhamento de visitantes',            'fa-user-plus',              'visitantes',        'visitantes.html',        1),
('congregados',       'Congregados',           'Gestão de congregados',                              'fa-people-group',           'congregados',       'congregados.html',       1),
('criancas',          'Crianças',              'Controle de crianças da escola dominical',           'fa-child',                  'criancas',          'criancas.html',          1),
('agenda',            'Agenda',                'Agenda e eventos da igreja',                         'fa-calendar-days',          'agenda',            'agenda.html',            1),
('oracoes',           'Pedidos de Oração',     'Gestão de pedidos de oração',                       'fa-hands-praying',          'oracoes',           'oracoes.html',           1),
('financeiro',        'Financeiro',            'Controle financeiro completo',                       'fa-coins',                  'financeiro',        'financeiro.html',        1),
('dizimos',           'Dízimos e Ofertas',     'Lançamento e controle de dízimos',                  'fa-hand-holding-dollar',    'dizimos',           'dizimos.html',           1),
('escalas',           'Escalas de Culto',      'Montagem e gestão de escalas',                      'fa-table-list',             'escalas',           'escalas.html',           1),
('batismos',          'Batismos',              'Controle de batismos e inscrições',                  'fa-droplet',                'batismos',          'batismos.html',          1),
('ebd',               'EBD',                   'Escola Bíblica Dominical (turmas, alunos, grades)',  'fa-book-bible',             'ebd',               'ebd_turmas.html',        1),
('cargos',            'Cargos',                'Organograma e cargos da igreja',                     'fa-sitemap',                'cargos',            'cargos.html',            1),
('congregacoes',      'Congregações',          'Gestão de congregações filiais',                     'fa-church',                 'congregacoes',      'congregacoes.html',      1),
('missionarios',      'Missionários',          'Controle de missionários apoiados',                  'fa-globe',                  'missionarios',      'missionarios.html',      1),
('app_membro',        'App do Membro',         'Acesso do membro via app/PWA',                       'fa-mobile-screen',          'app_membro',        'app_membro_v2.html',     1),
('app_midia',         'App de Mídia',          'Apresentação de letras e slides',                    'fa-display',                'app_midia',         'app_midia.html',         1),
('whatsapp',          'Comunicação WhatsApp',  'Envio de mensagens via WhatsApp',                    'fa-whatsapp',               'whatsapp',          'comunicacao_whatsapp.html',1),
('autocadastro',      'Auto-cadastro',         'Portal de autocadastro de membros',                  'fa-clipboard-user',         'autocadastro',      'autocadastro.html',      1),
('portaria_qr',       'Portaria QR',           'Controle de entrada via QR Code',                    'fa-qrcode',                 'portaria_qr',       'portaria.html',          1),
('pagamentos',        'Pagamentos',            'Links de pagamento e dízimos online',                'fa-credit-card',            'pagamentos',        'banco.html',             1);
