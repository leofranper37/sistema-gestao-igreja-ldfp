const { pool } = require('../config/db');

async function ensureReciboTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS recibos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id INT NOT NULL,
            numero INT NOT NULL,
            favorecido VARCHAR(255) NOT NULL,
            referente VARCHAR(500) NOT NULL,
            valor DECIMAL(14,2) NOT NULL DEFAULT 0,
            data_recibo DATE NOT NULL,
            observacao TEXT NULL,
            created_by INT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_recibos_igreja (igreja_id),
            INDEX idx_recibos_data (data_recibo),
            UNIQUE KEY uq_recibo_numero (igreja_id, numero)
        )
    `);
}

async function getProximoNumero(igrejaId) {
    const [rows] = await pool.query(
        'SELECT COALESCE(MAX(numero), 0) + 1 AS proximo FROM recibos WHERE igreja_id = ?',
        [igrejaId]
    );
    return rows[0].proximo;
}

async function criarRecibo(igrejaId, dados, userId) {
    await ensureReciboTable();
    const numero = await getProximoNumero(igrejaId);
    const [result] = await pool.query(
        `INSERT INTO recibos (igreja_id, numero, favorecido, referente, valor, data_recibo, observacao, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, numero, dados.favorecido, dados.referente, dados.valor, dados.data_recibo, dados.observacao || null, userId || null]
    );
    return { id: result.insertId, numero };
}

async function listarRecibos(igrejaId, { pagina = 1, limite = 20, busca = '' } = {}) {
    await ensureReciboTable();
    const offset = (pagina - 1) * limite;
    const like = `%${busca}%`;

    const [rows] = await pool.query(
        `SELECT id, numero, favorecido, referente, valor, data_recibo, observacao, created_at
         FROM recibos
         WHERE igreja_id = ?
           AND (favorecido LIKE ? OR referente LIKE ? OR numero LIKE ?)
         ORDER BY numero DESC
         LIMIT ? OFFSET ?`,
        [igrejaId, like, like, like, Number(limite), Number(offset)]
    );

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM recibos
         WHERE igreja_id = ? AND (favorecido LIKE ? OR referente LIKE ? OR numero LIKE ?)`,
        [igrejaId, like, like, like]
    );

    return { recibos: rows, total, pagina: Number(pagina), limite: Number(limite) };
}

async function buscarRecibo(igrejaId, id) {
    await ensureReciboTable();
    const [rows] = await pool.query(
        'SELECT * FROM recibos WHERE id = ? AND igreja_id = ?',
        [id, igrejaId]
    );
    return rows[0] || null;
}

async function deletarRecibo(igrejaId, id) {
    await ensureReciboTable();
    const [result] = await pool.query(
        'DELETE FROM recibos WHERE id = ? AND igreja_id = ?',
        [id, igrejaId]
    );
    return result.affectedRows > 0;
}

module.exports = { criarRecibo, listarRecibos, buscarRecibo, deletarRecibo };
