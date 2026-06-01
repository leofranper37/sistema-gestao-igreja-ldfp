'use strict';

const logger = require('../config/logger');
const { pool } = require('../config/db');

// ── Criação lazy da tabela audit_logs ────────────────────────────────────────
let tableReady = false;

async function ensureAuditTable() {
    if (tableReady) return;
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_logs (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                igreja_id  INT          NULL,
                user_id    INT          NULL,
                user_email VARCHAR(255) NULL,
                user_role  VARCHAR(60)  NULL,
                action     VARCHAR(120) NOT NULL,
                method     VARCHAR(10)  NULL,
                path       VARCHAR(500) NULL,
                ip         VARCHAR(60)  NULL,
                details    LONGTEXT     NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_audit_logs_igreja  (igreja_id),
                INDEX idx_audit_logs_created (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
        tableReady = true;
    } catch (_) {
        // Se a tabela já existe ou o BD não suporta, ignora silenciosamente
        tableReady = true;
    }
}

// Inicia a criação sem bloquear
ensureAuditTable().catch(() => {});

// ── Função principal ─────────────────────────────────────────────────────────
function audit(action, req, details = {}) {
    const actor = req?.auth
        ? { userId: req.auth.id, email: req.auth.email, role: req.auth.role, igrejaId: req.auth.igrejaId }
        : null;

    // 1. Mantém log estruturado no logger (arquivo / console)
    logger.info('audit_event', {
        action,
        actor,
        method:  req?.method,
        path:    req?.originalUrl,
        ip:      req?.ip,
        details
    });

    // 2. Persiste no BD — fire-and-forget (não bloqueia a resposta HTTP)
    setImmediate(async () => {
        try {
            await ensureAuditTable();
            await pool.query(
                `INSERT INTO audit_logs
                 (igreja_id, user_id, user_email, user_role, action, method, path, ip, details)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    actor?.igrejaId  || null,
                    actor?.userId    || null,
                    actor?.email     || null,
                    actor?.role      || null,
                    String(action),
                    req?.method      || null,
                    req?.originalUrl ? String(req.originalUrl).slice(0, 500) : null,
                    req?.ip          || null,
                    details && Object.keys(details).length
                        ? JSON.stringify(details)
                        : null
                ]
            );
        } catch (_) {
            // Falha silenciosa — log de auditoria nunca deve derrubar a requisição
        }
    });
}

module.exports = { audit };
