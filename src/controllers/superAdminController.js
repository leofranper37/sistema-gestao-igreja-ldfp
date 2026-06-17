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
        // Tenta com mensalidade_valor; cai para 0 se a coluna ainda não existe em produção
        let igrejas;
        try {
            [igrejas] = await pool.query(
                `SELECT status_assinatura, mensalidade_valor, trial_ends_at FROM igrejas`
            );
        } catch (_) {
            [igrejas] = await pool.query(
                `SELECT status_assinatura, 0 AS mensalidade_valor, trial_ends_at FROM igrejas`
            );
        }

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

        // payment_links pode não existir ainda em bancos antigos
        let pendingCount = 0, pendingAmount = 0;
        try {
            const [pending] = await pool.query(
                `SELECT COUNT(*) AS cnt, COALESCE(SUM(valor),0) AS total
                 FROM payment_links WHERE status = 'pendente'`
            );
            pendingCount = fmt(pending[0]?.cnt);
            pendingAmount = fmt(pending[0]?.total);
        } catch (_) {}

        // Tenta com colunas opcionais; cai para NULL se não existirem ainda
        let customers = [];
        try {
            [customers] = await pool.query(
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
        } catch (_) {
            [customers] = await pool.query(
                `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                        NULL AS responsavel_nome, NULL AS responsavel_email,
                        0 AS mensalidade_valor, NULL AS proximo_vencimento,
                        i.trial_ends_at, i.max_cadastros, i.created_at,
                        COUNT(m.id) AS membros_ativos
                 FROM igrejas i
                 LEFT JOIN membros m ON m.igreja_id = i.id
                 GROUP BY i.id
                 ORDER BY i.created_at DESC`
            );
        }

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
        let rows = [];
        try {
            [rows] = await pool.query(
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
        } catch (_) {
            [rows] = await pool.query(
                `SELECT i.id, i.nome, i.plano, i.status_assinatura,
                        NULL AS responsavel, NULL AS email_admin,
                        NULL AS telefone, NULL AS cnpj,
                        0 AS mensalidade_valor, NULL AS proximo_vencimento,
                        i.created_at, i.trial_starts_at, i.trial_ends_at,
                        COUNT(m.id) AS total_membros
                 FROM igrejas i
                 LEFT JOIN membros m ON m.igreja_id = i.id
                 GROUP BY i.id
                 ORDER BY i.created_at DESC`
            );
        }
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

        // Busca módulos ativos de cada plano para enriquecer a resposta
        const [moduloRows] = await pool.query(
            `SELECT spm.plano_slug, sm.nome, sm.icon
             FROM saas_plano_modulos spm
             JOIN saas_modulos sm ON sm.slug = spm.modulo_slug
             WHERE spm.ativo = 1 AND sm.ativo = 1
             ORDER BY sm.nome ASC`
        ).catch(() => [[]]);

        const modulosPorPlano = {};
        for (const m of moduloRows) {
            if (!modulosPorPlano[m.plano_slug]) modulosPorPlano[m.plano_slug] = [];
            modulosPorPlano[m.plano_slug].push({ nome: m.nome, icon: m.icon || 'fa-puzzle-piece' });
        }

        const result = rows.map(r => ({
            ...r,
            features: safeJson(r.features_json, []),
            modules: modulosPorPlano[r.slug] || []
        }));
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
            environment: state.environment || { productionUrl: 'https://www.ldfp.com.br', cloudIdeUrl: 'https://github.dev/leofranper37/sistema-gestao-igreja-ldfp' },
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
// ── Novidades (SaaS broadcast) ───────────────────────────────────────────────

async function listNovidadesPublic(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT id, titulo, subtitulo, conteudo, tags, tipo, destaque, created_at
             FROM sistema_novidades WHERE ativo = 1 ORDER BY created_at DESC LIMIT 50`
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function listNovidadesAdmin(req, res) {
    try {
        const [rows] = await pool.query(`SELECT * FROM sistema_novidades ORDER BY created_at DESC`);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createNovidade(req, res) {
    try {
        const { titulo, subtitulo, conteudo, tags, tipo, destaque, ativo } = req.body || {};
        if (!titulo) return res.status(400).json({ error: 'Título é obrigatório.' });
        const [r] = await pool.query(
            `INSERT INTO sistema_novidades (titulo, subtitulo, conteudo, tags, tipo, destaque, ativo)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [titulo.trim(), subtitulo || null, conteudo || null, tags || null,
             tipo || 'release', destaque ? 1 : 0, ativo === false ? 0 : 1]
        );
        res.status(201).json({ id: r.insertId, titulo });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function updateNovidade(req, res) {
    try {
        const id = Number(req.params.id);
        const { titulo, subtitulo, conteudo, tags, tipo, destaque, ativo } = req.body || {};
        await pool.query(
            `UPDATE sistema_novidades SET titulo=?, subtitulo=?, conteudo=?, tags=?, tipo=?,
             destaque=?, ativo=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`,
            [titulo || '', subtitulo || null, conteudo || null, tags || null,
             tipo || 'release', destaque ? 1 : 0, ativo === false ? 0 : 1, id]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function deleteNovidade(req, res) {
    try {
        const id = Number(req.params.id);
        await pool.query(`DELETE FROM sistema_novidades WHERE id = ?`, [id]);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Excluir Igreja ───────────────────────────────────────────────────────────

async function deleteIgreja(req, res) {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'ID inválido.' });

    // Impede excluir a própria igreja do super-admin
    const [ig] = await pool.query(`SELECT nome FROM igrejas WHERE id = ?`, [id]);
    if (!ig.length) return res.status(404).json({ error: 'Igreja não encontrada.' });
    if (ig[0].nome === 'LDFP Master') {
        return res.status(403).json({ error: 'A igreja master não pode ser excluída.' });
    }

    // Tabelas filhas — ignora as que não existirem
    const tabelas = [
        'oracao_intercessores', 'oracoes_pedidos', 'pedidos_oracao',
        'batismos', 'escalas_membros', 'escalas', 'grupos_membros', 'grupos',
        'ebd_presencas', 'ebd_aulas', 'ebd_classes', 'ebd_cursos',
        'agenda_eventos_presencas', 'agenda_eventos',
        'dizimos', 'financeiro', 'contas_pagar', 'banco_lancamentos', 'banco_categorias',
        'missionarios', 'outras_igrejas_membros',
        'visitantes_followup', 'visitantes', 'congregados', 'criancas',
        'auditoria', 'audit_logs', 'push_subscriptions', 'payment_links',
        'checkins_portaria', 'qr_sessoes', 'autocadastros',
        'whatsapp_logs', 'whatsapp_templates',
        'app_congregacoes', 'app_videos', 'app_audios', 'app_images',
        'app_documents', 'app_conexoes', 'app_midias', 'midia_visitantes',
        'telao_visitantes', 'estudos_membros', 'estudos',
        'membros', 'password_reset_requests', 'igreja_modulos',
    ];

    for (const tabela of tabelas) {
        try {
            await pool.query(`DELETE FROM ${tabela} WHERE igreja_id = ?`, [id]);
        } catch (_) {}
    }

    // Usuários da igreja
    try {
        await pool.query(`DELETE FROM usuarios WHERE igreja_id = ?`, [id]);
    } catch (_) {}

    // Por último, a própria igreja
    await pool.query(`DELETE FROM igrejas WHERE id = ?`, [id]);

    res.json({ ok: true, mensagem: `Igreja "${ig[0].nome}" excluída com sucesso.` });
}

// ── Usuários / Reset de Senha ────────────────────────────────────────────────

async function listUsuariosAdmin(req, res) {
    try {
        const q = String(req.query.q || '').trim();
        let sql = `SELECT u.id, u.nome, u.email, u.role, u.igreja, u.igreja_id,
                          i.status_assinatura, i.plano
                   FROM usuarios u
                   LEFT JOIN igrejas i ON i.id = u.igreja_id`;
        const params = [];
        if (q) {
            sql += ` WHERE u.email LIKE ? OR u.nome LIKE ? OR u.igreja LIKE ?`;
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }
        sql += ` ORDER BY u.id DESC LIMIT 100`;
        const [rows] = await pool.query(sql, params);
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function postResetSenha(req, res) {
    try {
        const bcrypt = require('bcryptjs');
        const { email, nova_senha } = req.body || {};
        if (!email || !nova_senha || nova_senha.length < 8) {
            return res.status(400).json({ error: 'E-mail e nova senha (mín. 8 chars) são obrigatórios.' });
        }
        const emailNorm = email.toLowerCase().trim();
        const [users] = await pool.query(`SELECT id FROM usuarios WHERE email = ? LIMIT 1`, [emailNorm]);
        if (!users.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
        const hash = await bcrypt.hash(nova_senha, 12);
        await pool.query(`UPDATE usuarios SET password_hash = ? WHERE email = ?`, [hash, emailNorm]);
        await pool.query(
            `UPDATE password_reset_requests SET status = 'resolvido', resolved_at = CURRENT_TIMESTAMP
             WHERE email = ? AND status = 'pendente'`, [emailNorm]
        );
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function listResetRequests(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT * FROM password_reset_requests ORDER BY created_at DESC LIMIT 200`
        );
        res.json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
}
// ── Fábrica de Inovações ─────────────────────────────────────────────────────

async function postFactoryAiSuggest(req, res) {
    const prompt = String(req.body?.prompt || '').trim();
    const words = prompt.toLowerCase();

    let name = '', description = '', route = 'construcao.html', plans = ['siao'];

    if (words.includes('financ') || words.includes('caixa') || words.includes('tesourar')) {
        name = 'Painel Financeiro Avançado'; description = 'Relatórios, gráficos e exportação financeira completa.';
        route = 'financeiro.html'; plans = ['betel', 'siao'];
    } else if (words.includes('membro') || words.includes('secretar') || words.includes('cadastro')) {
        name = 'Gestão de Membros'; description = 'Controle de membros, visitantes e secretaria.';
        route = 'membros.html'; plans = ['hebrom', 'betel', 'siao'];
    } else if (words.includes('ebd') || words.includes('escola') || words.includes('dominical')) {
        name = 'EBD — Escola Dominical'; description = 'Gestão completa da Escola Bíblica Dominical.';
        route = 'ebd_turmas.html'; plans = ['betel', 'siao'];
    } else if (words.includes('batismo')) {
        name = 'Controle de Batismos'; description = 'Registro, inscrições e controle de batismos.';
        route = 'batismos.html'; plans = ['betel', 'siao'];
    } else if (words.includes('whatsapp') || words.includes('mensagem') || words.includes('comunicac')) {
        name = 'Comunicação WhatsApp'; description = 'Central de comunicação com membros via WhatsApp.';
        route = 'comunicacao_whatsapp.html'; plans = ['siao'];
    } else if (words.includes('escala') || words.includes('voluntar') || words.includes('ministér')) {
        name = 'Escalas de Ministérios'; description = 'Gerenciamento de escalas e voluntários.';
        route = 'escalas.html'; plans = ['betel', 'siao'];
    } else if (words.includes('agenda') || words.includes('event') || words.includes('calend')) {
        name = 'Agenda e Eventos'; description = 'Calendário e gerenciamento de eventos da igreja.';
        route = 'agenda.html'; plans = ['hebrom', 'betel', 'siao'];
    } else if (words.includes('dashboard') || words.includes('indicador') || words.includes('crescimento')) {
        name = 'Dashboard Executivo'; description = 'Indicadores de crescimento com gráficos e métricas.';
        route = 'dashboard.html'; plans = ['siao'];
    } else {
        const titleParts = prompt.split(' ').slice(0, 5).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        name = titleParts.join(' ') || 'Novo Módulo';
        description = 'Módulo desenvolvido conforme necessidade descrita.';
        route = 'construcao.html';
        plans = ['siao'];
    }

    res.json({
        suggestion: {
            module: { id: 'mod-' + Date.now(), name, description, route, status: 'lab', enabled: true, targetPlans: plans },
            menuOverride: null,
            rationale: [
                `Módulo "${name}" identificado a partir do prompt fornecido.`,
                `Rota sugerida: ${route}`,
                `Planos-alvo recomendados: ${plans.join(', ')}.`,
                'Status inicial "Lab" — valide antes de publicar.',
                'Clique em Publicar para ativar nos planos selecionados.'
            ]
        }
    });
}

async function postFactoryPublish(req, res) {
    try {
        const factory = req.body?.factory || {};

        // Salva estado da fábrica em sistema_config['main']
        let existing = {};
        try {
            const [rows] = await pool.query(`SELECT config_value FROM sistema_config WHERE config_key = 'main' LIMIT 1`);
            if (rows.length) existing = safeJson(rows[0].config_value, {});
        } catch (_) {}
        const payload = { ...existing, factory };
        const json = JSON.stringify(payload);
        await pool.query(
            `INSERT INTO sistema_config (config_key, config_value) VALUES ('main', ?)
             ON DUPLICATE KEY UPDATE config_value = ?, updated_at = CURRENT_TIMESTAMP`,
            [json, json]
        );

        // Sincroniza módulos publicados com saas_modulos + saas_plano_modulos
        const modules = Array.isArray(factory.modules) ? factory.modules : [];
        let synced = 0;

        for (const mod of modules) {
            const isPublished = mod.status === 'published' && mod.enabled !== false;
            const namePart = String(mod.name || '')
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
                .slice(0, 35);
            if (!namePart) continue;
            const slug = ('fac-' + namePart).slice(0, 50);
            const nome = String(mod.name || slug).trim();
            const descricao = String(mod.description || '').trim() || null;
            const routePath = String(mod.route || '').trim() || null;
            const featureKey = 'factory:' + namePart;
            const ativo = isPublished ? 1 : 0;

            await pool.query(
                `INSERT INTO saas_modulos (slug, nome, descricao, icon, feature_key, route_path, ativo, updated_at)
                 VALUES (?, ?, ?, 'fa-lightbulb', ?, ?, ?, CURRENT_TIMESTAMP)
                 ON DUPLICATE KEY UPDATE nome = ?, descricao = ?, route_path = ?, ativo = ?, updated_at = CURRENT_TIMESTAMP`,
                [slug, nome, descricao, featureKey, routePath, ativo, nome, descricao, routePath, ativo]
            );

            if (isPublished) {
                const targetPlans = Array.isArray(mod.targetPlans) ? mod.targetPlans : [];
                for (const planSlug of targetPlans) {
                    if (!planSlug) continue;
                    await pool.query(
                        `INSERT INTO saas_plano_modulos (plano_slug, modulo_slug, ativo, updated_at)
                         VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                         ON DUPLICATE KEY UPDATE ativo = 1, updated_at = CURRENT_TIMESTAMP`,
                        [planSlug, slug]
                    );
                }
                synced++;
            }
        }

        res.json({ ok: true, synced, total: modules.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Métricas SaaS ────────────────────────────────────────────────────────────

async function getSaasMetricas(req, res) {
    try {
        // 1. KPIs gerais
        const [igrejas] = await pool.query(
            `SELECT status_assinatura, mensalidade_valor, plano, created_at, trial_ends_at FROM igrejas`
        );
        const now = new Date();
        const total = igrejas.length;
        const ativas = igrejas.filter(r => r.status_assinatura === 'ativa').length;
        const suspensas = igrejas.filter(r => r.status_assinatura === 'suspensa' || r.status_assinatura === 'cancelada').length;
        const trial = igrejas.filter(r => r.status_assinatura === 'trial').length;
        const mrr = igrejas.filter(r => r.status_assinatura === 'ativa').reduce((s, r) => s + fmt(r.mensalidade_valor), 0);
        const arpu = ativas > 0 ? mrr / ativas : 0;
        const churnRate = total > 0 ? (suspensas / total) * 100 : 0;

        // Trials expirando em 7 dias
        const trialExpirando = igrejas.filter(r => {
            if (r.status_assinatura !== 'trial' || !r.trial_ends_at) return false;
            const d = new Date(r.trial_ends_at);
            if (Number.isNaN(d.getTime())) return false;
            const diff = Math.ceil((d - now) / 86400000);
            return diff >= 0 && diff <= 7;
        }).length;

        // 2. Distribuição por plano
        const planoCounts = {};
        for (const ig of igrejas) {
            if (ig.status_assinatura === 'ativa') {
                planoCounts[ig.plano || 'sem plano'] = (planoCounts[ig.plano || 'sem plano'] || 0) + 1;
            }
        }
        const distribuicaoPlanos = Object.entries(planoCounts)
            .map(([plano, count]) => ({ plano, count }))
            .sort((a, b) => b.count - a.count);

        // 3. Crescimento mensal (últimos 6 meses) — novas igrejas criadas
        const meses = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const mesStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const novas = igrejas.filter(ig => {
                if (!ig.created_at) return false;
                const c = new Date(ig.created_at);
                return `${c.getFullYear()}-${String(c.getMonth() + 1).padStart(2, '0')}` === mesStr;
            }).length;
            meses.push({ mes: mesStr, novas });
        }

        // 4. Receita mensal (últimos 6 meses) — payment_links pagos
        let receitaMensal = [];
        try {
            const [rowsFat] = await pool.query(
                `SELECT DATE_FORMAT(paid_at, '%Y-%m') AS mes, COALESCE(SUM(valor),0) AS total
                 FROM payment_links
                 WHERE status = 'pago' AND paid_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
                 GROUP BY mes ORDER BY mes ASC`
            );
            receitaMensal = rowsFat || [];
        } catch (_) {}

        // Preenche meses sem receita com zero
        const receitaMap = Object.fromEntries((receitaMensal).map(r => [r.mes, Number(r.total)]));
        const receitaCompleta = meses.map(m => ({ mes: m.mes, total: receitaMap[m.mes] || 0 }));

        res.json({
            kpis: { mrr, ativas, total, trial, suspensas, arpu, churnRate, trialExpirando },
            distribuicaoPlanos,
            crescimentoMensal: meses,
            receitaMensal: receitaCompleta,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

// ── Relatório Financeiro exportável ─────────────────────────────────────────

async function getSaasRelatorioFinanceiro(req, res) {
    const mes = req.query.mes; // YYYY-MM
    const formato = (req.query.formato || 'json').toLowerCase();

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
        return res.status(400).json({ error: 'Parâmetro "mes" obrigatório no formato YYYY-MM.' });
    }

    try {
        let rows;
        // MySQL
        try {
            [rows] = await pool.query(
                `SELECT i.nome AS igreja, i.plano, i.email_admin,
                        pl.id, pl.descricao, pl.valor, pl.status,
                        pl.payment_method, pl.provider, pl.reference_code,
                        pl.paid_at, pl.created_at
                 FROM payment_links pl
                 JOIN igrejas i ON i.id = pl.igreja_id
                 WHERE DATE_FORMAT(pl.created_at, '%Y-%m') = ?
                 ORDER BY pl.created_at DESC`,
                [mes]
            );
        } catch (_) {
            // PostgreSQL fallback
            [rows] = await pool.query(
                `SELECT i.nome AS igreja, i.plano, i.email_admin,
                        pl.id, pl.descricao, pl.valor, pl.status,
                        pl.payment_method, pl.provider, pl.reference_code,
                        pl.paid_at, pl.created_at
                 FROM payment_links pl
                 JOIN igrejas i ON i.id = pl.igreja_id
                 WHERE TO_CHAR(pl.created_at, 'YYYY-MM') = $1
                 ORDER BY pl.created_at DESC`,
                [mes]
            );
        }

        rows = rows || [];

        // Totalizadores
        const totalArrecadado = rows.filter(r => r.status === 'pago').reduce((s, r) => s + fmt(r.valor), 0);
        const totalPendente = rows.filter(r => r.status === 'pendente').reduce((s, r) => s + fmt(r.valor), 0);
        const qtdPago = rows.filter(r => r.status === 'pago').length;
        const qtdPendente = rows.filter(r => r.status === 'pendente').length;
        const totalIgrejas = new Set(rows.map(r => r.igreja)).size;

        if (formato === 'csv') {
            const csvHeader = 'ID,Igreja,Plano,Email,Descricao,Valor,Status,Metodo,Provedor,Referencia,Pago em,Criado em\n';
            const esc = v => {
                if (v === null || v === undefined) return '';
                const s = String(v).replace(/"/g, '""');
                return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
            };
            const fmtDt = v => v ? new Date(v).toLocaleString('pt-BR') : '';
            const csvBody = rows.map(r =>
                [r.id, r.igreja, r.plano, r.email_admin, r.descricao,
                 Number(r.valor).toFixed(2), r.status, r.payment_method,
                 r.provider, r.reference_code, fmtDt(r.paid_at), fmtDt(r.created_at)
                ].map(esc).join(',')
            ).join('\n');

            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="relatorio-financeiro-${mes}.csv"`);
            return res.send('\uFEFF' + csvHeader + csvBody); // BOM para Excel
        }

        res.json({
            mes,
            totais: { totalArrecadado, totalPendente, qtdPago, qtdPendente, totalIgrejas },
            lancamentos: rows,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
}

module.exports = {
    listPlanosPublico,
    getSuperAdminOverview,
    getSaasMetricas,
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
    postFactoryAiSuggest,
    postFactoryPublish,
    listNovidadesPublic,
    listNovidadesAdmin,
    createNovidade,
    updateNovidade,
    deleteNovidade,
    deleteIgreja,
    listUsuariosAdmin,
    postResetSenha,
    listResetRequests,
    getSaasRelatorioFinanceiro,
};
