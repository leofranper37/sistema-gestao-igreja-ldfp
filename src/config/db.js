const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2/promise');
let pg;
try {
    pg = require('pg');
} catch (_) {
    pg = null;
}
let sqlite3;

try {
    sqlite3 = require('sqlite3').verbose();
} catch (error) {
    sqlite3 = null;
    console.error('❌ sqlite3 indisponível neste ambiente:', error?.message || error);
}

// SQLite database path:
// - Accepts absolute or relative SQLITE_DB_PATH
// - Falls back to data/ inside project root (writable on cPanel shared hosting)
// - Uses project root file in local/dev
const projectRoot = path.resolve(__dirname, '../..');
const configuredDbPath = process.env.SQLITE_DB_PATH
    || (process.env.NODE_ENV === 'production'
        ? path.join(projectRoot, 'data', 'ldfp_db.sqlite')
        : path.join(projectRoot, 'ldfp_db.sqlite'));

const dbPath = path.isAbsolute(configuredDbPath)
    ? configuredDbPath
    : path.resolve(projectRoot, configuredDbPath);

try {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
} catch (mkdirError) {
    console.error('⚠️ Não foi possível garantir a pasta do SQLite:', mkdirError?.message || mkdirError);
}

const db = sqlite3 ? new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Erro ao conectar no SQLite:', err.message);
    } else {
        console.log('✅ Banco de dados SQLite conectado com sucesso e pronto a usar!');
    }
}) : null;

const sqliteUnavailableError = () => new Error('SQLite indisponível no runtime atual.');

const pickFirstValue = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return undefined;
};

const readEnv = (...keys) => pickFirstValue(...keys.map((key) => process.env[key]));

const parseDbUrl = () => {
    const rawUrl = readEnv(
        'DB_URL',
        'DATABASE_URL',
        'MYSQL_URL',
        'MYSQL_PUBLIC_URL',
        'MYSQL_PRIVATE_URL',
        'MYSQLPRIVATE_URL',
        'URL_PUBLICA_DO_MYSQL',
        'URL_PÚBLICA_DO_MYSQL'
    );

    if (!rawUrl) {
        return null;
    }

    try {
        const parsed = new URL(rawUrl);
        return {
            host: parsed.hostname || undefined,
            user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
            password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
            database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) : undefined,
            port: parsed.port ? Number.parseInt(parsed.port, 10) : undefined
        };
    } catch (_) {
        return null;
    }
};

const dbUrl = parseDbUrl();
let mysqlPool = null;
let mysqlPoolInitError = null;
let pgPool = null;
let pgPoolInitError = null;

function getPostgresPool() {
    if (!pg || !pg.Pool) return null;
    if (pgPool) return pgPool;
    if (pgPoolInitError) return null;

    const pgUrl = readEnv(
        'DATABASE_URL',
        'POSTGRES_URL',
        'POSTGRES_PRISMA_URL',
        'POSTGRES_URL_NON_POOLING',
        'PG_URL'
    );

    if (!pgUrl || !/^postgres(?:ql)?:\/\//i.test(pgUrl)) return null;

    try {
        pgPool = new pg.Pool({
            connectionString: pgUrl,
            ssl: { rejectUnauthorized: false },
            max: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '5', 10)
        });
        console.log('✅ PostgreSQL pool ativado (Neon/prod).');
        return pgPool;
    } catch (error) {
        pgPoolInitError = error;
        console.error('❌ Falha ao iniciar pool PostgreSQL:', error?.message || error);
        return null;
    }
}

function adaptSqlForPostgres(sql) {
    const hasInsertIgnore = /INSERT\s+(?:OR\s+)?IGNORE\b/i.test(sql);
    let s = normalizeSql(sql)
        .replace(/INSERT\s+OR\s+IGNORE\b/gi, 'INSERT')
        .replace(/INSERT\s+IGNORE\b/gi, 'INSERT')
        .replace(/\bDATETIME\s+DEFAULT\s+CURRENT_TIMESTAMP/gi, 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP')
        .replace(/\bDATETIME\b/gi, 'TIMESTAMP')
        .replace(/\bTINYINT\(\d+\)/gi, 'SMALLINT')
        .replace(/\bLONGTEXT\b/gi, 'TEXT')
        .replace(/datetime\('now'\s*,\s*'\+(\d+)\s+days'\)/gi, "(NOW() + INTERVAL '$1 days')")
        .replace(/datetime\('now'\)/gi, 'NOW()')
        .replace(/date\('now'\)/gi, 'CURRENT_DATE')
        .replace(/\bDATE_ADD\(NOW\(\),\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "(NOW() + INTERVAL '$1 days')");

    if (hasInsertIgnore && !/ON\s+CONFLICT\b/i.test(s)) {
        s = s.trimEnd() + ' ON CONFLICT DO NOTHING';
    }

    let idx = 0;
    s = s.replace(/\?/g, () => `$${++idx}`);
    return s;
}

function pgInsertReturning(sql) {
    const trimmed = sql.trimEnd().replace(/;\s*$/, '');
    if (/^\s*INSERT\b/i.test(trimmed) && !/RETURNING\b/i.test(trimmed)) {
        return trimmed + ' RETURNING id';
    }
    return trimmed;
}

function buildMysqlConfig() {
    const hostRaw = readEnv('DB_HOST', 'MYSQL_HOST', 'MYSQLHOST', 'HOST_DO_BANCO_DE_DADOS');
    const hostLooksLikeUrl = typeof hostRaw === 'string' && hostRaw.includes('://');

    let parsedFromHostUrl = null;
    if (hostLooksLikeUrl) {
        try {
            const parsed = new URL(hostRaw);
            parsedFromHostUrl = {
                host: parsed.hostname || undefined,
                user: parsed.username ? decodeURIComponent(parsed.username) : undefined,
                password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
                database: parsed.pathname ? decodeURIComponent(parsed.pathname.replace(/^\//, '')) : undefined,
                port: parsed.port ? Number.parseInt(parsed.port, 10) : undefined
            };
        } catch (_) {
            parsedFromHostUrl = null;
        }
    }

    const host = (!hostLooksLikeUrl ? hostRaw : undefined) || parsedFromHostUrl?.host || dbUrl?.host;
    const user = readEnv('DB_USER', 'MYSQL_USER', 'MYSQLUSER', 'USUARIO_DO_BANCO_DE_DADOS', 'USUÁRIO_DO_BANCO_DE_DADOS') || parsedFromHostUrl?.user || dbUrl?.user;
    const password = readEnv('DB_PASSWORD', 'DB_PASS', 'MYSQL_PASSWORD', 'MYSQLPASSWORD', 'SENHA_DO_BANCO_DE_DADOS') || parsedFromHostUrl?.password || dbUrl?.password;
    const database = readEnv('DB_NAME', 'MYSQL_DATABASE', 'MYSQLDATABASE', 'NOME_DO_BANCO_DE_DADOS') || parsedFromHostUrl?.database || dbUrl?.database;
    const portRaw = readEnv('DB_PORT', 'MYSQL_PORT', 'MYSQLPORT', 'PORTA_DO_BANCO_DE_DADOS') || parsedFromHostUrl?.port || dbUrl?.port || '3306';
    const port = Number.parseInt(String(portRaw), 10);

    // In production/serverless, ignore localhost-style host when URL-based config exists.
    const isServerRuntime = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production');
    const isLocalHostValue = typeof host === 'string' && ['localhost', '127.0.0.1', '::1'].includes(host.trim().toLowerCase());

    const finalHost = (isServerRuntime && isLocalHostValue && dbUrl?.host) ? dbUrl.host : host;
    const finalPort = (isServerRuntime && isLocalHostValue && dbUrl?.port) ? dbUrl.port : port;

    if (!finalHost || !user || !database || Number.isNaN(finalPort)) {
        return null;
    }

    return {
        host: finalHost,
        user,
        password: password || '',
        database,
        port: finalPort,
        waitForConnections: true,
        connectionLimit: Number.parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
        queueLimit: 0
    };
}

function getMysqlPool() {
    if (mysqlPool) {
        return mysqlPool;
    }

    if (mysqlPoolInitError) {
        return null;
    }

    const config = buildMysqlConfig();
    if (!config) {
        return null;
    }

    try {
        mysqlPool = mysql.createPool(config);
        console.log('✅ MySQL pool ativado.');
        return mysqlPool;
    } catch (error) {
        mysqlPoolInitError = error;
        console.error('❌ Falha ao iniciar MySQL:', error?.message || error);
        return null;
    }
}

function normalizeSql(sql) {
    // Accept legacy Postgres-style placeholders ($1, $2...) and convert to SQLite style (?).
    return String(sql).replace(/\$\d+/g, '?');
}

function adaptSqlForMysql(sql) {
    return normalizeSql(sql)
        .replace(/INSERT\s+OR\s+IGNORE/gi, 'INSERT IGNORE')
        .replace(/datetime\('now'\s*,\s*'\+(\d+)\s+days'\)/gi, 'DATE_ADD(NOW(), INTERVAL $1 DAY)')
        .replace(/datetime\('now'\)/gi, 'NOW()')
        .replace(/date\('now'\)/gi, 'CURDATE()');
}

function allAsync(sql, params = []) {
    if (!db) {
        return Promise.reject(sqliteUnavailableError());
    }

    return new Promise((resolve, reject) => {
        db.all(normalizeSql(sql), params, (error, rows) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(rows || []);
        });
    });
}

function runAsync(sql, params = []) {
    if (!db) {
        return Promise.reject(sqliteUnavailableError());
    }

    return new Promise((resolve, reject) => {
        db.run(normalizeSql(sql), params, function onRun(error) {
            if (error) {
                reject(error);
                return;
            }

            resolve({
                insertId: this.lastID,
                affectedRows: this.changes,
                changes: this.changes
            });
        });
    });
}

const pool = {
    async query(sql, params = []) {
        const activePgPool = getPostgresPool();

        if (activePgPool) {
            const adapted = adaptSqlForPostgres(pgInsertReturning(sql));
            const result = await activePgPool.query(adapted, params);
            const stmt = sql.trim().toUpperCase();
            if (stmt.startsWith('SELECT') || stmt.startsWith('WITH') || stmt.startsWith('PRAGMA')) {
                return [result.rows];
            }
            const insertId = result.rows && result.rows.length > 0 ? result.rows[0].id : null;
            return [{ insertId, affectedRows: result.rowCount, changes: result.rowCount }];
        }

        const activeMysqlPool = getMysqlPool();

        if (activeMysqlPool) {
            const [rows] = await activeMysqlPool.query(adaptSqlForMysql(sql), params);
            return [rows];
        }

        const statement = normalizeSql(sql).trim().toUpperCase();

        if (statement.startsWith('SELECT') || statement.startsWith('PRAGMA') || statement.startsWith('WITH')) {
            const rows = await allAsync(sql, params);
            return [rows];
        }

        const result = await runAsync(sql, params);
        return [result];
    },

    async getConnection() {
        const activePgPool = getPostgresPool();

        if (activePgPool) {
            const client = await activePgPool.connect();
            const pgQuery = async (sql, qParams = []) => {
                const adapted = adaptSqlForPostgres(pgInsertReturning(sql));
                const result = await client.query(adapted, qParams);
                const stmt = sql.trim().toUpperCase();
                if (stmt.startsWith('SELECT') || stmt.startsWith('WITH')) {
                    return [result.rows];
                }
                const insertId = result.rows && result.rows.length > 0 ? result.rows[0].id : null;
                return [{ insertId, affectedRows: result.rowCount, changes: result.rowCount }];
            };
            return {
                query: pgQuery,
                beginTransaction: () => client.query('BEGIN'),
                commit: () => client.query('COMMIT'),
                rollback: () => client.query('ROLLBACK'),
                release() { client.release(); }
            };
        }

        const activeMysqlPool = getMysqlPool();

        if (activeMysqlPool) {
            const connection = await activeMysqlPool.getConnection();
            return {
                query: async (sql, params = []) => {
                    const [rows] = await connection.query(adaptSqlForMysql(sql), params);
                    return [rows];
                },
                beginTransaction: () => connection.beginTransaction(),
                commit: () => connection.commit(),
                rollback: () => connection.rollback(),
                release() { connection.release(); }
            };
        }

        return {
            query: (sql, params = []) => pool.query(sql, params),
            beginTransaction: () => runAsync('BEGIN'),
            commit: () => runAsync('COMMIT'),
            rollback: () => runAsync('ROLLBACK'),
            release() {}
        };
    },

    async end() {
        if (pgPool) {
            await pgPool.end();
            pgPool = null;
            return;
        }

        if (mysqlPool) {
            await mysqlPool.end();
            mysqlPool = null;
            return;
        }

        if (!db) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            db.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve();
            });
        });
    }
};

async function initializeDatabase() {
    const activePgPool = getPostgresPool();

    if (activePgPool) {
        await activePgPool.query(`CREATE TABLE IF NOT EXISTS igrejas (
            id SERIAL PRIMARY KEY,
            nome VARCHAR(255) NOT NULL UNIQUE,
            plano VARCHAR(100) NOT NULL DEFAULT 'teste-7-dias',
            status_assinatura VARCHAR(30) NOT NULL DEFAULT 'trial',
            trial_starts_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            trial_ends_at TIMESTAMP NULL,
            max_cadastros INTEGER NOT NULL DEFAULT 40,
            max_congregacoes INTEGER NOT NULL DEFAULT 1,
            modulo_app_membro SMALLINT NOT NULL DEFAULT 0,
            modulo_app_midia SMALLINT NOT NULL DEFAULT 0,
            modulo_ebd SMALLINT NOT NULL DEFAULT 0,
            modulo_agenda_eventos SMALLINT NOT NULL DEFAULT 1,
            modulo_escala_culto SMALLINT NOT NULL DEFAULT 0,
            modulo_pedidos_oracao SMALLINT NOT NULL DEFAULT 1,
            modulo_mural_oracao SMALLINT NOT NULL DEFAULT 1,
            public_token VARCHAR(64),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);


        await activePgPool.query(`CREATE TABLE IF NOT EXISTS membros (
            id SERIAL PRIMARY KEY,
            igreja_id INTEGER NOT NULL DEFAULT 1,
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
            observacoes TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN observacoes TEXT`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN cargo VARCHAR(120) NULL`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN foto_url VARCHAR(500) NULL`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN acesso_app_midia SMALLINT NOT NULL DEFAULT 0`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN gerenciar_midias SMALLINT NOT NULL DEFAULT 0`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN app_senha VARCHAR(255) NULL`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE membros ADD COLUMN precisa_trocar_senha SMALLINT NOT NULL DEFAULT 0`); } catch(_){}

        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_membros_igreja ON membros (igreja_id)`);

        await activePgPool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id SERIAL PRIMARY KEY,
            igreja VARCHAR(255) NOT NULL,
            igreja_id INTEGER NOT NULL,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'admin',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await activePgPool.query(`CREATE TABLE IF NOT EXISTS payment_links (
            id SERIAL PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            valor DECIMAL(12,2) NOT NULL,
            provider VARCHAR(50) NOT NULL,
            payment_method VARCHAR(30) DEFAULT 'pix',
            status VARCHAR(30) NOT NULL DEFAULT 'pendente',
            reference_code VARCHAR(255) NOT NULL UNIQUE,
            provider_external_id VARCHAR(255) NULL,
            url TEXT NULL,
            qr_code TEXT NULL,
            qr_code_base64 TEXT NULL,
            status_detail TEXT NULL,
            plano_destino VARCHAR(120) NULL,
            plano_duracao_dias INTEGER NOT NULL DEFAULT 30,
            modulos_json TEXT NULL,
            paid_at TIMESTAMP NULL,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_payment_links_igreja ON payment_links (igreja_id)`);
        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_payment_links_reference ON payment_links (reference_code)`);

        await activePgPool.query(`CREATE TABLE IF NOT EXISTS pedidos_oracao (
            id SERIAL PRIMARY KEY,
            igreja_id INTEGER NOT NULL DEFAULT 1,
            solicitante VARCHAR(255) NOT NULL,
            alvo_oracao VARCHAR(255) NOT NULL,
            descricao TEXT NULL,
            status VARCHAR(30) NOT NULL DEFAULT 'ativo',
            is_private SMALLINT NOT NULL DEFAULT 0,
            resposta TEXT NULL,
            intercessores INTEGER NOT NULL DEFAULT 0,
            usuario_id INTEGER NULL,
            user_name VARCHAR(255) NULL,
            data_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            data_atualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_igreja ON pedidos_oracao (igreja_id)`);
        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_status ON pedidos_oracao (status)`);

        await activePgPool.query(`CREATE TABLE IF NOT EXISTS oracao_intercessores (
            id SERIAL PRIMARY KEY,
            pedido_id INTEGER NOT NULL,
            usuario_id INTEGER NULL,
            nome_intercessor VARCHAR(255) NULL,
            data_intercessao TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);

        await activePgPool.query(`CREATE INDEX IF NOT EXISTS idx_oracao_intercessores_pedido ON oracao_intercessores (pedido_id)`);

        await activePgPool.query(`CREATE TABLE IF NOT EXISTS saas_planos (
            id SERIAL PRIMARY KEY,
            slug VARCHAR(50) NOT NULL UNIQUE,
            nome VARCHAR(120) NOT NULL,
            subtitulo VARCHAR(255),
            versículo TEXT,
            preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
            preco_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
            max_cadastros INTEGER NOT NULL DEFAULT 30,
            max_congregacoes INTEGER NOT NULL DEFAULT 1,
            modulo_app_membro SMALLINT NOT NULL DEFAULT 0,
            features_json TEXT,
            ativo SMALLINT NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await activePgPool.query(`INSERT INTO saas_planos (slug,nome,subtitulo,preco_mensal,preco_anual,max_cadastros,max_congregacoes,modulo_app_membro,features_json) VALUES
            ('hebrom','Hebrom','Igrejas em formação',50,500,150,1,0,'["App Web (PWA)","Até 150 cadastros","1 congregação","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via e-mail"]'),
            ('betel','Betel','Igrejas em crescimento',80,800,300,5,1,'["App Web (PWA)","App do Membro","Até 300 cadastros","Até 5 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via WhatsApp"]'),
            ('siao','Sião','Igrejas consolidadas',100,1000,500,10,1,'["App Web (PWA)","App do Membro","Até 500 cadastros","Até 10 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via Telefone","Consultoria Contábil"]')
            ON CONFLICT (slug) DO NOTHING`);
        await activePgPool.query(`DELETE FROM saas_planos WHERE LOWER(slug) IN ('edon','eden')`);
        await activePgPool.query(`UPDATE igrejas SET plano = 'hebrom' WHERE LOWER(plano) IN ('edon','eden')`);
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN responsavel VARCHAR(255)`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN email_admin VARCHAR(255)`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN telefone VARCHAR(60)`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN cnpj VARCHAR(30)`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN mensalidade_valor DECIMAL(10,2) NOT NULL DEFAULT 0`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN ultimo_pagamento TIMESTAMP`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN proximo_vencimento TIMESTAMP`); } catch(_){}
        try { await activePgPool.query(`ALTER TABLE igrejas ADD COLUMN public_token VARCHAR(64)`); } catch(_){}
        try { await activePgPool.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_igrejas_public_token ON igrejas (public_token) WHERE public_token IS NOT NULL`); } catch(_){}
        try { await activePgPool.query(`UPDATE igrejas SET public_token = encode(gen_random_bytes(20), 'hex') WHERE public_token IS NULL OR public_token = ''`); } catch(_){}

        console.log('✅ Tabelas principais verificadas/criadas no PostgreSQL.');
        return;
    }

    const activeMysqlPool = getMysqlPool();

    if (activeMysqlPool) {
        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS igrejas (
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
            config_personalizada_json LONGTEXT NULL,
            public_token VARCHAR(64) NULL,
            responsavel VARCHAR(255) NULL,
            email_admin VARCHAR(255) NULL,
            telefone VARCHAR(60) NULL,
            cnpj VARCHAR(30) NULL,
            mensalidade_valor DECIMAL(10,2) NOT NULL DEFAULT 0,
            ultimo_pagamento DATETIME NULL,
            proximo_vencimento DATETIME NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN config_personalizada_json LONGTEXT NULL`); } catch(_){}


        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS membros (
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
            cargo VARCHAR(120) NULL,
            foto_url VARCHAR(500) NULL,
            acesso_app_midia TINYINT(1) NOT NULL DEFAULT 0,
            gerenciar_midias TINYINT(1) NOT NULL DEFAULT 0,
            observacoes TEXT NULL,
            app_senha VARCHAR(255) NULL,
            precisa_trocar_senha TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_membros_igreja (igreja_id)
        )`);
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN cargo VARCHAR(120) NULL`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN foto_url VARCHAR(500) NULL`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN acesso_app_midia TINYINT(1) NOT NULL DEFAULT 0`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN gerenciar_midias TINYINT(1) NOT NULL DEFAULT 0`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN observacoes TEXT NULL`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN app_senha VARCHAR(255) NULL`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE membros ADD COLUMN precisa_trocar_senha TINYINT(1) NOT NULL DEFAULT 0`); } catch(_){}

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS usuarios (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja VARCHAR(255) NOT NULL,
            igreja_id INT NOT NULL,
            nome VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(50) NOT NULL DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS payment_links (
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
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS pedidos_oracao (
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
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS oracao_intercessores (
            id INT AUTO_INCREMENT PRIMARY KEY,
            pedido_id INT NOT NULL,
            usuario_id INT NULL,
            nome_intercessor VARCHAR(255) NULL,
            data_intercessao DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_oracao_intercessores_pedido (pedido_id)
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS saas_planos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(50) NOT NULL UNIQUE,
            nome VARCHAR(120) NOT NULL,
            subtitulo VARCHAR(255),
            versículo TEXT,
            preco_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,
            preco_anual DECIMAL(10,2) NOT NULL DEFAULT 0,
            max_cadastros INT NOT NULL DEFAULT 30,
            max_congregacoes INT NOT NULL DEFAULT 1,
            modulo_app_membro TINYINT(1) NOT NULL DEFAULT 0,
            features_json LONGTEXT,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        await activeMysqlPool.query(`INSERT IGNORE INTO saas_planos (slug,nome,subtitulo,preco_mensal,preco_anual,max_cadastros,max_congregacoes,modulo_app_membro,features_json) VALUES
            ('hebrom','Hebrom','Igrejas em formação',50,500,150,1,0,'["App Web (PWA)","Até 150 cadastros","1 congregação","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via e-mail"]'),
            ('betel','Betel','Igrejas em crescimento',80,800,300,5,1,'["App Web (PWA)","App do Membro","Até 300 cadastros","Até 5 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via WhatsApp"]'),
            ('siao','Sião','Igrejas consolidadas',100,1000,500,10,1,'["App Web (PWA)","App do Membro","Até 500 cadastros","Até 10 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via Telefone","Consultoria Contábil"]')`);
        await activeMysqlPool.query(`DELETE FROM saas_planos WHERE LOWER(slug) IN ('edon','eden')`);
        await activeMysqlPool.query(`UPDATE igrejas SET plano = 'hebrom' WHERE LOWER(plano) IN ('edon','eden')`);
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN responsavel VARCHAR(255)`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN email_admin VARCHAR(255)`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN telefone VARCHAR(60)`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN cnpj VARCHAR(30)`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN mensalidade_valor DECIMAL(10,2) NOT NULL DEFAULT 0`); } catch(_){}
        try { await activeMysqlPool.query('ALTER TABLE saas_planos CHANGE `versículo` `versiculo` TEXT'); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN ultimo_pagamento DATETIME`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN proximo_vencimento DATETIME`); } catch(_){}
        try { await activeMysqlPool.query(`ALTER TABLE igrejas ADD COLUMN public_token VARCHAR(64) NULL`); } catch(_){}
        try {
            const [igSemToken] = await activeMysqlPool.query(`SELECT id FROM igrejas WHERE public_token IS NULL OR public_token = ''`);
            for (const ig of igSemToken) {
                const token = crypto.randomBytes(20).toString('hex');
                await activeMysqlPool.query(`UPDATE igrejas SET public_token = ? WHERE id = ?`, [token, ig.id]);
            }
        } catch (_) {}

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS saas_modulos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            slug VARCHAR(100) NOT NULL UNIQUE,
            nome VARCHAR(255) NOT NULL,
            descricao TEXT,
            icon VARCHAR(100) DEFAULT 'fa-puzzle-piece',
            feature_key VARCHAR(100),
            route_path VARCHAR(255),
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS saas_plano_modulos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            plano_slug VARCHAR(50) NOT NULL,
            modulo_slug VARCHAR(100) NOT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_plano_modulo (plano_slug, modulo_slug)
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS igreja_modulos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id INT NOT NULL,
            modulo_slug VARCHAR(100) NOT NULL,
            ativo TINYINT(1),
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY unique_igreja_modulo (igreja_id, modulo_slug)
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS sistema_config (
            config_key VARCHAR(100) NOT NULL PRIMARY KEY,
            config_value LONGTEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS retomada_checkpoints (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nota TEXT,
            git_branch VARCHAR(100),
            git_head VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS sistema_novidades (
            id INT AUTO_INCREMENT PRIMARY KEY,
            titulo VARCHAR(200) NOT NULL,
            subtitulo VARCHAR(300),
            conteudo TEXT,
            tags VARCHAR(500),
            tipo VARCHAR(50) DEFAULT 'release',
            destaque TINYINT(1) DEFAULT 0,
            ativo TINYINT(1) DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS password_reset_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(200) NOT NULL,
            nome VARCHAR(200),
            status VARCHAR(20) DEFAULT 'pendente',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            resolved_at DATETIME
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INT AUTO_INCREMENT PRIMARY KEY,
            usuario_id INT NOT NULL,
            token VARCHAR(128) NOT NULL UNIQUE,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_prt_token (token),
            INDEX idx_prt_usuario (usuario_id)
        )`);

        await activeMysqlPool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id INT NOT NULL,
            endpoint TEXT NOT NULL,
            p256dh TEXT NOT NULL,
            auth_key TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_push_endpoint (endpoint(512))
        )`);

        console.log('✅ Tabelas principais verificadas/criadas no MySQL.');
        return;
    }

    if (!db) {
        if (mysqlPoolInitError) {
            throw mysqlPoolInitError;
        }

        throw sqliteUnavailableError();
    }

    return new Promise((resolve, reject) => {
        db.serialize(() => {
            const safeAlter = (sql) => {
                db.run(sql, (error) => {
                    if (error && !String(error.message || '').toLowerCase().includes('duplicate column name')) {
                        console.error('⚠️ Erro ao ajustar schema SQLite:', error.message);
                    }
                });
            };

            db.run(`CREATE TABLE IF NOT EXISTS igrejas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                plano TEXT NOT NULL DEFAULT 'teste-7-dias',
                status_assinatura TEXT NOT NULL DEFAULT 'trial',
                trial_starts_at TEXT DEFAULT CURRENT_TIMESTAMP,
                trial_ends_at TEXT,
                max_cadastros INTEGER NOT NULL DEFAULT 40,
                max_congregacoes INTEGER NOT NULL DEFAULT 1,
                modulo_app_membro INTEGER NOT NULL DEFAULT 0,
                modulo_app_midia INTEGER NOT NULL DEFAULT 0,
                modulo_ebd INTEGER NOT NULL DEFAULT 0,
                modulo_agenda_eventos INTEGER NOT NULL DEFAULT 1,
                modulo_escala_culto INTEGER NOT NULL DEFAULT 0,
                modulo_pedidos_oracao INTEGER NOT NULL DEFAULT 1,
                modulo_mural_oracao INTEGER NOT NULL DEFAULT 1,
                public_token TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_app_membro INTEGER NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_app_midia INTEGER NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_ebd INTEGER NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_agenda_eventos INTEGER NOT NULL DEFAULT 1');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_escala_culto INTEGER NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_pedidos_oracao INTEGER NOT NULL DEFAULT 1');
            safeAlter('ALTER TABLE igrejas ADD COLUMN modulo_mural_oracao INTEGER NOT NULL DEFAULT 1');


            db.run(`CREATE TABLE IF NOT EXISTS membros (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                nome TEXT NOT NULL,
                email TEXT,
                telefone TEXT,
                apelido TEXT,
                nascimento TEXT,
                sexo TEXT,
                estado_civil TEXT,
                profissao TEXT,
                cep TEXT,
                endereco TEXT,
                numero TEXT,
                bairro TEXT,
                cidade TEXT,
                estado TEXT,
                celular TEXT,
                cpf TEXT,
                rg TEXT,
                nacionalidade TEXT,
                naturalidade TEXT,
                data_nascimento TEXT,
                situacao TEXT DEFAULT 'Ativo',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            safeAlter('ALTER TABLE membros ADD COLUMN igreja_id INTEGER NOT NULL DEFAULT 1');
            safeAlter('ALTER TABLE membros ADD COLUMN email TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN telefone TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN apelido TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN nascimento TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN sexo TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN estado_civil TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN profissao TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN cep TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN endereco TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN numero TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN bairro TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN cidade TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN estado TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN celular TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN rg TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN nacionalidade TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN naturalidade TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN observacoes TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN created_at TEXT DEFAULT CURRENT_TIMESTAMP');
            safeAlter('ALTER TABLE membros ADD COLUMN app_senha TEXT');
            safeAlter('ALTER TABLE membros ADD COLUMN precisa_trocar_senha INTEGER NOT NULL DEFAULT 0');

            db.run(`CREATE INDEX IF NOT EXISTS idx_membros_igreja ON membros (igreja_id)`);

            db.run(`CREATE TABLE IF NOT EXISTS usuarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja TEXT NOT NULL,
                igreja_id INTEGER NOT NULL,
                nome TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'admin',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS payment_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL,
                descricao TEXT NOT NULL,
                valor REAL NOT NULL,
                provider TEXT NOT NULL,
                payment_method TEXT DEFAULT 'pix',
                status TEXT NOT NULL DEFAULT 'pendente',
                reference_code TEXT NOT NULL UNIQUE,
                provider_external_id TEXT,
                url TEXT,
                qr_code TEXT,
                qr_code_base64 TEXT,
                status_detail TEXT,
                plano_destino TEXT,
                plano_duracao_dias INTEGER NOT NULL DEFAULT 30,
                modulos_json TEXT,
                paid_at TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            safeAlter('ALTER TABLE payment_links ADD COLUMN modulos_json TEXT');

            db.run(`CREATE INDEX IF NOT EXISTS idx_payment_links_igreja ON payment_links (igreja_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_payment_links_reference ON payment_links (reference_code)`);

            db.run(`CREATE TABLE IF NOT EXISTS pedidos_oracao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                solicitante TEXT NOT NULL,
                alvo_oracao TEXT NOT NULL,
                descricao TEXT,
                status TEXT NOT NULL DEFAULT 'ativo',
                is_private INTEGER NOT NULL DEFAULT 0,
                resposta TEXT,
                intercessores INTEGER NOT NULL DEFAULT 0,
                usuario_id INTEGER,
                user_name TEXT,
                data_pedido TEXT DEFAULT CURRENT_TIMESTAMP,
                data_atualizado TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            safeAlter('ALTER TABLE pedidos_oracao ADD COLUMN is_private INTEGER NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE pedidos_oracao ADD COLUMN resposta TEXT');
            safeAlter('ALTER TABLE pedidos_oracao ADD COLUMN user_name TEXT');

            db.run(`CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_igreja ON pedidos_oracao (igreja_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_pedidos_oracao_status ON pedidos_oracao (status)`);

            db.run(`CREATE TABLE IF NOT EXISTS oracao_intercessores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pedido_id INTEGER NOT NULL,
                usuario_id INTEGER,
                nome_intercessor TEXT,
                data_intercessao TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pedido_id) REFERENCES pedidos_oracao(id) ON DELETE CASCADE
            )`);

            db.run(`CREATE INDEX IF NOT EXISTS idx_oracao_intercessores_pedido ON oracao_intercessores (pedido_id)`);

            db.run(`CREATE TABLE IF NOT EXISTS saas_planos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                nome TEXT NOT NULL,
                subtitulo TEXT,
                versiculo TEXT,
                preco_mensal REAL NOT NULL DEFAULT 0,
                preco_anual REAL NOT NULL DEFAULT 0,
                max_cadastros INTEGER NOT NULL DEFAULT 30,
                max_congregacoes INTEGER NOT NULL DEFAULT 1,
                modulo_app_membro INTEGER NOT NULL DEFAULT 0,
                features_json TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`INSERT OR IGNORE INTO saas_planos (slug,nome,subtitulo,preco_mensal,preco_anual,max_cadastros,max_congregacoes,modulo_app_membro,features_json) VALUES
                ('hebrom','Hebrom','Igrejas em formação',50,500,150,1,0,'["App Web (PWA)","Até 150 cadastros","1 congregação","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via e-mail"]'),
                ('betel','Betel','Igrejas em crescimento',80,800,300,5,1,'["App Web (PWA)","App do Membro","Até 300 cadastros","Até 5 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via WhatsApp"]'),
                ('siao','Sião','Igrejas consolidadas',100,1000,500,10,1,'["App Web (PWA)","App do Membro","Até 500 cadastros","Até 10 congregações","EBD Dominical","Credencial de Membro","Grupos/Células","Financeiro completo","Relatórios completos","Suporte via Telefone","Consultoria Contábil"]')`
            );
            db.run(`DELETE FROM saas_planos WHERE LOWER(slug) IN ('edon','eden')`);
            db.run(`UPDATE igrejas SET plano = 'hebrom' WHERE LOWER(plano) IN ('edon','eden')`);
            safeAlter('ALTER TABLE igrejas ADD COLUMN responsavel TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN email_admin TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN telefone TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN cnpj TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN mensalidade_valor REAL NOT NULL DEFAULT 0');
            safeAlter('ALTER TABLE igrejas ADD COLUMN ultimo_pagamento TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN proximo_vencimento TEXT');
            safeAlter('ALTER TABLE igrejas ADD COLUMN public_token TEXT');
            // Backfill SQLite: o pool abstrato não está disponível aqui;
            // a geração de tokens para instalações SQLite antigas ocorre
            // em ensureAppTables() na primeira requisição ao App do Membro.

            db.run(`CREATE TABLE IF NOT EXISTS saas_modulos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT NOT NULL UNIQUE,
                nome TEXT NOT NULL,
                descricao TEXT,
                icon TEXT DEFAULT 'fa-puzzle-piece',
                feature_key TEXT,
                route_path TEXT,
                ativo INTEGER NOT NULL DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS saas_plano_modulos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plano_slug TEXT NOT NULL,
                modulo_slug TEXT NOT NULL,
                ativo INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (plano_slug, modulo_slug)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS igreja_modulos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL,
                modulo_slug TEXT NOT NULL,
                ativo INTEGER,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (igreja_id, modulo_slug)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario_id INTEGER NOT NULL,
                token TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used INTEGER NOT NULL DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`);

            // Sentinela: garante que todos os comandos acima já foram executados antes de resolver.
            db.run('SELECT 1', (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('✅ Tabelas principais verificadas/criadas no SQLite.');
                    resolve();
                }
            });
        });
    });
}

module.exports = {
    db,
    pool,
    initializeDatabase
};
