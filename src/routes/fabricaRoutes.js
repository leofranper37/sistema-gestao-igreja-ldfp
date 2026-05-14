const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const { pool } = require('../config/db');
const moduleAccessService = require('../services/moduleAccessService');

const router = express.Router();
const isSuperAdmin = [requireAuth, authorize(['super-admin', 'admin'])];

function normalizeModulePayload(items = []) {
    return Array.isArray(items)
        ? items.map((item) => ({
            slug: item.slug || item.modulo_slug,
            ativo: item.ativo !== undefined ? Boolean(item.ativo) : true
        })).filter((item) => String(item.slug || '').trim())
        : [];
}

router.get('/planos-com-modulos', ...isSuperAdmin, async (req, res) => {
    try {
        const [planos] = await pool.query('SELECT * FROM saas_planos ORDER BY preco_mensal ASC');
        const [modulos] = await pool.query('SELECT * FROM saas_modulos WHERE ativo = 1 ORDER BY nome ASC');

        const [links] = await pool.query('SELECT plano_slug, modulo_slug, ativo FROM saas_plano_modulos');
        const linkSet = new Map();
        (links || []).forEach((link) => {
            linkSet.set(`${String(link.plano_slug).trim().toLowerCase()}_${String(link.modulo_slug).trim().toLowerCase()}`, Number(link.ativo) === 1);
        });

        const resultado = (planos || []).map((plano) => ({
            ...plano,
            modulos: (modulos || []).map((modulo) => ({
                ...modulo,
                ativo: linkSet.has(`${String(plano.slug).trim().toLowerCase()}_${String(modulo.slug).trim().toLowerCase()}`)
                    ? linkSet.get(`${String(plano.slug).trim().toLowerCase()}_${String(modulo.slug).trim().toLowerCase()}`)
                    : false
            }))
        }));

        res.json({ planos: resultado, modulos: modulos || [] });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao carregar fábrica.' });
    }
});

router.put('/plano/:planoSlug/modulos', ...isSuperAdmin, async (req, res) => {
    try {
        const planoSlug = String(req.params.planoSlug || '').trim().toLowerCase();
        const modules = normalizeModulePayload(req.body?.modules || req.body?.modulos || []);

        const updated = await moduleAccessService.replacePlanModules(
            planoSlug,
            modules.map((item) => ({ modulo_slug: item.slug, ativo: item.ativo }))
        );

        res.json({ ok: true, planoSlug, modules: updated });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Erro ao salvar módulos do plano.' });
    }
});

router.get('/igreja/:igrejaId/modulos', ...isSuperAdmin, async (req, res) => {
    try {
        const igrejaId = Number(req.params.igrejaId);
        if (!igrejaId) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const [churchRows] = await pool.query('SELECT id, nome, plano FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
        const igreja = churchRows?.[0];
        if (!igreja) {
            return res.status(404).json({ error: 'Igreja não encontrada.' });
        }

        const modules = await moduleAccessService.getChurchModules(igrejaId, igreja.plano || 'eden');
        res.json({ igreja, modules });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Erro ao carregar módulos da igreja.' });
    }
});

router.put('/igreja/:igrejaId/modulos', ...isSuperAdmin, async (req, res) => {
    try {
        const igrejaId = Number(req.params.igrejaId);
        if (!igrejaId) {
            return res.status(400).json({ error: 'ID inválido.' });
        }

        const modules = normalizeModulePayload(req.body?.modules || req.body?.modulos || []);
        const updated = await moduleAccessService.replaceChurchOverrides(
            igrejaId,
            modules.map((item) => ({ modulo_slug: item.slug, ativo: item.ativo }))
        );

        res.json({ ok: true, igrejaId, modules: updated });
    } catch (error) {
        res.status(400).json({ error: error.message || 'Erro ao salvar override.' });
    }
});

module.exports = router;
