const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');

let engagementTablesReadyPromise = null;

async function ensureEngagementTables() {
    if (!engagementTablesReadyPromise) {
        engagementTablesReadyPromise = (async () => {
            await ensureTable('whatsapp_templates', [
                `CREATE TABLE IF NOT EXISTS whatsapp_templates (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    gatilho VARCHAR(120) NOT NULL,
                    conteudo TEXT NOT NULL,
                    ativo SMALLINT NOT NULL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS whatsapp_templates (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    gatilho VARCHAR(120) NOT NULL,
                    conteudo TEXT NOT NULL,
                    ativo TINYINT(1) NOT NULL DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS whatsapp_templates (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    nome TEXT NOT NULL,
                    gatilho TEXT NOT NULL,
                    conteudo TEXT NOT NULL,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_igreja ON whatsapp_templates (igreja_id, gatilho)'
            ]);

            await ensureTable('whatsapp_logs', [
                `CREATE TABLE IF NOT EXISTS whatsapp_logs (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    template_id INTEGER,
                    gatilho VARCHAR(120),
                    destino VARCHAR(120) NOT NULL,
                    mensagem_renderizada TEXT NOT NULL,
                    payload_json TEXT,
                    status VARCHAR(30) NOT NULL,
                    provider_message_id VARCHAR(255),
                    erro TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS whatsapp_logs (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    template_id INT,
                    gatilho VARCHAR(120),
                    destino VARCHAR(120) NOT NULL,
                    mensagem_renderizada TEXT NOT NULL,
                    payload_json TEXT,
                    status VARCHAR(30) NOT NULL,
                    provider_message_id VARCHAR(255),
                    erro TEXT,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS whatsapp_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    template_id INTEGER,
                    gatilho TEXT,
                    destino TEXT NOT NULL,
                    mensagem_renderizada TEXT NOT NULL,
                    payload_json TEXT,
                    status TEXT NOT NULL,
                    provider_message_id TEXT,
                    erro TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_igreja ON whatsapp_logs (igreja_id, id)'
            ]);

            await ensureTable('autocadastros', [
                `CREATE TABLE IF NOT EXISTS autocadastros (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    igreja_nome VARCHAR(255) NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    telefone VARCHAR(60),
                    cidade VARCHAR(120),
                    ministerio_interesse VARCHAR(255),
                    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
                    observacao TEXT,
                    analisado_por INTEGER,
                    analisado_em TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS autocadastros (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    igreja_nome VARCHAR(255) NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    email VARCHAR(255),
                    telefone VARCHAR(60),
                    cidade VARCHAR(120),
                    ministerio_interesse VARCHAR(255),
                    status VARCHAR(30) NOT NULL DEFAULT 'pendente',
                    observacao TEXT,
                    analisado_por INT,
                    analisado_em DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS autocadastros (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    igreja_nome TEXT NOT NULL,
                    nome TEXT NOT NULL,
                    email TEXT,
                    telefone TEXT,
                    cidade TEXT,
                    ministerio_interesse TEXT,
                    status TEXT NOT NULL DEFAULT 'pendente',
                    observacao TEXT,
                    analisado_por INTEGER,
                    analisado_em TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_autocadastros_igreja ON autocadastros (igreja_id, status)'
            ]);

            await ensureTable('portaria_checkins', [
                `CREATE TABLE IF NOT EXISTS portaria_checkins (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    visitante_id INTEGER,
                    nome_visitante VARCHAR(255) NOT NULL,
                    telefone VARCHAR(60),
                    evento VARCHAR(255),
                    origem VARCHAR(50),
                    codigo_qr VARCHAR(255),
                    status VARCHAR(30) NOT NULL DEFAULT 'entrada',
                    checked_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS portaria_checkins (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    visitante_id INT,
                    nome_visitante VARCHAR(255) NOT NULL,
                    telefone VARCHAR(60),
                    evento VARCHAR(255),
                    origem VARCHAR(50),
                    codigo_qr VARCHAR(255),
                    status VARCHAR(30) NOT NULL DEFAULT 'entrada',
                    checked_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS portaria_checkins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    visitante_id INTEGER,
                    nome_visitante TEXT NOT NULL,
                    telefone TEXT,
                    evento TEXT,
                    origem TEXT,
                    codigo_qr TEXT,
                    status TEXT NOT NULL DEFAULT 'entrada',
                    checked_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_portaria_checkins_igreja ON portaria_checkins (igreja_id, created_at)'
            ]);

            await ensureTable('portaria_qr_sessoes', [
                `CREATE TABLE IF NOT EXISTS portaria_qr_sessoes (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    evento VARCHAR(255) NOT NULL,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expira_em TIMESTAMP,
                    ativo SMALLINT NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS portaria_qr_sessoes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    evento VARCHAR(255) NOT NULL,
                    token VARCHAR(255) NOT NULL UNIQUE,
                    expira_em DATETIME,
                    ativo TINYINT(1) NOT NULL DEFAULT 1,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS portaria_qr_sessoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    evento TEXT NOT NULL,
                    token TEXT NOT NULL UNIQUE,
                    expira_em TEXT,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_portaria_qr_sessoes_igreja ON portaria_qr_sessoes (igreja_id, token)'
            ]);

            await ensureTable('visitantes_publicos', [
                `CREATE TABLE IF NOT EXISTS visitantes_publicos (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    qr_sessao_id INTEGER,
                    evento VARCHAR(255),
                    nome VARCHAR(255) NOT NULL,
                    telefone VARCHAR(60),
                    email VARCHAR(255),
                    cidade VARCHAR(120),
                    pedido_oracao TEXT,
                    autoriza_telao SMALLINT NOT NULL DEFAULT 0,
                    status VARCHAR(30) NOT NULL DEFAULT 'novo',
                    exibido_por INTEGER,
                    exibido_em TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS visitantes_publicos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    qr_sessao_id INT,
                    evento VARCHAR(255),
                    nome VARCHAR(255) NOT NULL,
                    telefone VARCHAR(60),
                    email VARCHAR(255),
                    cidade VARCHAR(120),
                    pedido_oracao TEXT,
                    autoriza_telao TINYINT(1) NOT NULL DEFAULT 0,
                    status VARCHAR(30) NOT NULL DEFAULT 'novo',
                    exibido_por INT,
                    exibido_em DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS visitantes_publicos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    qr_sessao_id INTEGER,
                    evento TEXT,
                    nome TEXT NOT NULL,
                    telefone TEXT,
                    email TEXT,
                    cidade TEXT,
                    pedido_oracao TEXT,
                    autoriza_telao INTEGER NOT NULL DEFAULT 0,
                    status TEXT NOT NULL DEFAULT 'novo',
                    exibido_por INTEGER,
                    exibido_em TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_visitantes_publicos_igreja ON visitantes_publicos (igreja_id, status)'
            ]);
        })();
    }

    await engagementTablesReadyPromise;
}

async function listWhatsAppTemplates(igrejaId) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, nome, gatilho, conteudo, ativo, created_at, updated_at
         FROM whatsapp_templates
         WHERE igreja_id = ?
         ORDER BY nome ASC`,
        [igrejaId]
    );

    return rows;
}

async function getWhatsAppTemplateByTrigger(igrejaId, gatilho) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, nome, gatilho, conteudo, ativo
         FROM whatsapp_templates
         WHERE igreja_id = ? AND gatilho = ? AND ativo = 1
         ORDER BY id DESC
         LIMIT 1`,
        [igrejaId, gatilho]
    );

    return rows[0] || null;
}

async function createWhatsAppTemplate(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO whatsapp_templates (igreja_id, nome, gatilho, conteudo, ativo)
         VALUES (?, ?, ?, ?, ?)`,
        [payload.igrejaId, payload.nome, payload.gatilho, payload.conteudo, payload.ativo ? 1 : 0]
    );

    return result.insertId;
}

async function updateWhatsAppTemplate(id, igrejaId, payload) {
    await ensureEngagementTables();

    await pool.query(
        `UPDATE whatsapp_templates
         SET nome = ?, gatilho = ?, conteudo = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND igreja_id = ?`,
        [payload.nome, payload.gatilho, payload.conteudo, payload.ativo ? 1 : 0, id, igrejaId]
    );
}

async function createWhatsAppLog(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO whatsapp_logs (
            igreja_id, template_id, gatilho, destino, mensagem_renderizada,
            payload_json, status, provider_message_id, erro, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.templateId || null,
            payload.gatilho,
            payload.destino,
            payload.mensagem,
            JSON.stringify(payload.payload || {}),
            payload.status,
            payload.providerMessageId || null,
            payload.erro || null,
            payload.createdBy || null
        ]
    );

    return result.insertId;
}

async function listWhatsAppLogs(igrejaId, limit = 50) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, template_id, gatilho, destino, mensagem_renderizada,
                status, provider_message_id, erro, created_by, created_at
         FROM whatsapp_logs
         WHERE igreja_id = ?
         ORDER BY id DESC
         LIMIT ?`,
        [igrejaId, Number(limit) || 50]
    );

    return rows;
}

async function createAutocadastro(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO autocadastros (
            igreja_id, igreja_nome, nome, email, telefone, cidade, ministerio_interesse, observacao
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.igrejaNome,
            payload.nome,
            payload.email || null,
            payload.telefone || null,
            payload.cidade || null,
            payload.ministerioInteresse || null,
            payload.observacao || null
        ]
    );

    return result.insertId;
}

async function listAutocadastros(igrejaId, status) {
    await ensureEngagementTables();

    const values = [igrejaId];
    let sql = `
        SELECT id, igreja_id, igreja_nome, nome, email, telefone, cidade,
               ministerio_interesse, status, observacao, analisado_por, analisado_em, created_at
        FROM autocadastros
        WHERE igreja_id = ?
    `;

    if (status) {
        sql += ' AND status = ?';
        values.push(status);
    }

    sql += ' ORDER BY id DESC';

    const [rows] = await pool.query(sql, values);
    return rows;
}

async function getAutocadastroById(id, igrejaId) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, igreja_nome, nome, email, telefone, cidade,
                ministerio_interesse, status, observacao, created_at
         FROM autocadastros
         WHERE id = ? AND igreja_id = ?
         LIMIT 1`,
        [id, igrejaId]
    );

    return rows[0] || null;
}

async function updateAutocadastroStatus(id, igrejaId, status, analisadoPor, observacao) {
    await ensureEngagementTables();

    await pool.query(
        `UPDATE autocadastros
         SET status = ?, analisado_por = ?, analisado_em = CURRENT_TIMESTAMP, observacao = COALESCE(?, observacao)
         WHERE id = ? AND igreja_id = ?`,
        [status, analisadoPor, observacao || null, id, igrejaId]
    );
}

async function createMemberFromAutocadastro(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO membros (igreja_id, nome, email, telefone, cidade)
         VALUES (?, ?, ?, ?, ?)`,
        [payload.igrejaId, payload.nome, payload.email || null, payload.telefone || null, payload.cidade || null]
    );

    return result.insertId;
}

async function findUserByEmailAndChurch(email, igrejaId) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, email
         FROM usuarios
         WHERE email = ? AND igreja_id = ?
         LIMIT 1`,
        [email, igrejaId]
    );

    return rows[0] || null;
}

async function createMemberUser(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role)
         VALUES (?, ?, ?, ?, ?, 'membro')`,
        [payload.igrejaNome, payload.igrejaId, payload.nome, payload.email, payload.passwordHash]
    );

    return result.insertId;
}

async function createPortariaCheckin(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO portaria_checkins (
            igreja_id, visitante_id, nome_visitante, telefone, evento, origem, codigo_qr, status, checked_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.visitanteId || null,
            payload.nomeVisitante,
            payload.telefone || null,
            payload.evento || null,
            payload.origem || 'manual',
            payload.codigoQr || null,
            payload.status || 'entrada',
            payload.checkedBy || null
        ]
    );

    return result.insertId;
}

async function listPortariaCheckins(igrejaId, dateRef) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, visitante_id, nome_visitante, telefone, evento, origem, codigo_qr, status, checked_by, created_at
         FROM portaria_checkins
         WHERE igreja_id = ? AND DATE(created_at) = ?
         ORDER BY id DESC`,
        [igrejaId, dateRef]
    );

    return rows;
}

async function createPaymentLink(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO payment_links (
            igreja_id, descricao, valor, provider, payment_method, status,
            reference_code, url, status_detail, created_by
         ) VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.descricao,
            payload.valor,
            payload.provider,
            payload.paymentMethod || 'pix',
            payload.referenceCode,
            payload.url,
            payload.statusDetail || null,
            payload.createdBy || null
        ]
    );

    return result.insertId;
}

async function listPaymentLinks(igrejaId) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, descricao, valor, provider, payment_method, status, reference_code,
                url, status_detail, paid_at, created_at
         FROM payment_links
         WHERE igreja_id = ?
         ORDER BY id DESC`,
        [igrejaId]
    );

    return rows;
}

async function markPaymentAsPaid(id, igrejaId) {
    await ensureEngagementTables();

    await pool.query(
        `UPDATE payment_links
         SET status = 'pago', paid_at = CURRENT_TIMESTAMP
         WHERE id = ? AND igreja_id = ?`,
        [id, igrejaId]
    );
}

async function getPaymentLinkByReference(referenceCode) {
    await ensureEngagementTables();

    const safeRef = String(referenceCode || '').trim();
    const decodedRef = (() => {
        try {
            return decodeURIComponent(safeRef);
        } catch (_error) {
            return safeRef;
        }
    })();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, descricao, valor, provider, payment_method, status,
                reference_code, url, status_detail, paid_at, created_at
         FROM payment_links
         WHERE reference_code = ? OR reference_code = ? OR reference_code LIKE ?
         ORDER BY created_at DESC
         LIMIT 1`,
        [safeRef, decodedRef, `${decodedRef}%`]
    );

    return rows[0] || null;
}

async function markPaymentAsClientReported(id, igrejaId, statusDetail) {
    await ensureEngagementTables();

    await pool.query(
        `UPDATE payment_links
         SET status = 'aguardando_confirmacao',
             status_detail = ?
         WHERE id = ? AND igreja_id = ? AND status = 'pendente'`,
        [statusDetail || null, id, igrejaId]
    );
}

async function createQrSession(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO portaria_qr_sessoes (
            igreja_id, evento, token, expira_em, ativo, created_by
         ) VALUES (?, ?, ?, ?, 1, ?)`,
        [
            payload.igrejaId,
            payload.evento,
            payload.token,
            payload.expiraEm || null,
            payload.createdBy || null
        ]
    );

    return result.insertId;
}

async function getQrSessionByToken(token) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, igreja_id, evento, token, expira_em, ativo, created_at
         FROM portaria_qr_sessoes
         WHERE token = ?
         LIMIT 1`,
        [token]
    );

    return rows[0] || null;
}

async function createPublicVisitor(payload) {
    await ensureEngagementTables();

    const [result] = await pool.query(
        `INSERT INTO visitantes_publicos (
            igreja_id, qr_sessao_id, evento, nome, telefone, email, cidade,
            pedido_oracao, autoriza_telao, status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'novo')`,
        [
            payload.igrejaId,
            payload.qrSessaoId,
            payload.evento,
            payload.nome,
            payload.telefone || null,
            payload.email || null,
            payload.cidade || null,
            payload.pedidoOracao || null,
            payload.autorizaTelao ? 1 : 0
        ]
    );

    return result.insertId;
}

async function listMidiaVisitors(igrejaId, status) {
    await ensureEngagementTables();

    const values = [igrejaId];
    let sql = `
        SELECT id, evento, nome, telefone, email, cidade, pedido_oracao,
               autoriza_telao, status, exibido_por, exibido_em, created_at
        FROM visitantes_publicos
        WHERE igreja_id = ? AND autoriza_telao = 1
    `;

    if (status) {
        sql += ' AND status = ?';
        values.push(status);
    }

    sql += ' ORDER BY id DESC';

    const [rows] = await pool.query(sql, values);
    return rows;
}

async function updateMidiaVisitorStatus(id, igrejaId, status, userId) {
    await ensureEngagementTables();

    const shouldSetExibido = status === 'exibido';
    await pool.query(
        `UPDATE visitantes_publicos
         SET status = ?,
             exibido_por = ?,
             exibido_em = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE exibido_em END
         WHERE id = ? AND igreja_id = ?`,
        [status, userId || null, shouldSetExibido ? 1 : 0, id, igrejaId]
    );
}

async function listVisitorsForTelao(igrejaId) {
    await ensureEngagementTables();

    const [rows] = await pool.query(
        `SELECT id, evento, nome, cidade, pedido_oracao, created_at
         FROM visitantes_publicos
         WHERE igreja_id = ? AND autoriza_telao = 1 AND status = 'selecionado'
         ORDER BY id DESC
         LIMIT 20`,
        [igrejaId]
    );

    return rows;
}

module.exports = {
    createAutocadastro,
    createMemberFromAutocadastro,
    createMemberUser,
    createPaymentLink,
    createPortariaCheckin,
    createWhatsAppLog,
    createWhatsAppTemplate,
    findUserByEmailAndChurch,
    getAutocadastroById,
    getWhatsAppTemplateByTrigger,
    listAutocadastros,
    listMidiaVisitors,
    listPaymentLinks,
    getPaymentLinkByReference,
    listPortariaCheckins,
    listVisitorsForTelao,
    listWhatsAppLogs,
    listWhatsAppTemplates,
    markPaymentAsClientReported,
    markPaymentAsPaid,
    createQrSession,
    createPublicVisitor,
    getQrSessionByToken,
    updateMidiaVisitorStatus,
    updateAutocadastroStatus,
    updateWhatsAppTemplate
};
