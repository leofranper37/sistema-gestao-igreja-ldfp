const express = require('express');
const { listPlanosPublico } = require('../controllers/superAdminController');

const { createConta, login, esqueciSenha, redefinirSenha } = require('../controllers/accountController');
const { createContaSchema, loginSchema, validateBody } = require('../utils/validation');
const { pool } = require('../config/db');

const router = express.Router();

// Rota publica de autocadastro.
router.get('/api/planos', listPlanosPublico);
router.post('/criar-conta', validateBody(createContaSchema), createConta);
router.post('/api/cadastro-igreja', validateBody(createContaSchema), createConta);
router.post('/login', validateBody(loginSchema), login);
router.post('/esqueci-senha', esqueciSenha);
router.post('/redefinir-senha', redefinirSenha);

// Solicitar redefinição de senha via admin (registra pedido)
// ─── ONBOARDING ──────────────────────────────────────────────────────────────
const { requireAuth } = require('../middlewares/auth');

/** GET /api/church/onboarding/status */
router.get('/api/church/onboarding/status', requireAuth, async (req, res) => {
    try {
        const igrejaId = req.auth?.igrejaId;
        if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });
        const [rows] = await pool.query(
            'SELECT config_personalizada_json FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]
        );
        let completo = false;
        if (rows[0]?.config_personalizada_json) {
            try {
                const cfg = JSON.parse(rows[0].config_personalizada_json);
                completo = Boolean(cfg?.onboarding_completo);
            } catch (_) {}
        }
        return res.json({ completo });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/** PATCH /api/church/onboarding/step1 — salva logo + whatsapp em app_config */
router.patch('/api/church/onboarding/step1', requireAuth, async (req, res) => {
    try {
        const igrejaId = req.auth?.igrejaId;
        if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });
        const logoUrl   = String(req.body?.logoUrl   || '').trim() || null;
        const whatsapp  = String(req.body?.whatsapp  || '').trim() || null;
        const msgBoas   = String(req.body?.msgBoasVindas || '').trim() || null;
        const nomeFantasia = String(req.body?.nomeFantasia || '').trim() || null;

        // Atualiza app_config (upsert)
        const [upd] = await pool.query(
            `UPDATE app_config SET logo_url = ?, whatsapp = ?, updated_at = CURRENT_TIMESTAMP WHERE igreja_id = ?`,
            [logoUrl, whatsapp, igrejaId]
        );
        const affected = Number(upd?.affectedRows || upd?.rowCount || 0);
        if (!affected) {
            await pool.query(
                `INSERT INTO app_config (igreja_id, logo_url, whatsapp, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
                [igrejaId, logoUrl, whatsapp]
            );
        }
        // Atualiza mensagem/nome na tabela igrejas se fornecido
        const igrejaSets = [];
        const igrejaVals = [];
        if (nomeFantasia) { igrejaSets.push('nome = ?'); igrejaVals.push(nomeFantasia); }
        if (msgBoas !== null) { igrejaSets.push('config_personalizada_json = JSON_SET(COALESCE(config_personalizada_json, "{}"), "$.msg_boas_vindas", ?)'); igrejaVals.push(msgBoas); }
        if (igrejaSets.length) {
            igrejaVals.push(igrejaId);
            try {
                await pool.query(`UPDATE igrejas SET ${igrejaSets.join(', ')} WHERE id = ?`, igrejaVals);
            } catch (_) {
                // MySQL sem JSON_SET: fallback simples
                if (nomeFantasia) {
                    await pool.query('UPDATE igrejas SET nome = ? WHERE id = ?', [nomeFantasia, igrejaId]);
                }
            }
        }
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/** POST /api/church/onboarding/complete — marca onboarding como concluído */
router.post('/api/church/onboarding/complete', requireAuth, async (req, res) => {
    try {
        const igrejaId = req.auth?.igrejaId;
        if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });
        const [rows] = await pool.query(
            'SELECT config_personalizada_json FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]
        );
        let cfg = {};
        try { cfg = JSON.parse(rows[0]?.config_personalizada_json || '{}'); } catch (_) {}
        cfg.onboarding_completo = true;
        await pool.query(
            'UPDATE igrejas SET config_personalizada_json = ? WHERE id = ?',
            [JSON.stringify(cfg), igrejaId]
        );
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// ─────────────────────────────────────────────────────────────────────────────

router.post('/api/reset-request', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });
        const emailNorm = email.toLowerCase().trim();
        const [users] = await pool.query(
            `SELECT id, nome FROM usuarios WHERE email = ? LIMIT 1`, [emailNorm]
        );
        if (!users.length) return res.json({ ok: true }); // Não revelar se e-mail existe
        const nome = users[0].nome || '';
        await pool.query(
            `INSERT INTO password_reset_requests (email, nome, status) VALUES (?, ?, 'pendente')`,
            [emailNorm, nome]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;