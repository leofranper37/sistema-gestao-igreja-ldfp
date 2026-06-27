const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let bancoTablesReadyPromise = null;

async function ensureBancoTables() {
    if (!bancoTablesReadyPromise) {
        bancoTablesReadyPromise = (async () => {
            await ensureTable('banco_contas', [
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    banco VARCHAR(255),
                    agencia VARCHAR(120),
                    conta VARCHAR(120),
                    tipo VARCHAR(50) NOT NULL DEFAULT 'corrente',
                    saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo SMALLINT NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    banco VARCHAR(255),
                    agencia VARCHAR(120),
                    conta VARCHAR(120),
                    tipo VARCHAR(50) NOT NULL DEFAULT 'corrente',
                    saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo TINYINT(1) NOT NULL DEFAULT 1,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    nome TEXT NOT NULL,
                    banco TEXT,
                    agencia TEXT,
                    conta TEXT,
                    tipo TEXT NOT NULL DEFAULT 'corrente',
                    saldo_inicial REAL NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_banco_contas_igreja ON banco_contas (igreja_id)'
            ]);

            await ensureTable('banco_lancamentos', [
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id BIGSERIAL PRIMARY KEY,
                    conta_id INTEGER NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    descricao VARCHAR(255) NOT NULL,
                    tipo VARCHAR(30) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    data_lancamento DATE NOT NULL,
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    conta_id INT NOT NULL,
                    igreja_id INT NOT NULL,
                    descricao VARCHAR(255) NOT NULL,
                    tipo VARCHAR(30) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    data_lancamento DATE NOT NULL,
                    observacao TEXT,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conta_id INTEGER NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    descricao TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    valor REAL NOT NULL,
                    data_lancamento TEXT NOT NULL,
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_banco_lancamentos_igreja_conta ON banco_lancamentos (igreja_id, conta_id)'
            ]);
        })();
    }

    await bancoTablesReadyPromise;
}

async function listContas(igrejaId) {
    await ensureBancoTables();

    const [rows] = await pool.query(
        `SELECT * FROM banco_contas WHERE igreja_id = ? ORDER BY nome`,
        [igrejaId]
    );

    return rows;
}

async function getConta(id, igrejaId) {
    await ensureBancoTables();

    const [[row]] = await pool.query(
        `SELECT * FROM banco_contas WHERE id = ? AND igreja_id = ?`,
        [id, igrejaId]
    );

    return row || null;
}

async function createConta(payload) {
    await ensureBancoTables();

    const { igrejaId, nome, banco, agencia, conta, tipo, saldoInicial, observacao, createdBy } = payload;
    const [result] = await pool.query(
        `INSERT INTO banco_contas (igreja_id, nome, banco, agencia, conta, tipo, saldo_inicial, observacao, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, nome, banco || null, agencia || null, conta || null, tipo || 'corrente', saldoInicial || 0, observacao || null, createdBy || null]
    );

    return result.insertId;
}

async function updateConta(id, igrejaId, payload) {
    await ensureBancoTables();

    const { nome, banco, agencia, conta, tipo, saldoInicial, observacao, ativo } = payload;
    await pool.query(
        `UPDATE banco_contas SET nome=?, banco=?, agencia=?, conta=?, tipo=?, saldo_inicial=?, observacao=?, ativo=?, updated_at=NOW()
         WHERE id=? AND igreja_id=?`,
        [nome, banco || null, agencia || null, conta || null, tipo || 'corrente', saldoInicial || 0, observacao || null, ativo !== undefined ? ativo : 1, id, igrejaId]
    );
}

async function deleteConta(id, igrejaId) {
    await ensureBancoTables();

    await pool.query(`DELETE FROM banco_contas WHERE id=? AND igreja_id=?`, [id, igrejaId]);
}

// ─── Lançamentos ─────────────────────────────────────────────────────────────

async function listLancamentos(contaId, igrejaId) {
    await ensureBancoTables();

    const [rows] = await pool.query(
        `SELECT bl.*, bc.nome AS conta_nome
         FROM banco_lancamentos bl
         JOIN banco_contas bc ON bc.id = bl.conta_id
         WHERE bl.conta_id = ? AND bl.igreja_id = ?
         ORDER BY bl.data_lancamento DESC, bl.id DESC`,
        [contaId, igrejaId]
    );
    return rows;
}

async function createLancamento(payload) {
    await ensureBancoTables();

    const { contaId, igrejaId, descricao, tipo, valor, dataLancamento, observacao, createdBy } = payload;
    const [result] = await pool.query(
        `INSERT INTO banco_lancamentos (conta_id, igreja_id, descricao, tipo, valor, data_lancamento, observacao, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [contaId, igrejaId, descricao, tipo, valor, dataLancamento, observacao || null, createdBy || null]
    );
    return result.insertId;
}

async function deleteLancamento(id, igrejaId) {
    await ensureBancoTables();

    await pool.query(`DELETE FROM banco_lancamentos WHERE id = ? AND igreja_id = ?`, [id, igrejaId]);
}

async function getSaldoConta(contaId, igrejaId) {
    await ensureBancoTables();

    const [[conta]] = await pool.query(
        `SELECT saldo_inicial FROM banco_contas WHERE id = ? AND igreja_id = ?`,
        [contaId, igrejaId]
    );
    if (!conta) return null;
    const [[totais]] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) AS total_entrada,
            COALESCE(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END),0) AS total_saida
         FROM banco_lancamentos WHERE conta_id = ? AND igreja_id = ?`,
        [contaId, igrejaId]
    );
    return Number(conta.saldo_inicial) + Number(totais.total_entrada) - Number(totais.total_saida);
}

module.exports = {
    listContas,
    getConta,
    createConta,
    updateConta,
    deleteConta,
    listLancamentos,
    createLancamento,
    deleteLancamento,
    getSaldoConta
};
