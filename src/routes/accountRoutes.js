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
// ── Configurações da Igreja ───────────────────────────────────────────────────

/** GET /api/church/config — retorna nome + config_personalizada_json + app_config */
router.get('/api/church/config', requireAuth, async (req, res) => {
    try {
        const igrejaId = req.auth?.igrejaId;
        if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });

        const [[igRow]] = await pool.query(
            'SELECT nome, config_personalizada_json FROM igrejas WHERE id = ? LIMIT 1',
            [igrejaId]
        );

        const [[cfgRow]] = await pool.query(
            'SELECT logo_url, whatsapp FROM app_config WHERE igreja_id = ? LIMIT 1',
            [igrejaId]
        ).catch(() => [[null]]);

        let cfg = {};
        try { cfg = JSON.parse(igRow?.config_personalizada_json || '{}'); } catch (_) {}

        return res.json({
            nome:     igRow?.nome    || '',
            logo_url: cfgRow?.logo_url  || cfg.logo_url  || '',
            whatsapp: cfgRow?.whatsapp  || cfg.whatsapp  || '',
            config:   cfg
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

/** PATCH /api/church/config — salva nome + campos de config_personalizada_json */
router.patch('/api/church/config', requireAuth, async (req, res) => {
    const { authorize } = require('../middlewares/auth');
    const igrejaId = req.auth?.igrejaId;
    if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });

    // Apenas admin pode alterar configurações da igreja
    const role = String(req.auth?.role || '').toLowerCase();
    if (!['admin', 'super-admin', 'super_admin', 'superadmin', 'master', 'owner'].includes(role)) {
        return res.status(403).json({ error: 'Sem permissão.' });
    }

    try {
        const {
            nome, logo_url, whatsapp,
            // campos que vão em config_personalizada_json
            cnpj, endereco, numero, bairro, cidade, estado, telefone, email,
            pastor, site, numeracao_ficha, msg_boas_vindas
        } = req.body || {};

        // Lê config atual para fazer merge
        const [[igRow]] = await pool.query(
            'SELECT config_personalizada_json FROM igrejas WHERE id = ? LIMIT 1',
            [igrejaId]
        );
        let cfg = {};
        try { cfg = JSON.parse(igRow?.config_personalizada_json || '{}'); } catch (_) {}

        // Merge dos campos fornecidos
        const campos = { cnpj, endereco, numero, bairro, cidade, estado, telefone, email, pastor, site, numeracao_ficha, msg_boas_vindas };
        for (const [k, v] of Object.entries(campos)) {
            if (v !== undefined && v !== null) cfg[k] = String(v).trim();
        }
        if (logo_url !== undefined) cfg.logo_url = String(logo_url || '').trim();
        if (whatsapp  !== undefined) cfg.whatsapp  = String(whatsapp  || '').trim();

        const igrejaSets = ['config_personalizada_json = ?'];
        const igrejaVals = [JSON.stringify(cfg)];
        if (nome && String(nome).trim()) {
            igrejaSets.push('nome = ?');
            igrejaVals.push(String(nome).trim());
        }
        igrejaVals.push(igrejaId);
        await pool.query(`UPDATE igrejas SET ${igrejaSets.join(', ')} WHERE id = ?`, igrejaVals);

        // Atualiza app_config (logo + whatsapp)
        if (logo_url !== undefined || whatsapp !== undefined) {
            const logoVal = logo_url !== undefined ? String(logo_url || '').trim() : null;
            const wppVal  = whatsapp  !== undefined ? String(whatsapp  || '').trim() : null;

            const [[existing]] = await pool.query(
                'SELECT id FROM app_config WHERE igreja_id = ? LIMIT 1', [igrejaId]
            ).catch(() => [[null]]);

            if (existing?.id) {
                const sets = [];
                const vals = [];
                if (logoVal !== null) { sets.push('logo_url = ?'); vals.push(logoVal); }
                if (wppVal  !== null) { sets.push('whatsapp = ?');  vals.push(wppVal);  }
                if (sets.length) {
                    sets.push('updated_at = CURRENT_TIMESTAMP');
                    vals.push(igrejaId);
                    await pool.query(`UPDATE app_config SET ${sets.join(', ')} WHERE igreja_id = ?`, vals).catch(() => {});
                }
            } else {
                await pool.query(
                    'INSERT INTO app_config (igreja_id, logo_url, whatsapp, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                    [igrejaId, logoVal || null, wppVal || null]
                ).catch(() => {});
            }
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/app/meu-token — retorna o public_token da igreja autenticada (para o admin compartilhar com membros) */
router.get('/api/app/meu-token', requireAuth, async (req, res) => {
    try {
        const igrejaId = req.auth?.igrejaId;
        if (!igrejaId) return res.status(401).json({ error: 'Sem contexto de igreja.' });

        const crypto = require('crypto');

        // Garante que a coluna existe (idempotente)
        try { await pool.query('ALTER TABLE igrejas ADD COLUMN public_token VARCHAR(64)'); } catch (_) {}

        const [rows] = await pool.query(
            'SELECT public_token FROM igrejas WHERE id = ? LIMIT 1',
            [igrejaId]
        );
        let token = rows[0]?.public_token || null;

        // Gera o token se a igreja ainda não tiver um (backfill sob demanda)
        if (!token) {
            token = crypto.randomBytes(20).toString('hex');
            await pool.query(
                "UPDATE igrejas SET public_token = ? WHERE id = ? AND (public_token IS NULL OR public_token = '')",
                [token, igrejaId]
            );
        }

        return res.json({ publicToken: token });
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