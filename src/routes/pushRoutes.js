/**
 * Push Notification Routes — Web Push API
 * GET    /api/push/vapid-public-key  → retorna a chave pública VAPID
 * POST   /api/push/subscribe         → salva subscription (membro, sem JWT)
 * DELETE /api/push/subscribe         → remove subscription pelo endpoint
 * POST   /api/push/send              → envia push para todos da igreja (requireAuth admin)
 */

const express = require('express');
const router  = express.Router();
const webpush = require('web-push');
const { pool } = require('../config/db');
const { requireAuth, authorize } = require('../middlewares/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Obtém (ou gera e persiste) as chaves VAPID via tabela sistema_config.
 * Assim não precisa de variável de ambiente manual.
 */
async function getOrCreateVapidKeys() {
    const [rows] = await pool.query(
        `SELECT config_key, config_value FROM sistema_config
         WHERE config_key IN ('vapid_public_key','vapid_private_key','vapid_subject')`
    );
    const map = {};
    for (const r of rows) map[r.config_key] = r.config_value;

    if (map.vapid_public_key && map.vapid_private_key) {
        return {
            publicKey:  map.vapid_public_key,
            privateKey: map.vapid_private_key,
            subject:    map.vapid_subject || 'mailto:admin@ldfp.com.br'
        };
    }

    // Primeira execução: gerar e persistir
    const { publicKey, privateKey } = webpush.generateVAPIDKeys();
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@ldfp.com.br';

    await pool.query(
        `INSERT INTO sistema_config (config_key, config_value) VALUES
            ('vapid_public_key',  ?),
            ('vapid_private_key', ?),
            ('vapid_subject',     ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [publicKey, privateKey, subject]
    );

    console.log('[push] Chaves VAPID geradas e salvas.');
    return { publicKey, privateKey, subject };
}

// ─── GET /api/push/vapid-public-key ──────────────────────────────────────────
router.get('/api/push/vapid-public-key', async (_req, res) => {
    try {
        const { publicKey } = await getOrCreateVapidKeys();
        res.json({ publicKey });
    } catch (err) {
        console.error('[push] vapid-public-key error:', err);
        res.status(500).json({ erro: 'Falha ao obter chave VAPID' });
    }
});

// ─── POST /api/push/subscribe ─────────────────────────────────────────────────
// Usado pelo app_membro_v2 (sem JWT). Recebe igrejaId no body.
router.post('/api/push/subscribe', async (req, res) => {
    const { endpoint, keys, igrejaId } = req.body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return res.status(400).json({ erro: 'Dados de subscription inválidos' });
    }
    if (!igrejaId) {
        return res.status(400).json({ erro: 'igrejaId obrigatório' });
    }

    try {
        await pool.query(
            `INSERT INTO push_subscriptions (igreja_id, endpoint, p256dh, auth_key)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               p256dh    = VALUES(p256dh),
               auth_key  = VALUES(auth_key),
               igreja_id = VALUES(igreja_id)`,
            [Number(igrejaId), endpoint, keys.p256dh, keys.auth]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[push] subscribe error:', err);
        res.status(500).json({ erro: 'Falha ao salvar subscription' });
    }
});

// ─── DELETE /api/push/subscribe ──────────────────────────────────────────────
router.delete('/api/push/subscribe', async (req, res) => {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ erro: 'endpoint obrigatório' });

    try {
        await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ erro: 'Falha ao remover subscription' });
    }
});

// ─── POST /api/push/send ──────────────────────────────────────────────────────
// Apenas admins/super-admins podem enviar para seus membros.
router.post('/api/push/send',
    requireAuth,
    authorize('admin', 'super-admin', 'super_admin', 'master'),
    async (req, res) => {
        const { titulo, corpo, url } = req.body || {};
        if (!titulo) return res.status(400).json({ erro: 'titulo obrigatório' });

        const igrejaId = req.auth.igrejaId;

        try {
            const { publicKey, privateKey, subject } = await getOrCreateVapidKeys();
            webpush.setVapidDetails(subject, publicKey, privateKey);

            const [subs] = await pool.query(
                'SELECT endpoint, p256dh, auth_key FROM push_subscriptions WHERE igreja_id = ?',
                [igrejaId]
            );

            if (!subs.length) {
                return res.json({ ok: true, enviados: 0, falhas: 0, msg: 'Nenhum assinante registrado' });
            }

            const payload = JSON.stringify({
                title: titulo,
                body:  corpo  || '',
                icon:  '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                data:  { url: url || '/app_membro_v2.html' }
            });

            let enviados = 0;
            let falhas   = 0;
            const expirados = [];

            await Promise.allSettled(
                subs.map(async (sub) => {
                    const pushSub = {
                        endpoint: sub.endpoint,
                        keys: { p256dh: sub.p256dh, auth: sub.auth_key }
                    };
                    try {
                        await webpush.sendNotification(pushSub, payload);
                        enviados++;
                    } catch (err) {
                        falhas++;
                        // 410 Gone / 404 = subscription expirada ou cancelada pelo usuário
                        if (err.statusCode === 410 || err.statusCode === 404) {
                            expirados.push(sub.endpoint);
                        }
                    }
                })
            );

            // Limpar subscriptions expiradas
            for (const ep of expirados) {
                await pool.query(
                    'DELETE FROM push_subscriptions WHERE endpoint = ?', [ep]
                ).catch(() => {});
            }

            res.json({ ok: true, enviados, falhas, total: subs.length });
        } catch (err) {
            console.error('[push] send error:', err);
            res.status(500).json({ erro: 'Falha ao enviar notificações' });
        }
    }
);

module.exports = router;
