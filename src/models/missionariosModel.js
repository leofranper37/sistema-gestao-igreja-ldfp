const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let missionariosTableReadyPromise = null;

async function ensureMissionariosTable() {
    if (!missionariosTableReadyPromise) {
        missionariosTableReadyPromise = ensureTable('missionarios', [
            `CREATE TABLE IF NOT EXISTS missionarios (
                id BIGSERIAL PRIMARY KEY,
                igreja_id INTEGER NOT NULL,
                nome VARCHAR(255) NOT NULL,
                titulo VARCHAR(120),
                cep VARCHAR(30),
                endereco VARCHAR(255),
                bairro VARCHAR(120),
                cidade VARCHAR(120),
                estado VARCHAR(60),
                pais VARCHAR(120),
                telefone VARCHAR(60),
                telefone2 VARCHAR(60),
                email VARCHAR(255),
                email2 VARCHAR(255),
                banco VARCHAR(120),
                nome_agencia VARCHAR(120),
                agencia VARCHAR(80),
                tipo_conta VARCHAR(80),
                numero_conta VARCHAR(120),
                nome_contato VARCHAR(255),
                parentesco_contato VARCHAR(120),
                cep_contato VARCHAR(30),
                endereco_contato VARCHAR(255),
                bairro_contato VARCHAR(120),
                cidade_contato VARCHAR(120),
                estado_contato VARCHAR(60),
                pais_contato VARCHAR(120),
                telefone_contato VARCHAR(60),
                telefone2_contato VARCHAR(60),
                email_contato VARCHAR(255),
                obs TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS missionarios (
                id INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id INT NOT NULL,
                nome VARCHAR(255) NOT NULL,
                titulo VARCHAR(120),
                cep VARCHAR(30),
                endereco VARCHAR(255),
                bairro VARCHAR(120),
                cidade VARCHAR(120),
                estado VARCHAR(60),
                pais VARCHAR(120),
                telefone VARCHAR(60),
                telefone2 VARCHAR(60),
                email VARCHAR(255),
                email2 VARCHAR(255),
                banco VARCHAR(120),
                nome_agencia VARCHAR(120),
                agencia VARCHAR(80),
                tipo_conta VARCHAR(80),
                numero_conta VARCHAR(120),
                nome_contato VARCHAR(255),
                parentesco_contato VARCHAR(120),
                cep_contato VARCHAR(30),
                endereco_contato VARCHAR(255),
                bairro_contato VARCHAR(120),
                cidade_contato VARCHAR(120),
                estado_contato VARCHAR(60),
                pais_contato VARCHAR(120),
                telefone_contato VARCHAR(60),
                telefone2_contato VARCHAR(60),
                email_contato VARCHAR(255),
                obs TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
            `CREATE TABLE IF NOT EXISTS missionarios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                igreja_id INTEGER NOT NULL,
                nome TEXT NOT NULL,
                titulo TEXT,
                cep TEXT,
                endereco TEXT,
                bairro TEXT,
                cidade TEXT,
                estado TEXT,
                pais TEXT,
                telefone TEXT,
                telefone2 TEXT,
                email TEXT,
                email2 TEXT,
                banco TEXT,
                nome_agencia TEXT,
                agencia TEXT,
                tipo_conta TEXT,
                numero_conta TEXT,
                nome_contato TEXT,
                parentesco_contato TEXT,
                cep_contato TEXT,
                endereco_contato TEXT,
                bairro_contato TEXT,
                cidade_contato TEXT,
                estado_contato TEXT,
                pais_contato TEXT,
                telefone_contato TEXT,
                telefone2_contato TEXT,
                email_contato TEXT,
                obs TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )`
        ], [
            'CREATE INDEX IF NOT EXISTS idx_missionarios_igreja ON missionarios (igreja_id)'
        ]);
    }

    await missionariosTableReadyPromise;
}

async function listMissionarios({ igrejaId, termo }) {
    await ensureMissionariosTable();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (termo) {
        where.push('(nome LIKE ? OR cidade LIKE ? OR pais LIKE ?)');
        values.push(`%${termo}%`, `%${termo}%`, `%${termo}%`);
    }

    const [rows] = await pool.query(
        `SELECT *
         FROM missionarios
         WHERE ${where.join(' AND ')}
         ORDER BY nome ASC
         LIMIT 400`,
        values
    );

    return rows;
}

async function getMissionarioById({ igrejaId, id }) {
    await ensureMissionariosTable();

    const [rows] = await pool.query(
        'SELECT * FROM missionarios WHERE igreja_id = ? AND id = ? LIMIT 1',
        [igrejaId, id]
    );

    return rows[0] || null;
}

async function createMissionario(payload) {
    await ensureMissionariosTable();

    const [result] = await pool.query(
        `INSERT INTO missionarios (
            igreja_id, nome, titulo, cep, endereco, bairro, cidade, estado, pais,
            telefone, telefone2, email, email2, banco, nome_agencia, agencia, tipo_conta, numero_conta,
            nome_contato, parentesco_contato, cep_contato, endereco_contato, bairro_contato, cidade_contato,
            estado_contato, pais_contato, telefone_contato, telefone2_contato, email_contato, obs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.nome,
            payload.titulo,
            payload.cep,
            payload.endereco,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.pais,
            payload.telefone,
            payload.telefone2,
            payload.email,
            payload.email2,
            payload.banco,
            payload.nomeAgencia,
            payload.agencia,
            payload.tipoConta,
            payload.numeroConta,
            payload.nomeContato,
            payload.parentescoContato,
            payload.cepContato,
            payload.enderecoContato,
            payload.bairroContato,
            payload.cidadeContato,
            payload.estadoContato,
            payload.paisContato,
            payload.telefoneContato,
            payload.telefone2Contato,
            payload.emailContato,
            payload.obs
        ]
    );

    return result.insertId;
}

async function updateMissionario({ igrejaId, id, payload }) {
    await ensureMissionariosTable();

    const [result] = await pool.query(
        `UPDATE missionarios
         SET nome = ?, titulo = ?, cep = ?, endereco = ?, bairro = ?, cidade = ?, estado = ?, pais = ?,
             telefone = ?, telefone2 = ?, email = ?, email2 = ?, banco = ?, nome_agencia = ?, agencia = ?,
             tipo_conta = ?, numero_conta = ?, nome_contato = ?, parentesco_contato = ?, cep_contato = ?,
             endereco_contato = ?, bairro_contato = ?, cidade_contato = ?, estado_contato = ?, pais_contato = ?,
             telefone_contato = ?, telefone2_contato = ?, email_contato = ?, obs = ?
         WHERE igreja_id = ? AND id = ?`,
        [
            payload.nome,
            payload.titulo,
            payload.cep,
            payload.endereco,
            payload.bairro,
            payload.cidade,
            payload.estado,
            payload.pais,
            payload.telefone,
            payload.telefone2,
            payload.email,
            payload.email2,
            payload.banco,
            payload.nomeAgencia,
            payload.agencia,
            payload.tipoConta,
            payload.numeroConta,
            payload.nomeContato,
            payload.parentescoContato,
            payload.cepContato,
            payload.enderecoContato,
            payload.bairroContato,
            payload.cidadeContato,
            payload.estadoContato,
            payload.paisContato,
            payload.telefoneContato,
            payload.telefone2Contato,
            payload.emailContato,
            payload.obs,
            igrejaId,
            id
        ]
    );

    return result.affectedRows;
}

async function deleteMissionario({ igrejaId, id }) {
    await ensureMissionariosTable();

    const [result] = await pool.query(
        'DELETE FROM missionarios WHERE igreja_id = ? AND id = ?',
        [igrejaId, id]
    );

    return result.affectedRows;
}

module.exports = {
    createMissionario,
    deleteMissionario,
    getMissionarioById,
    listMissionarios,
    updateMissionario
};
