const { pool } = require('../config/db');
const cadastrosTesouraria = require('./cadastrosTesourariaModel');
const { ensureTable } = require('./tableEnsure');

let tableReadyPromise = null;

async function ensureContasPagarTable() {
    if (!tableReadyPromise) {
        // MySQL primeiro; se falhar (SQLite local), usa INTEGER PRIMARY KEY AUTOINCREMENT
        // — com "SERIAL" o SQLite criava id NULL e as contas não podiam ser pagas/excluídas.
        tableReadyPromise = ensureTable('contas_pagar', [
            `CREATE TABLE IF NOT EXISTS contas_pagar (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL,
                descricao VARCHAR(255) NOT NULL,
                fornecedor VARCHAR(255) NULL,
                valor DECIMAL(12,2) NOT NULL,
                vencimento DATE NOT NULL,
                categoria VARCHAR(120) NULL,
                observacao TEXT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pendente',
                data_pagamento DATE NULL,
                created_by INT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_contas_pagar_igreja (igreja_id)
            )`,
            `CREATE TABLE IF NOT EXISTS contas_pagar (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL,
                descricao TEXT NOT NULL,
                fornecedor TEXT,
                valor REAL NOT NULL,
                vencimento TEXT NOT NULL,
                categoria TEXT,
                observacao TEXT,
                status TEXT NOT NULL DEFAULT 'pendente',
                data_pagamento TEXT,
                created_by INTEGER,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ]);
    }

    await tableReadyPromise;
    // Lote 5: tabelas de cadastro + colunas de vínculo (rede de segurança se o SQL não foi rodado)
    await cadastrosTesouraria.ensureTabelas();
    await cadastrosTesouraria.ensureColunas('contas_pagar');
}

async function listContasPagar(igrejaId, filters = {}) {
    await ensureContasPagarTable();
    const conditions = ['cp.igreja_id = ?'];
    const params = [igrejaId];

    if (filters.status) {
        conditions.push('cp.status = ?');
        params.push(filters.status);
    }

    if (filters.categoria) {
        conditions.push('cp.categoria = ?');
        params.push(filters.categoria);
    }

    if (filters.vencimentoDe) {
        conditions.push('cp.vencimento >= ?');
        params.push(filters.vencimentoDe);
    }

    if (filters.vencimentoAte) {
        conditions.push('cp.vencimento <= ?');
        params.push(filters.vencimentoAte);
    }

    if (filters.centroCustoId) {
        conditions.push('cp.centro_custo_id = ?');
        params.push(filters.centroCustoId);
    }

    if (filters.fornecedorId) {
        conditions.push('cp.fornecedor_id = ?');
        params.push(filters.fornecedorId);
    }

    if (filters.descricao) {
        conditions.push('(cp.descricao LIKE ? OR cp.fornecedor LIKE ?)');
        const like = `%${filters.descricao}%`;
        params.push(like, like);
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(filters.limit) || 50));
    const offset = (page - 1) * limit;

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM contas_pagar cp ${where}`,
        params
    );

    const [rows] = await pool.query(
        `SELECT cp.*, cc.nome AS centro_custo_nome, cc.codigo AS centro_custo_codigo, td.nome AS tipo_documento_nome
         FROM contas_pagar cp
         LEFT JOIN centros_custo cc ON cc.id = cp.centro_custo_id AND cc.igreja_id = cp.igreja_id
         LEFT JOIN tipos_documento td ON td.id = cp.tipo_documento_id AND td.igreja_id = cp.igreja_id
         ${where} ORDER BY cp.vencimento ASC, cp.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function createContaPagar(payload) {
    await ensureContasPagarTable();
    const {
        igrejaId, descricao, fornecedor, valor, vencimento, categoria, observacao, createdBy,
        fornecedorId, centroCustoId, tipoDocumentoId, numeroDocumento
    } = payload;
    const [result] = await pool.query(
        `INSERT INTO contas_pagar (igreja_id, descricao, fornecedor, valor, vencimento, categoria, observacao, created_by,
                                   fornecedor_id, centro_custo_id, tipo_documento_id, numero_documento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, descricao, fornecedor || null, valor, vencimento, categoria || null, observacao || null, createdBy || null,
            fornecedorId || null, centroCustoId || null, tipoDocumentoId || null, numeroDocumento || null]
    );

    return result.insertId;
}

async function patchContaPagar(id, igrejaId, fields) {
    await ensureContasPagarTable();
    const allowed = ['status', 'data_pagamento', 'descricao', 'fornecedor', 'valor', 'vencimento', 'categoria', 'observacao'];
    const sets = [];
    const params = [];

    for (const key of allowed) {
        if (key in fields) {
            sets.push(`${key} = ?`);
            params.push(fields[key]);
        }
    }

    if (!sets.length) return;
    params.push(id, igrejaId);
    await pool.query(
        `UPDATE contas_pagar SET ${sets.join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=? AND igreja_id=?`,
        params
    );
}

async function deleteContaPagar(id, igrejaId) {
    await ensureContasPagarTable();
    await pool.query(`DELETE FROM contas_pagar WHERE id=? AND igreja_id=?`, [id, igrejaId]);
}

async function markVencidas(igrejaId) {
    await ensureContasPagarTable();
    await pool.query(
        `UPDATE contas_pagar SET status='vencido' WHERE igreja_id=? AND status='pendente' AND vencimento < CURRENT_DATE`,
        [igrejaId]
    );
}

async function getTotaisContasPagar(igrejaId) {
    await ensureContasPagarTable();
    const [[row]] = await pool.query(`
        SELECT
            SUM(CASE WHEN status='pendente' THEN valor ELSE 0 END) AS total_pendente,
            SUM(CASE WHEN status='vencido'  THEN valor ELSE 0 END) AS total_vencido,
            SUM(CASE WHEN status='pago'     THEN valor ELSE 0 END) AS total_pago,
            COUNT(*) AS total_registros,
            SUM(CASE WHEN status IN ('pendente','vencido') THEN valor ELSE 0 END) AS total_aberto
        FROM contas_pagar WHERE igreja_id = ?
    `, [igrejaId]);

    return row;
}

module.exports = {
    listContasPagar,
    createContaPagar,
    patchContaPagar,
    deleteContaPagar,
    markVencidas,
    getTotaisContasPagar
};
