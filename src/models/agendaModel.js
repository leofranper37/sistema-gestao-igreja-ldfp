const { pool } = require('../config/db');

let agendaTableReadyPromise = null;

async function ensureAgendaTable() {
    if (agendaTableReadyPromise) {
        return agendaTableReadyPromise;
    }

    agendaTableReadyPromise = (async () => {
        const createStatements = [
            `CREATE TABLE IF NOT EXISTS agenda_eventos (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT NULL,
                inicio TIMESTAMP NOT NULL,
                fim TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS agenda_eventos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL DEFAULT 1,
                titulo VARCHAR(255) NOT NULL,
                descricao TEXT NULL,
                inicio DATETIME NOT NULL,
                fim DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS agenda_eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL DEFAULT 1,
                titulo TEXT NOT NULL,
                descricao TEXT,
                inicio TEXT NOT NULL,
                fim TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        let created = false;

        for (const statement of createStatements) {
            try {
                await pool.query(statement);
                created = true;
                break;
            } catch (_error) {
                // Tenta o próximo dialeto.
            }
        }

        if (!created) {
            throw new Error('Falha ao garantir tabela agenda_eventos.');
        }

        // Índice opcional para melhorar filtros por igreja/período.
        try {
            await pool.query('CREATE INDEX IF NOT EXISTS idx_agenda_eventos_igreja_inicio ON agenda_eventos (igreja_id, inicio)');
        } catch (_error) {
            // Alguns bancos/versões não suportam IF NOT EXISTS para index.
        }
    })();

    return agendaTableReadyPromise;
}

async function listEventosByPeriodo({ igrejaId, startDate, endDate }) {
    await ensureAgendaTable();

    const [rows] = await pool.query(
        `SELECT id, titulo, descricao, inicio, fim, created_at, updated_at
         FROM agenda_eventos
         WHERE igreja_id = ?
           AND inicio < ?
           AND fim > ?
         ORDER BY inicio ASC`,
        [igrejaId, endDate, startDate]
    );

    return rows;
}

async function getEventoById({ igrejaId, id }) {
    await ensureAgendaTable();

    const [rows] = await pool.query(
        `SELECT id, titulo, descricao, inicio, fim, created_at, updated_at
         FROM agenda_eventos
         WHERE igreja_id = ? AND id = ?
         LIMIT 1`,
        [igrejaId, id]
    );

    return rows[0] || null;
}

async function createEvento({ igrejaId, titulo, descricao, inicio, fim }) {
    await ensureAgendaTable();

    const [result] = await pool.query(
        'INSERT INTO agenda_eventos (igreja_id, titulo, descricao, inicio, fim) VALUES (?, ?, ?, ?, ?)',
        [igrejaId, titulo, descricao, inicio, fim]
    );

    return result.insertId;
}

async function updateEvento({ igrejaId, id, titulo, descricao, inicio, fim }) {
    await ensureAgendaTable();

    const [result] = await pool.query(
        `UPDATE agenda_eventos
         SET titulo = ?, descricao = ?, inicio = ?, fim = ?
         WHERE igreja_id = ? AND id = ?`,
        [titulo, descricao, inicio, fim, igrejaId, id]
    );

    return result.affectedRows;
}

async function deleteEvento({ igrejaId, id }) {
    await ensureAgendaTable();

    const [result] = await pool.query(
        'DELETE FROM agenda_eventos WHERE igreja_id = ? AND id = ?',
        [igrejaId, id]
    );

    return result.affectedRows;
}

module.exports = {
    ensureAgendaTable,
    createEvento,
    deleteEvento,
    getEventoById,
    listEventosByPeriodo,
    updateEvento
};
