const { pool } = require('../config/db');

async function ensureTables() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_plano_contas (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            codigo VARCHAR(50) NOT NULL,
            nome VARCHAR(255) NOT NULL,
            natureza VARCHAR(20) NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_balancete_abertura (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            conta VARCHAR(255) NOT NULL,
            debito DECIMAL(12,2) NOT NULL DEFAULT 0,
            credito DECIMAL(12,2) NOT NULL DEFAULT 0,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_lancamentos (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            data_lancamento DATE NOT NULL,
            historico VARCHAR(500) NOT NULL,
            conta_debito VARCHAR(255) NOT NULL,
            conta_credito VARCHAR(255) NOT NULL,
            valor DECIMAL(12,2) NOT NULL,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );

    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_encerramentos (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            usuario_nome VARCHAR(255) NOT NULL,
            observacao VARCHAR(500) NOT NULL,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
}

function buildId(prefix, igrejaId) {
    return `${prefix}-${igrejaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function listPlanoContas(igrejaId) {
    await ensureTables();
    const [rows] = await pool.query(
        `SELECT id, codigo, nome, natureza, ativo, created_at
         FROM contabilidade_plano_contas
         WHERE igreja_id = ? AND ativo = 1
         ORDER BY codigo ASC`,
        [igrejaId]
    );

    return rows;
}

async function createPlanoConta({ igrejaId, codigo, nome, natureza, createdBy }) {
    await ensureTables();
    const [existing] = await pool.query(
        `SELECT id FROM contabilidade_plano_contas
         WHERE igreja_id = ? AND codigo = ? AND ativo = 1
         LIMIT 1`,
        [igrejaId, codigo]
    );

    if (existing[0]) {
        return null;
    }

    const id = buildId('pc', igrejaId);
    const [result] = await pool.query(
        `INSERT INTO contabilidade_plano_contas (id, igreja_id, codigo, nome, natureza, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, igrejaId, codigo, nome, natureza, createdBy || null]
    );

    return result.insertId || id;
}

async function listBalanceteAbertura(igrejaId) {
    await ensureTables();
    const [rows] = await pool.query(
        `SELECT id, conta, debito, credito, created_at
         FROM contabilidade_balancete_abertura
         WHERE igreja_id = ?
         ORDER BY id DESC`,
        [igrejaId]
    );

    return rows;
}

async function createBalanceteAbertura({ igrejaId, conta, debito, credito, createdBy }) {
    await ensureTables();
    const id = buildId('ba', igrejaId);
    const [result] = await pool.query(
        `INSERT INTO contabilidade_balancete_abertura (id, igreja_id, conta, debito, credito, created_by)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, igrejaId, conta, debito, credito, createdBy || null]
    );

    return result.insertId || id;
}

async function listLancamentosContabeis(igrejaId) {
    await ensureTables();
    const [rows] = await pool.query(
        `SELECT id, data_lancamento, historico, conta_debito, conta_credito, valor, created_at
         FROM contabilidade_lancamentos
         WHERE igreja_id = ?
         ORDER BY id DESC`,
        [igrejaId]
    );

    return rows;
}

async function createLancamentoContabil({ igrejaId, dataLancamento, historico, contaDebito, contaCredito, valor, createdBy }) {
    await ensureTables();
    const id = buildId('lc', igrejaId);
    const [result] = await pool.query(
        `INSERT INTO contabilidade_lancamentos
            (id, igreja_id, data_lancamento, historico, conta_debito, conta_credito, valor, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, igrejaId, dataLancamento, historico, contaDebito, contaCredito, valor, createdBy || null]
    );

    return result.insertId || id;
}

async function listEncerramentos(igrejaId) {
    await ensureTables();
    const [rows] = await pool.query(
        `SELECT id, usuario_nome, observacao, created_at
         FROM contabilidade_encerramentos
         WHERE igreja_id = ?
         ORDER BY id DESC`,
        [igrejaId]
    );

    return rows;
}

async function createEncerramento({ igrejaId, usuarioNome, observacao, createdBy }) {
    await ensureTables();
    const id = buildId('ce', igrejaId);
    const [result] = await pool.query(
        `INSERT INTO contabilidade_encerramentos (id, igreja_id, usuario_nome, observacao, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [id, igrejaId, usuarioNome, observacao, createdBy || null]
    );

    return result.insertId || id;
}

module.exports = {
    createBalanceteAbertura,
    createEncerramento,
    createLancamentoContabil,
    createPlanoConta,
    listBalanceteAbertura,
    listEncerramentos,
    listLancamentosContabeis,
    listPlanoContas
};
