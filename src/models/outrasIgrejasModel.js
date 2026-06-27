const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let outrasIgrejasTableReadyPromise = null;

async function ensureOutrasIgrejasTable() {
    if (!outrasIgrejasTableReadyPromise) {
        outrasIgrejasTableReadyPromise = ensureTable('outras_igrejas', [
            `CREATE TABLE IF NOT EXISTS outras_igrejas (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL,
                nome VARCHAR(255) NOT NULL,
                sede VARCHAR(255),
                endereco VARCHAR(255),
                bairro VARCHAR(120),
                cidade VARCHAR(120),
                cep VARCHAR(30),
                estado VARCHAR(60),
                telefone VARCHAR(60),
                celular VARCHAR(60),
                email VARCHAR(255),
                responsavel VARCHAR(255),
                cargo VARCHAR(120),
                nascimento DATE,
                declaracao TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS outras_igrejas (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL,
                nome VARCHAR(255) NOT NULL,
                sede VARCHAR(255),
                endereco VARCHAR(255),
                bairro VARCHAR(120),
                cidade VARCHAR(120),
                cep VARCHAR(30),
                estado VARCHAR(60),
                telefone VARCHAR(60),
                celular VARCHAR(60),
                email VARCHAR(255),
                responsavel VARCHAR(255),
                cargo VARCHAR(120),
                nascimento DATE,
                declaracao TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS outras_igrejas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL,
                nome TEXT NOT NULL,
                sede TEXT,
                endereco TEXT,
                bairro TEXT,
                cidade TEXT,
                cep TEXT,
                estado TEXT,
                telefone TEXT,
                celular TEXT,
                email TEXT,
                responsavel TEXT,
                cargo TEXT,
                nascimento TEXT,
                declaracao TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ], [
            'CREATE INDEX IF NOT EXISTS idx_outras_igrejas_igreja ON outras_igrejas (igreja_id)'
        ]);
    }

    await outrasIgrejasTableReadyPromise;
}

async function listOutrasIgrejas({ igrejaId, termo }) {
    await ensureOutrasIgrejasTable();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (termo) {
        where.push('(nome LIKE ? OR cidade LIKE ? OR responsavel LIKE ?)');
        values.push(`%${termo}%`, `%${termo}%`, `%${termo}%`);
    }

    const [rows] = await pool.query(
        `SELECT id, nome, sede, endereco, bairro, cidade, cep, estado, telefone, celular, email,
                responsavel, cargo, nascimento, declaracao, created_at, updated_at
         FROM outras_igrejas
         WHERE ${where.join(' AND ')}
         ORDER BY nome ASC
         LIMIT 300`,
        values
    );

    return rows;
}

async function getOutrasIgrejaById({ igrejaId, id }) {
    await ensureOutrasIgrejasTable();

    const [rows] = await pool.query(
        `SELECT id, nome, sede, endereco, bairro, cidade, cep, estado, telefone, celular, email,
                responsavel, cargo, nascimento, declaracao, created_at, updated_at
         FROM outras_igrejas
         WHERE igreja_id = ? AND id = ?
         LIMIT 1`,
        [igrejaId, id]
    );

    return rows[0] || null;
}

async function createOutrasIgreja(payload) {
    await ensureOutrasIgrejasTable();

    const [result] = await pool.query(
        `INSERT INTO outras_igrejas (
            igreja_id, nome, sede, endereco, bairro, cidade, cep, estado,
            telefone, celular, email, responsavel, cargo, nascimento, declaracao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.nome,
            payload.sede,
            payload.endereco,
            payload.bairro,
            payload.cidade,
            payload.cep,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.responsavel,
            payload.cargo,
            payload.nascimento,
            payload.declaracao
        ]
    );

    return result.insertId;
}

async function updateOutrasIgreja({ igrejaId, id, payload }) {
    await ensureOutrasIgrejasTable();

    const [result] = await pool.query(
        `UPDATE outras_igrejas
         SET nome = ?, sede = ?, endereco = ?, bairro = ?, cidade = ?, cep = ?, estado = ?,
             telefone = ?, celular = ?, email = ?, responsavel = ?, cargo = ?, nascimento = ?, declaracao = ?
         WHERE igreja_id = ? AND id = ?`,
        [
            payload.nome,
            payload.sede,
            payload.endereco,
            payload.bairro,
            payload.cidade,
            payload.cep,
            payload.estado,
            payload.telefone,
            payload.celular,
            payload.email,
            payload.responsavel,
            payload.cargo,
            payload.nascimento,
            payload.declaracao,
            igrejaId,
            id
        ]
    );

    return result.affectedRows;
}

async function deleteOutrasIgreja({ igrejaId, id }) {
    await ensureOutrasIgrejasTable();

    const [result] = await pool.query(
        'DELETE FROM outras_igrejas WHERE igreja_id = ? AND id = ?',
        [igrejaId, id]
    );

    return result.affectedRows;
}

async function countOutrasIgrejas(igrejaId) {
    await ensureOutrasIgrejasTable();

    const [[row]] = await pool.query(
        'SELECT COUNT(*) AS total FROM outras_igrejas WHERE igreja_id = ?',
        [igrejaId]
    );

    return row?.total || 0;
}

module.exports = {
    ensureOutrasIgrejasTable,
    countOutrasIgrejas,
    createOutrasIgreja,
    deleteOutrasIgreja,
    getOutrasIgrejaById,
    listOutrasIgrejas,
    updateOutrasIgreja
};
