const { pool } = require('../config/db');
const moduleAccessService = require('../services/moduleAccessService');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── helpers ─────────────────────────────────────────────────────────────────

function fmt(v) { return Number(v) || 0; }

function safeJson(str, fallback = []) {
    try { return JSON.parse(str); } catch (_) { return fallback; }
}

function normDate(v) {
    if (!v) return null;
    const s = String(v).trim();
    // accept ISO date: YYYY-MM-DD → convert to ISO datetime
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00.000Z' : s;
}

function addDays(baseDate, days) {
    const amount = Number(days) || 0;
    if (!amount) return baseDate;
    const next = new Date(baseDate);
    next.setUTCDate(next.getUTCDate() + amount);
    return next;
}

// ── Dashboard Overview ───────────────────────────────────────────────────────

async function getSuperAdminOverview(req, res) {
    try {
        const [igrejas] = await pool.query(
            `SELECT status_assinatura, mensalidade_valor, trial_ends_at FROM igrejas`
        );
        const total = igrejas.length;
        const ativas = igrejas.filter(r => r.status_assinatura === 'ativa').length;
        const trial = igrejas.filter(r => r.status_assinatura === 'trial').length;
        const suspensas = igrejas.filter(r => r.status_assinatura === 'suspensa').length;
        const now = new Date();
        const trialExpirando = igrejas.filter((r) => {
            if (r.status_assinatura !== 'trial' || !r.trial_ends_at) return false;
            const trialEndsAt = new Date(r.trial_ends_at);
            if (Number.isNaN(trialEndsAt.getTime())) return false;
            const diffDays = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000);
            return diffDays >= 0 && diffDays <= 3;
        }).length;
        const trialExpirado = igrejas.filter((r) => {
            if (r.status_assinatura !== 'trial' || !r.trial_ends_at) return false;
            const trialEndsAt = new Date(r.trial_ends_at);
            return !Number.isNaN(trialEndsAt.getTime()) && trialEndsAt < now;
        }).length;
        const mrr = igrejas
            .filter(r => r.status_assinatura === 'ativa')
            .reduce((s, r) => s + fmt(r.mensalidade_valor), 0);

        const [pending] = await pool.query(
            `SELECT COUNT(*) AS cnt, COALESCE(SUM(valor),0) AS total
             FROM payment_links WHERE status = 'pendente'`
        );
        const pendingCount = fmt(pending[0]?.cnt);
        const pendingAmount = fmt(pending[0]?.total);

        const [customers] = await pool.query(
            `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                    i.responsavel AS responsavel_nome,
                    i.email_admin AS responsavel_email,
                    i.mensalidade_valor, i.proximo_vencimento,
                    i.trial_ends_at, i.max_cadastros, i.created_at,
                    COUNT(m.id) AS membros_ativos
             FROM igrejas i
             LEFT JOIN membros m ON m.igreja_id = i.id
             GROUP BY i.id
             ORDER BY i.created_at DESC`
        );

        res.json({
            kpis: { mrr, activeChurches: ativas, pendingPayments: pendingCount, pendingAmount, total, trial, suspensas, trialExpirando, trialExpirado },
            customers: customers || []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── MRR Timeseries (últimos 6 meses) ────────────────────────────────────────

async function getSaasFaturamento(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT strftime('%Y-%m', paid_at) AS mes, COALESCE(SUM(valor),0) AS total
             FROM payment_links
             WHERE status = 'pago'
               AND paid_at >= datetime('now', '-6 months')
             GROUP BY mes
             ORDER BY mes ASC`
        ).catch(async () => {
            // MySQL/PG fallback
            const [r] = await pool.query(
                `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS mes, COALESCE(SUM(valor),0) AS total
                 FROM payment_links
                 WHERE status = 'pago'
                   AND paid_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                 GROUP BY mes
                 ORDER BY mes ASC`
            ).catch(async () => {
                const [r2] = await pool.query(
                    `SELECT TO_CHAR(paid_at,'YYYY-MM') AS mes, COALESCE(SUM(valor),0) AS total
                     FROM payment_links
                     WHERE status = 'pago'
                       AND paid_at >= NOW() - INTERVAL '6 months'
                     GROUP BY mes
                     ORDER BY mes ASC`
                );
                return [r2];
            });
            return [r];
        });

        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Listar Igrejas ───────────────────────────────────────────────────────────

async function getSaasIgrejas(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                    i.responsavel, i.email_admin, i.telefone, i.cnpj,
                    i.mensalidade_valor, i.proximo_vencimento, i.created_at,
                    i.trial_starts_at, i.trial_ends_at,
                    COUNT(m.id) AS total_membros
             FROM igrejas i
             LEFT JOIN membros m ON m.igreja_id = i.id
             GROUP BY i.id
             ORDER BY i.created_at DESC`
        );
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Detalhe / Contrato de uma Igreja ────────────────────────────────────────

async function getSaasIgrejaContrato(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    try {
        const [rows] = await pool.query(`SELECT * FROM igrejas WHERE id = ? LIMIT 1`, [id]);
        if (!rows.length) return res.status(404).json({ error: 'Igreja não encontrada.' });
        const ig = rows[0];
        if (ig.modulos_ativos) ig.modulos_ativos = safeJson(ig.modulos_ativos, []);
        res.json(ig);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Alterar status de uma Igreja ────────────────────────────────────────────

async function patchIgrejaStatus(req, res) {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const allowed = ['ativa', 'suspensa', 'cancelada', 'trial', 'inativa'];
    if (!id) return res.status(400).json({ error: 'ID inválido.' });
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Status inválido.' });
    try {
        await pool.query(`UPDATE igrejas SET status_assinatura = ? WHERE id = ?`, [status, id]);
        res.json({ ok: true, id, status });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Atualizar contrato de uma Igreja ────────────────────────────────────────

async function updateSaasIgrejaContrato(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    const {
        nome, plano, status_assinatura,
        responsavel, email_admin, telefone, cnpj,
        mensalidade_valor, proximo_vencimento,
        trial_starts_at, trial_ends_at, trial_extension_days,
        max_cadastros, max_congregacoes,
        modulo_app_membro, modulo_app_midia, modulo_ebd,
        modulo_agenda_eventos, modulo_escala_culto,
        modulo_pedidos_oracao, modulo_mural_oracao
    } = req.body || {};

    const fields = [];
    const vals = [];

    const set = (col, v) => { if (v !== undefined) { fields.push(`${col} = ?`); vals.push(v); } };

    set('nome', nome || undefined);
    set('plano', plano || undefined);
    set('status_assinatura', status_assinatura || undefined);
    set('responsavel', responsavel);
    set('email_admin', email_admin);
    set('telefone', telefone);
    set('cnpj', cnpj);
    set('mensalidade_valor', mensalidade_valor !== undefined ? fmt(mensalidade_valor) : undefined);
    set('proximo_vencimento', normDate(proximo_vencimento));
    set('trial_starts_at', normDate(trial_starts_at));
    set('trial_ends_at', normDate(trial_ends_at));
    set('max_cadastros', max_cadastros !== undefined ? Number(max_cadastros) : undefined);
    set('max_congregacoes', max_congregacoes !== undefined ? Number(max_congregacoes) : undefined);
    set('modulo_app_membro', modulo_app_membro !== undefined ? (modulo_app_membro ? 1 : 0) : undefined);
    set('modulo_app_midia', modulo_app_midia !== undefined ? (modulo_app_midia ? 1 : 0) : undefined);
    set('modulo_ebd', modulo_ebd !== undefined ? (modulo_ebd ? 1 : 0) : undefined);
    set('modulo_agenda_eventos', modulo_agenda_eventos !== undefined ? (modulo_agenda_eventos ? 1 : 0) : undefined);
    set('modulo_escala_culto', modulo_escala_culto !== undefined ? (modulo_escala_culto ? 1 : 0) : undefined);
    set('modulo_pedidos_oracao', modulo_pedidos_oracao !== undefined ? (modulo_pedidos_oracao ? 1 : 0) : undefined);
    set('modulo_mural_oracao', modulo_mural_oracao !== undefined ? (modulo_mural_oracao ? 1 : 0) : undefined);

    const extensionDays = Number(trial_extension_days) || 0;

    if (!fields.length && !extensionDays) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

    try {
        if (extensionDays) {
            const [currentRows] = await pool.query(
                `SELECT trial_ends_at FROM igrejas WHERE id = ? LIMIT 1`,
                [id]
            );

            if (!currentRows.length) {
                return res.status(404).json({ error: 'Igreja não encontrada.' });
            }

            const currentTrialEndsAt = currentRows[0]?.trial_ends_at ? new Date(currentRows[0].trial_ends_at) : null;
            const baseDate = currentTrialEndsAt && !Number.isNaN(currentTrialEndsAt.getTime()) && currentTrialEndsAt > new Date()
                ? currentTrialEndsAt
                : new Date();

            fields.push('trial_ends_at = ?');
            vals.push(addDays(baseDate, extensionDays).toISOString());
        }

        vals.push(id);
        await pool.query(`UPDATE igrejas SET ${fields.join(', ')} WHERE id = ?`, vals);
        const [updated] = await pool.query(`SELECT * FROM igrejas WHERE id = ? LIMIT 1`, [id]);
        res.json(updated[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Planos ───────────────────────────────────────────────────────────────────

async function listPlanosPublico(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT slug, nome, subtitulo, versiculo, preco_mensal, preco_anual,
                    max_cadastros, max_congregacoes, modulo_app_membro, features_json
             FROM saas_planos WHERE ativo = 1 ORDER BY preco_mensal ASC`
        );
        const result = rows.map(r => ({ ...r, features: safeJson(r.features_json, []) }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function listPlanos(req, res) {
    try {
        const [rows] = await pool.query(`SELECT * FROM saas_planos ORDER BY preco_mensal ASC`);
        const result = rows.map(r => ({ ...r, features: safeJson(r.features_json, []) }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function getPlano(req, res) {
    const slug = req.params.slug;
    try {
        const [rows] = await pool.query(`SELECT * FROM saas_planos WHERE slug = ? LIMIT 1`, [slug]);
        if (!rows.length) return res.status(404).json({ error: 'Plano não encontrado.' });
        const r = rows[0];
        res.json({ ...r, features: safeJson(r.features_json, []) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function updatePlano(req, res) {
    const slug = req.params.slug;
    const {
        nome, subtitulo, versiculo,
        preco_mensal, preco_anual,
        max_cadastros, max_congregacoes,
        modulo_app_membro, features, ativo
    } = req.body || {};

    const fields = [];
    const vals = [];
    const set = (col, v) => { if (v !== undefined && v !== null) { fields.push(`${col} = ?`); vals.push(v); } };

    set('nome', nome);
    set('subtitulo', subtitulo);
    set('versiculo', versiculo);
    set('preco_mensal', preco_mensal !== undefined ? fmt(preco_mensal) : undefined);
    set('preco_anual', preco_anual !== undefined ? fmt(preco_anual) : undefined);
    set('max_cadastros', max_cadastros !== undefined ? Number(max_cadastros) : undefined);
    set('max_congregacoes', max_congregacoes !== undefined ? Number(max_congregacoes) : undefined);
    set('modulo_app_membro', modulo_app_membro !== undefined ? (modulo_app_membro ? 1 : 0) : undefined);
    if (features !== undefined) { fields.push('features_json = ?'); vals.push(JSON.stringify(features)); }
    if (ativo !== undefined) { fields.push('ativo = ?'); vals.push(ativo ? 1 : 0); }
    if (fields.length) { fields.push('updated_at = CURRENT_TIMESTAMP'); }

    if (!fields.length) return res.status(400).json({ error: 'Nenhum campo para atualizar.' });

    try {
        vals.push(slug);
        await pool.query(`UPDATE saas_planos SET ${fields.join(', ')} WHERE slug = ?`, vals);
        const [updated] = await pool.query(`SELECT * FROM saas_planos WHERE slug = ? LIMIT 1`, [slug]);
        if (!updated.length) return res.status(404).json({ error: 'Plano não encontrado.' });
        const r = updated[0];
        res.json({ ...r, features: safeJson(r.features_json, []) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Assinaturas / Faturas SaaS ─────────────────────────────────────────────

async function listSaasAssinaturas(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT p.id, p.igreja_id, p.descricao, p.valor, p.status, p.provider,
                    p.payment_method, p.url, p.reference_code, p.created_at, p.paid_at,
                    i.nome AS igreja_nome, i.plano, i.status_assinatura
             FROM payment_links p
             LEFT JOIN igrejas i ON i.id = p.igreja_id
             ORDER BY p.created_at DESC
             LIMIT 500`
        );
        res.json(rows || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function markSaasAssinaturaPaga(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    try {
        await pool.query(
            `UPDATE payment_links
             SET status = 'pago', paid_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [id]
        );

        const [rows] = await pool.query(
            `SELECT id, status, paid_at
             FROM payment_links
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Fatura não encontrada.' });
        }

        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Catálogo de Módulos (SaaS) ──────────────────────────────────────────────

async function listSaasModulos(req, res) {
    try {
        const rows = await moduleAccessService.listCatalog(false);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function createSaasModulo(req, res) {
    try {
        const created = await moduleAccessService.createModule(req.body || {});
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

async function updateSaasModulo(req, res) {
    try {
        const updated = await moduleAccessService.updateModule(req.params.slug, req.body || {});
        if (!updated) return res.status(404).json({ error: 'Módulo não encontrado.' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

// ── Módulos por Plano ───────────────────────────────────────────────────────

async function getPlanoModulos(req, res) {
    try {
        const rows = await moduleAccessService.getPlanModules(req.params.slug);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function putPlanoModulos(req, res) {
    try {
        const updated = await moduleAccessService.replacePlanModules(req.params.slug, req.body?.modules || []);
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

// ── Módulos por Igreja (override) ───────────────────────────────────────────

async function getIgrejaModulos(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    try {
        const [churchRows] = await pool.query(`SELECT plano FROM igrejas WHERE id = ? LIMIT 1`, [id]);
        if (!churchRows.length) return res.status(404).json({ error: 'Igreja não encontrada.' });
        const rows = await moduleAccessService.getChurchModules(id, churchRows[0].plano);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

async function putIgrejaModulos(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    try {
        const [churchRows] = await pool.query(`SELECT id, plano FROM igrejas WHERE id = ? LIMIT 1`, [id]);
        if (!churchRows.length) return res.status(404).json({ error: 'Igreja não encontrada.' });

        const updatedOverrides = await moduleAccessService.replaceChurchOverrides(id, req.body?.modules || []);
        res.json(updatedOverrides);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
}

// ── Acesso efetivo por usuário autenticado ─────────────────────────────────

async function getMyEffectiveModules(req, res) {
    try {
        const igrejaId = Number(req.auth?.igrejaId || 0);
        const plano = req.auth?.plano || 'eden';

        if (!igrejaId) {
            return res.status(400).json({ error: 'Usuário sem igreja vinculada.' });
        }

        const access = await moduleAccessService.getEffectiveAccessForChurch(igrejaId, plano);
        res.json({
            igrejaId,
            plano,
            modules: access.modules,
            featureKeys: access.featureKeys
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Dados do plano do usuário autenticado ─────────────────────────────────

async function getMinhaConta(req, res) {
    try {
        const igrejaId = req.auth.igrejaId;
        const planoSlug = req.auth.plano || 'eden';

        // Busca dados da igreja (limites reais, possivelmente sobrepostos pelo super-admin)
        const [igRows] = await pool.query(
            `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                    i.trial_ends_at, i.max_cadastros, i.max_congregacoes,
                    i.modulo_app_membro,
                    sp.nome AS plano_nome, sp.subtitulo AS plano_subtitulo,
                    sp.preco_mensal, sp.preco_anual, sp.features_json
             FROM igrejas i
             LEFT JOIN saas_planos sp ON sp.slug = i.plano
             WHERE i.id = ?
             LIMIT 1`,
            [igrejaId]
        );

        if (!igRows.length) {
            return res.status(404).json({ error: 'Igreja não encontrada.' });
        }

        const ig = igRows[0];

        // Verifica se app_membro está ativo via módulos efetivos
        const access = await moduleAccessService.getEffectiveAccessForChurch(igrejaId, planoSlug);
        const temAppMembro = access.featureKeys.includes('app_membro');

        // Define canal de suporte de acordo com o plano
        const suportePorPlano = {
            eden:   [],
            hebrom: ['email'],
            betel:  ['email', 'whatsapp'],
            siao:   ['email', 'whatsapp', 'telefone']
        };
        const suporte = suportePorPlano[planoSlug] || [];

        res.json({
            igreja: ig.nome,
            plano: planoSlug,
            plano_nome: ig.plano_nome || planoSlug,
            plano_subtitulo: ig.plano_subtitulo || '',
            preco_mensal: ig.preco_mensal || 0,
            preco_anual: ig.preco_anual || 0,
            status_assinatura: ig.status_assinatura || 'trial',
            trial_ends_at: ig.trial_ends_at || null,
            max_cadastros: ig.max_cadastros || 30,
            max_congregacoes: ig.max_congregacoes || 1,
            modulo_app_membro: temAppMembro,
            suporte,
            features: safeJson(ig.features_json, [])
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Sistema Config ───────────────────────────────────────────────────────────

async function getSistemaConfig(req, res) {
    try {
        const [rows] = await pool.query(`SELECT config_value FROM sistema_config WHERE config_key = 'main' LIMIT 1`);
        const cfg = rows.length ? safeJson(rows[0].config_value, {}) : {};
        res.json(cfg);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function putSistemaConfig(req, res) {
    try {
        const payload = req.body || {};
        const json = JSON.stringify(payload);
        await pool.query(
            `INSERT INTO sistema_config (config_key, config_value) VALUES ('main', ?)
             ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`,
            [json, json]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

function gitInfo() {
    let branch = 'unknown', shortHead = 'unknown';
    try { branch = execSync('git rev-parse --abbrev-ref HEAD', { timeout: 3000 }).toString().trim(); } catch (_) {}
    try { shortHead = execSync('git rev-parse --short HEAD', { timeout: 3000 }).toString().trim(); } catch (_) {}
    return { branch, shortHead };
}

async function getSistemaDiagnostico(req, res) {
    try {
        const git = gitInfo();
        const uptimeSec = Math.floor(process.uptime());

        const backupsDir = path.join(process.cwd(), 'backups');
        let backups = [];
        try {
            backups = fs.readdirSync(backupsDir).map(f => {
                const stats = fs.statSync(path.join(backupsDir, f));
                return { name: f, size: stats.size, updatedAt: stats.mtime.toISOString() };
            }).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 10);
        } catch (_) {}

        let lastCheckpoint = null;
        try {
            const [rows] = await pool.query(`SELECT nota, created_at FROM retomada_checkpoints ORDER BY created_at DESC LIMIT 1`);
            if (rows.length) lastCheckpoint = { note: rows[0].nota, at: rows[0].created_at };
        } catch (_) {}

        let focus = { currentObjective: '' };
        try {
            const [cfgRows] = await pool.query(`SELECT config_value FROM sistema_config WHERE config_key = 'retomada' LIMIT 1`);
            if (cfgRows.length) { const s = safeJson(cfgRows[0].config_value, {}); focus = s.focus || focus; }
        } catch (_) {}

        res.json({ now: new Date().toISOString(), git, runtime: { uptimeSec }, backups, retomada: { focus, lastCheckpoint } });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Retomada ─────────────────────────────────────────────────────────────────

async function getRetomada(req, res) {
    try {
        const [rows] = await pool.query(`SELECT config_value FROM sistema_config WHERE config_key = 'retomada' LIMIT 1`);
        const state = rows.length ? safeJson(rows[0].config_value, {}) : {};
        const git = gitInfo();

        let checkpoints = [];
        try {
            const [cpRows] = await pool.query(`SELECT nota, git_branch, git_head, created_at FROM retomada_checkpoints ORDER BY created_at DESC LIMIT 20`);
            checkpoints = cpRows.map(r => ({ note: r.nota, git: { branch: r.git_branch, shortHead: r.git_head }, at: r.created_at }));
        } catch (_) {}

        res.json({
            trigger: state.trigger || 'LDFP_CONTINUAR',
            updatedAt: state.updatedAt || null,
            filePath: '.ldfp-resume/state.json',
            focus: state.focus || { currentObjective: '', nextSteps: [] },
            environment: state.environment || { productionUrl: 'https://www.ldfp.com.br', cloudIdeUrl: '' },
            git: { branch: git.branch, shortHead: git.shortHead, dirty: false },
            checkpoints
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function putRetomada(req, res) {
    try {
        let existing = {};
        try {
            const [rows] = await pool.query(`SELECT config_value FROM sistema_config WHERE config_key = 'retomada' LIMIT 1`);
            if (rows.length) existing = safeJson(rows[0].config_value, {});
        } catch (_) {}

        const payload = { ...existing, ...req.body, updatedAt: new Date().toISOString() };
        const json = JSON.stringify(payload);
        await pool.query(
            `INSERT INTO sistema_config (config_key, config_value) VALUES ('retomada', ?)
             ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`,
            [json, json]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function postRetomadaCheckpoint(req, res) {
    try {
        const { note } = req.body || {};
        const git = gitInfo();
        await pool.query(
            `INSERT INTO retomada_checkpoints (nota, git_branch, git_head) VALUES (?, ?, ?)`,
            [note || 'Checkpoint', git.branch, git.shortHead]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Fábrica de Inovações (AI Stub) ───────────────────────────────────────────

async function postFactoryAiSuggest(req, res) {
    res.json({ suggestion: 'Configure uma chave OpenAI no servidor para habilitar sugestões automáticas de módulos.' });
}

module.exports = {
    listPlanosPublico,
    getSuperAdminOverview,
    getSaasFaturamento,
    getSaasIgrejas,
    getSaasIgrejaContrato,
    patchIgrejaStatus,
    updateSaasIgrejaContrato,
    listPlanos,
    getPlano,
    updatePlano,
    listSaasAssinaturas,
    markSaasAssinaturaPaga,
    listSaasModulos,
    createSaasModulo,
    updateSaasModulo,
    getPlanoModulos,
    putPlanoModulos,
    getIgrejaModulos,
    putIgrejaModulos,
    getMyEffectiveModules,
    getMinhaConta,
    getSistemaConfig,
    putSistemaConfig,
    getSistemaDiagnostico,
    getRetomada,
    putRetomada,
    postRetomadaCheckpoint,
    postFactoryAiSuggest
};
