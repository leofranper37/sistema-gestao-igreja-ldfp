const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let cargosTableReadyPromise = null;

async function ensureCargosTable() {
    if (!cargosTableReadyPromise) {
        cargosTableReadyPromise = ensureTable('cargos', [
            `CREATE TABLE IF NOT EXISTS cargos (
                id BIGSERIAL PRIMARY KEY,
                descricao VARCHAR(100) NOT NULL,
                igreja_id INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS cargos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                descricao VARCHAR(100) NOT NULL,
                igreja_id INT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS cargos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                descricao TEXT NOT NULL,
                igreja_id INTEGER NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ], [
            'CREATE INDEX IF NOT EXISTS idx_cargos_igreja ON cargos (igreja_id)'
        ]);
    }

    await cargosTableReadyPromise;
}

async function listCargos(igrejaId) {
    await ensureCargosTable();

    const [rows] = await pool.query('SELECT * FROM cargos WHERE igreja_id = ? ORDER BY id DESC', [igrejaId]);
    return rows;
}

async function createCargo(igrejaId, descricao) {
    await ensureCargosTable();

    await pool.query('INSERT INTO cargos (descricao, igreja_id) VALUES (?, ?)', [descricao, igrejaId]);
}

async function updateCargo(id, igrejaId, descricao) {
    await ensureCargosTable();

    const [result] = await pool.query(
        'UPDATE cargos SET descricao = ? WHERE id = ? AND igreja_id = ?',
        [descricao, id, igrejaId]
    );

    return result.affectedRows;
}

async function deleteCargo(id, igrejaId) {
    await ensureCargosTable();

    const [result] = await pool.query('DELETE FROM cargos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return result.affectedRows;
}

module.exports = {
    createCargo,
    deleteCargo,
    listCargos,
    updateCargo
};