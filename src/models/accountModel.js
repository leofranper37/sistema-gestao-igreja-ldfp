const { pool } = require('../config/db');

async function findChurchByName(name) {
    const [rows] = await pool.query(
        `SELECT id, nome, plano, status_assinatura, trial_starts_at, trial_ends_at, max_cadastros, max_congregacoes,
                modulo_app_membro, modulo_app_midia, modulo_ebd,
                modulo_agenda_eventos, modulo_escala_culto, modulo_pedidos_oracao, modulo_mural_oracao
         FROM igrejas
         WHERE nome = ?
         LIMIT 1`,
        [name]
    );
    return rows[0] || null;
}

async function createChurch(name) {
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    const [result] = await pool.query(
        `INSERT INTO igrejas (
            nome, plano, status_assinatura, trial_starts_at, trial_ends_at, max_cadastros, max_congregacoes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            name,
            'teste-7-dias',
            'trial',
            now.toISOString(),
            trialEndsAt.toISOString(),
            40,
            1
        ]
    );
    return result.insertId;
}

async function createUser(payload) {
    const [result] = await pool.query(
        'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        [payload.igreja, payload.igrejaId, payload.nome, payload.email, payload.passwordHash, payload.role]
    );

    return result.insertId;
}

async function findUserByEmail(email) {
    const [rows] = await pool.query(
        `SELECT u.id, u.igreja, u.igreja_id, u.role, u.nome, u.email, u.password_hash,
                i.plano, i.status_assinatura, i.trial_starts_at, i.trial_ends_at, i.max_cadastros, i.max_congregacoes,
            i.config_personalizada_json,
                i.modulo_app_membro, i.modulo_app_midia, i.modulo_ebd,
                i.modulo_agenda_eventos, i.modulo_escala_culto, i.modulo_pedidos_oracao, i.modulo_mural_oracao
         FROM usuarios u
         LEFT JOIN igrejas i ON i.id = u.igreja_id
         WHERE u.email = ?
         LIMIT 1`,
        [email]
    );

    return rows[0] || null;
}

async function createPasswordResetToken(usuarioId, token, expiresAt) {
    await pool.query('DELETE FROM password_reset_tokens WHERE usuario_id = ?', [usuarioId]);
    await pool.query(
        'INSERT INTO password_reset_tokens (usuario_id, token, expires_at) VALUES (?, ?, ?)',
        [usuarioId, token, expiresAt.toISOString()]
    );
}

async function findPasswordResetToken(token) {
    const [rows] = await pool.query(
        'SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0 LIMIT 1',
        [token]
    );
    return rows[0] || null;
}

async function markTokenUsed(token) {
    await pool.query('UPDATE password_reset_tokens SET used = 1 WHERE token = ?', [token]);
}

async function updateUserPassword(userId, passwordHash) {
    await pool.query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, userId]);
}

module.exports = {
    createChurch,
    createUser,
    findChurchByName,
    findUserByEmail,
    createPasswordResetToken,
    findPasswordResetToken,
    markTokenUsed,
    updateUserPassword
};