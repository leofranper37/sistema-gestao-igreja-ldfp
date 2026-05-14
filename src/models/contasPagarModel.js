const { pool } = require('../config/db');

let tableReadyPromise = null;

async function ensureContasPagarTable() {
    if (!tableReadyPromise) {
        tableReadyPromise = pool.query(
            `CREATE TABLE IF NOT EXISTS contas_pagar (
                id SERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL,
                descricao VARCHAR(255) NOT NULL,
                fornecedor VARCHAR(255) NULL,
                valor DECIMAL(12,2) NOT NULL,
                vencimento DATE NOT NULL,
                categoria VARCHAR(120) NULL,
                observacao TEXT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pendente',
                data_pagamento DATE NULL,
                created_by INTEGER NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`
        );
    }

    await tableReadyPromise;
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
        `SELECT * FROM contas_pagar cp ${where} ORDER BY cp.vencimento ASC, cp.created_at DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { items: rows, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

async function createContaPagar(payload) {
    await ensureContasPagarTable();
    const { igrejaId, descricao, fornecedor, valor, vencimento, categoria, observacao, createdBy } = payload;
    const [result] = await pool.query(
        `INSERT INTO contas_pagar (igreja_id, descricao, fornecedor, valor, vencimento, categoria, observacao, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, descricao, fornecedor || null, valor, vencimento, categoria || null, observacao || null, createdBy || null]
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
