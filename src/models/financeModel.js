const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

const BASE_TIPOS_RECEITA = [
    { slug: 'dizimos', descricao: 'Dízimos', planoConta: '4.01.01.01 - Dízimo de Membros' },
    { slug: 'oferta-missionaria', descricao: 'Oferta Missionária', planoConta: '4.01.03.01 - Oferta Missionária de Membros' },
    { slug: 'ofertas', descricao: 'Ofertas', planoConta: '4.01.01.02 - Oferta de Membros' }
];

let financeTablesReadyPromise = null;

async function ensureFinanceTables() {
    if (!financeTablesReadyPromise) {
        financeTablesReadyPromise = (async () => {
            await ensureTable('transacoes', [
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id BIGSERIAL PRIMARY KEY,
                    description VARCHAR(255) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    description VARCHAR(255) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    igreja_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_transacoes_igreja ON transacoes (igreja_id)'
            ]);

            await ensureTable('caixa_saldo_inicial', [
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id BIGSERIAL PRIMARY KEY,
                    competencia VARCHAR(20) NOT NULL,
                    saldo_inicial DECIMAL(12,2) NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    competencia VARCHAR(20) NOT NULL,
                    saldo_inicial DECIMAL(12,2) NOT NULL,
                    igreja_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competencia TEXT NOT NULL,
                    saldo_inicial REAL NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_csi_igreja_comp ON caixa_saldo_inicial (igreja_id, competencia)'
            ]);

            await ensureTable('dizimos', [
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    membro_id INTEGER,
                    membro_nome VARCHAR(255) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    competencia VARCHAR(20) NOT NULL,
                    tipo VARCHAR(30) NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    membro_id INT,
                    membro_nome VARCHAR(255) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    competencia VARCHAR(20) NOT NULL,
                    tipo VARCHAR(30) NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    membro_id INTEGER,
                    membro_nome TEXT NOT NULL,
                    valor REAL NOT NULL,
                    competencia TEXT NOT NULL,
                    tipo TEXT NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_dizimos_igreja_comp ON dizimos (igreja_id, competencia)'
            ]);
        })();
    }

    await financeTablesReadyPromise;
}

async function getLatestSaldoInicial(igrejaId) {
    await ensureFinanceTables();

    const [[row]] = await pool.query(
        'SELECT saldo_inicial, competencia FROM caixa_saldo_inicial WHERE igreja_id = ? ORDER BY competencia DESC LIMIT 1',
        [igrejaId]
    );

    return row || null;
}

async function getTotais(igrejaId) {
    await ensureFinanceTables();

    const [[row]] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) AS total_entradas,
            COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0) AS total_saidas
         FROM transacoes
         WHERE igreja_id = ?`,
        [igrejaId]
    );

    return row;
}

async function listTransacoes(igrejaId) {
    await ensureFinanceTables();

    const [rows] = await pool.query(
        'SELECT * FROM transacoes WHERE igreja_id = ? ORDER BY id DESC LIMIT 200',
        [igrejaId]
    );

    return rows;
}

async function listTransacoesWithFilters(filters) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.tipo) {
        where.push('type = ?');
        values.push(filters.tipo);
    }

    if (filters.descricao) {
        where.push('description LIKE ?');
        values.push(`%${filters.descricao}%`);
    }

    if (filters.startDate) {
        where.push('DATE(created_at) >= ?');
        values.push(filters.startDate);
    }

    if (filters.endDate) {
        where.push('DATE(created_at) <= ?');
        values.push(filters.endDate);
    }

    const sortByMap = {
        id: 'id',
        created_at: 'created_at',
        amount: 'amount',
        description: 'description',
        type: 'type'
    };

    const sortBy = sortByMap[filters.sortBy] || 'id';
    const sortOrder = String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM transacoes
         WHERE ${where.join(' AND ')}`,
        values
    );

    const total = Number(countRows[0]?.total || 0);
    const limit = Number(filters.limit || 200);
    const page = Number(filters.page || 1);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
        `SELECT *
         FROM transacoes
         WHERE ${where.join(' AND ')}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...values, limit, offset]
    );

    return {
        items: rows,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        }
    };
}

async function createTransacao(payload) {
    await ensureFinanceTables();

    await pool.query(
        'INSERT INTO transacoes (description, type, amount, igreja_id) VALUES (?, ?, ?, ?)',
        [payload.descricao, payload.tipo, payload.amount, payload.igrejaId]
    );
}

async function findSaldoInicialByCompetencia(igrejaId, competencia) {
    await ensureFinanceTables();

    const [rows] = await pool.query(
        'SELECT id FROM caixa_saldo_inicial WHERE igreja_id = ? AND competencia = ? LIMIT 1',
        [igrejaId, competencia]
    );

    return rows[0] || null;
}

async function updateSaldoInicialById(id, saldoInicial) {
    await ensureFinanceTables();

    await pool.query('UPDATE caixa_saldo_inicial SET saldo_inicial = ? WHERE id = ?', [saldoInicial, id]);
}

async function createSaldoInicial(payload) {
    await ensureFinanceTables();

    await pool.query(
        'INSERT INTO caixa_saldo_inicial (competencia, saldo_inicial, igreja_id) VALUES (?, ?, ?)',
        [payload.competencia, payload.saldoInicial, payload.igrejaId]
    );
}

// ─── Dízimos ────────────────────────────────────────────────────────────────

async function listDizimos(filters) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.competencia) {
        where.push('competencia = ?');
        values.push(filters.competencia);
    }

    if (filters.tipo) {
        where.push('tipo = ?');
        values.push(filters.tipo);
    }

    if (filters.membroNome) {
        where.push('membro_nome LIKE ?');
        values.push(`%${filters.membroNome}%`);
    }

    const limit = Math.min(Number(filters.limit || 100), 500);
    const page = Math.max(Number(filters.page || 1), 1);
    const offset = (page - 1) * limit;

    const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM dizimos WHERE ${where.join(' AND ')}`,
        values
    );

    const [rows] = await pool.query(
        `SELECT * FROM dizimos WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
    );

    return {
        items: rows,
        meta: { page, limit, total: Number(countRow.total), totalPages: Math.max(1, Math.ceil(countRow.total / limit)) }
    };
}

async function getTotaisDizimos(igrejaId, competencia) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (competencia) {
        where.push('competencia = ?');
        values.push(competencia);
    }

    const [[row]] = await pool.query(
        `SELECT
            COALESCE(SUM(valor), 0) AS total_geral,
            COALESCE(SUM(CASE WHEN tipo = 'dizimo' THEN valor ELSE 0 END), 0) AS total_dizimos,
            COALESCE(SUM(CASE WHEN tipo = 'oferta' THEN valor ELSE 0 END), 0) AS total_ofertas,
            COALESCE(SUM(CASE WHEN tipo = 'missoes' THEN valor ELSE 0 END), 0) AS total_missoes,
            COALESCE(SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END), 0) AS total_outros,
            COUNT(*) AS total_lancamentos
         FROM dizimos
         WHERE ${where.join(' AND ')}`,
        values
    );

    return row;
}

async function createDizimo(payload) {
    await ensureFinanceTables();

    const [result] = await pool.query(
        `INSERT INTO dizimos (igreja_id, membro_id, membro_nome, valor, competencia, tipo, observacao, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.membroId || null,
            payload.membroNome,
            payload.valor,
            payload.competencia,
            payload.tipo || 'dizimo',
            payload.observacao || null,
            payload.createdBy || null
        ]
    );

    return result.insertId;
}

async function deleteDizimo(id, igrejaId) {
    await ensureFinanceTables();

    await pool.query('DELETE FROM dizimos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
}

// ─── Tipos de Receita ──────────────────────────────────────────────────────

async function ensureTiposReceitaTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS tipos_receita (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            plano_conta VARCHAR(255) NOT NULL,
            origem VARCHAR(20) NOT NULL DEFAULT 'custom',
            ativo INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
}

async function ensureBaseTiposReceita(igrejaId) {
    await ensureTiposReceitaTable();

    for (const item of BASE_TIPOS_RECEITA) {
        const [rows] = await pool.query(
            `SELECT id
             FROM tipos_receita
             WHERE igreja_id = ? AND origem = 'base' AND descricao = ?
             LIMIT 1`,
            [igrejaId, item.descricao]
        );

        if (rows[0]) {
            continue;
        }

        await pool.query(
            `INSERT INTO tipos_receita (id, igreja_id, descricao, plano_conta, origem, ativo)
             VALUES (?, ?, ?, ?, 'base', 1)`,
            [`base-${igrejaId}-${item.slug}`, igrejaId, item.descricao, item.planoConta]
        );
    }
}

async function listTiposReceita(filters) {
    await ensureBaseTiposReceita(filters.igrejaId);

    const where = ['igreja_id = ?', 'ativo = 1'];
    const values = [filters.igrejaId];

    if (filters.search) {
        where.push('(descricao LIKE ? OR plano_conta LIKE ?)');
        values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const [rows] = await pool.query(
        `SELECT id, igreja_id, descricao, plano_conta, origem, ativo, created_by, created_at
         FROM tipos_receita
         WHERE ${where.join(' AND ')}
         ORDER BY CASE WHEN origem = 'base' THEN 0 ELSE 1 END, descricao ASC`,
        values
    );

    return rows;
}

async function findTipoReceitaById(id, igrejaId) {
    await ensureTiposReceitaTable();
    const [rows] = await pool.query(
        `SELECT id, igreja_id, descricao, plano_conta, origem, ativo, created_by, created_at
         FROM tipos_receita
         WHERE id = ? AND igreja_id = ?
         LIMIT 1`,
        [id, igrejaId]
    );

    return rows[0] || null;
}

async function createTipoReceita(payload) {
    await ensureTiposReceitaTable();
    const id = `custom-${payload.igrejaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
        `INSERT INTO tipos_receita (id, igreja_id, descricao, plano_conta, origem, ativo, created_by)
         VALUES (?, ?, ?, ?, 'custom', 1, ?)`,
        [id, payload.igrejaId, payload.descricao, payload.planoConta, payload.createdBy || null]
    );

    return id;
}

async function updateTipoReceita(id, igrejaId, payload) {
    await ensureTiposReceitaTable();
    await pool.query(
        `UPDATE tipos_receita
         SET descricao = ?, plano_conta = ?
         WHERE id = ? AND igreja_id = ? AND origem = 'custom'`,
        [payload.descricao, payload.planoConta, id, igrejaId]
    );
}

async function deleteTipoReceita(id, igrejaId) {
    await ensureTiposReceitaTable();
    await pool.query(
        `UPDATE tipos_receita
         SET ativo = 0
         WHERE id = ? AND igreja_id = ? AND origem = 'custom'`,
        [id, igrejaId]
    );
}

module.exports = {
    ensureFinanceTables,
    createSaldoInicial,
    createTransacao,
    findSaldoInicialByCompetencia,
    getLatestSaldoInicial,
    getTotais,
    listTransacoesWithFilters,
    listTransacoes,
    updateSaldoInicialById,
    createDizimo,
    deleteDizimo,
    getTotaisDizimos,
    listDizimos,
    createTipoReceita,
    deleteTipoReceita,
    findTipoReceitaById,
    listTiposReceita,
    updateTipoReceita
};