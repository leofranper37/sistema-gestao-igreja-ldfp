'use strict';

/**
 * Lote 6 — Inscrição em eventos da Agenda.
 *
 * Equipe (admin/secretaria/pastor):
 *   GET  /api/eventos-inscricao/eventos                 eventos (−30 dias … +1 ano) com config e contagem
 *   PUT  /api/eventos-inscricao/eventos/:id/config      abre/fecha inscrição, vagas, prazo
 *   GET  /api/eventos-inscricao/eventos/:id/inscritos   lista de inscritos
 *   POST /api/eventos-inscricao/eventos/:id/inscritos   inscreve um membro manualmente { membro_id }
 *   PATCH /api/eventos-inscricao/inscritos/:id          { presente } / { status }
 * Membro (App, token app_mode):
 *   POST   /api/app/eventos/:id/inscricao               inscrever-se
 *   DELETE /api/app/eventos/:id/inscricao               cancelar
 *
 * Igreja sempre de req.auth.igrejaId. Datas da agenda são gravadas em UTC
 * ("YYYY-MM-DD HH:MM:SS", ver agendaService) — inscricao_ate segue o mesmo padrão.
 */

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth, authorize } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');
const { ensureEventos } = require('../models/lote6Schema');

const router = express.Router();
const EQUIPE = ['admin', 'secretaria', 'pastor'];

function idParam(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw createHttpError(400, 'Identificador inválido.');
    return n;
}

/** Valor de data vindo do banco → Date (strings sem fuso são UTC, como grava o agendaService). */
function dataBanco(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    const d = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s) ? new Date(s.replace(' ', 'T') + 'Z') : new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function paraSql(d) {
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

function placeholders(n) {
    return new Array(n).fill('?').join(',');
}

async function obterEvento(igrejaId, id) {
    const [rows] = await pool.query(
        `SELECT id, titulo, descricao, inicio, fim, inscricao_aberta, vagas, inscricao_ate
         FROM agenda_eventos WHERE id = ? AND igreja_id = ? LIMIT 1`,
        [id, igrejaId]
    );
    if (!rows.length) throw createHttpError(404, 'Evento não encontrado.');
    return rows[0];
}

async function contarInscritos(igrejaId, ids) {
    const mapa = {};
    if (!ids.length) return mapa;
    const [rows] = await pool.query(
        `SELECT evento_id, COUNT(*) AS n, SUM(CASE WHEN presente = 1 THEN 1 ELSE 0 END) AS presentes
         FROM evento_inscricoes WHERE igreja_id = ? AND status = 'inscrito' AND evento_id IN (${placeholders(ids.length)})
         GROUP BY evento_id`,
        [igrejaId, ...ids]
    );
    rows.forEach((r) => { mapa[r.evento_id] = { inscritos: Number(r.n), presentes: Number(r.presentes || 0) }; });
    return mapa;
}

/** Situação da inscrição para exibir no app/painel. */
function situacao(ev, inscritos, agora = new Date()) {
    const aberta = Number(ev.inscricao_aberta) === 1;
    const prazo = dataBanco(ev.inscricao_ate) || dataBanco(ev.fim);
    const vagas = ev.vagas == null || ev.vagas === '' ? null : Number(ev.vagas);
    const restantes = vagas == null ? null : Math.max(0, vagas - inscritos);
    let motivo = null;
    if (!aberta) motivo = 'fechada';
    else if (prazo && agora > prazo) motivo = 'encerrada';
    else if (restantes === 0) motivo = 'esgotada';
    return { aberta, pode_inscrever: aberta && !motivo, motivo, vagas, vagas_restantes: restantes, prazo };
}

function mapEvento(ev, cont) {
    const c = cont[ev.id] || { inscritos: 0, presentes: 0 };
    const s = situacao(ev, c.inscritos);
    return {
        id: ev.id, titulo: ev.titulo, descricao: ev.descricao || '', inicio: ev.inicio, fim: ev.fim,
        inscricao_aberta: s.aberta, vagas: s.vagas, inscricao_ate: ev.inscricao_ate || null,
        inscritos: c.inscritos, presentes: c.presentes, vagas_restantes: s.vagas_restantes,
        situacao_inscricao: s.motivo || 'aberta'
    };
}

/**
 * Usado por GET /api/app/eventos: acrescenta dados de inscrição aos eventos do mês.
 * membroId opcional → minha_inscricao.
 */
async function enriquecerEventosApp(igrejaId, eventos, membroId) {
    await ensureEventos();
    const ids = eventos.map((e) => e.id).filter(Boolean);
    if (!ids.length) return eventos;
    const [cfg] = await pool.query(
        `SELECT id, fim, inscricao_aberta, vagas, inscricao_ate FROM agenda_eventos WHERE igreja_id = ? AND id IN (${placeholders(ids.length)})`,
        [igrejaId, ...ids]
    );
    const porId = {};
    cfg.forEach((r) => { porId[r.id] = r; });
    const cont = await contarInscritos(igrejaId, ids);
    const minhas = {};
    if (membroId) {
        const [mi] = await pool.query(
            `SELECT evento_id, status FROM evento_inscricoes WHERE igreja_id = ? AND membro_id = ? AND evento_id IN (${placeholders(ids.length)})`,
            [igrejaId, membroId, ...ids]
        );
        mi.forEach((r) => { minhas[r.evento_id] = r.status; });
    }
    return eventos.map((e) => {
        const c = porId[e.id];
        if (!c) return e;
        const s = situacao(c, (cont[e.id] || {}).inscritos || 0);
        return {
            ...e,
            inscricao: s.aberta ? {
                pode_inscrever: s.pode_inscrever,
                motivo: s.motivo,
                vagas: s.vagas,
                vagas_restantes: s.vagas_restantes,
                prazo: s.prazo ? s.prazo.toISOString() : null,
                minha: minhas[e.id] === 'inscrito'
            } : null
        };
    });
}

// ─── Membro (App) ───────────────────────────────────────────────────────────

function exigirMembroApp(req) {
    if (!req.auth?.app_mode) throw createHttpError(403, 'Rota exclusiva do App de Membros.');
    const igrejaId = Number(req.auth.igrejaId);
    const membroId = Number(req.auth.membro_id || req.auth.id);
    if (!igrejaId || !membroId) throw createHttpError(401, 'Sessão inválida.');
    return { igrejaId, membroId };
}

router.post('/api/app/eventos/:id/inscricao', requireAuth, async (req, res) => {
    const { igrejaId, membroId } = exigirMembroApp(req);
    await ensureEventos();
    const id = idParam(req.params.id);
    const ev = await obterEvento(igrejaId, id);

    const [mb] = await pool.query('SELECT id, nome, celular FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1', [membroId, igrejaId]);
    if (!mb.length) throw createHttpError(403, 'Cadastro de membro não encontrado nesta igreja.');

    const [ja] = await pool.query('SELECT id, status FROM evento_inscricoes WHERE evento_id = ? AND membro_id = ? LIMIT 1', [id, membroId]);
    if (ja.length && ja[0].status === 'inscrito') return res.json({ ok: true, message: 'Você já está inscrito.' });

    const cont = await contarInscritos(igrejaId, [id]);
    const s = situacao(ev, (cont[id] || {}).inscritos || 0);
    if (!s.pode_inscrever) {
        const msg = { fechada: 'Este evento não está com inscrições abertas.', encerrada: 'As inscrições deste evento foram encerradas.', esgotada: 'As vagas deste evento esgotaram.' }[s.motivo];
        throw createHttpError(s.motivo === 'esgotada' ? 409 : 400, msg || 'Inscrição indisponível.');
    }

    if (ja.length) {
        await pool.query("UPDATE evento_inscricoes SET status = 'inscrito', nome = ?, celular = ? WHERE id = ?", [mb[0].nome, mb[0].celular || null, ja[0].id]);
    } else {
        await pool.query(
            'INSERT INTO evento_inscricoes (igreja_id, evento_id, membro_id, nome, celular) VALUES (?, ?, ?, ?, ?)',
            [igrejaId, id, membroId, mb[0].nome, mb[0].celular || null]
        );
    }
    res.status(201).json({ ok: true, message: 'Inscrição confirmada!' });
});

router.delete('/api/app/eventos/:id/inscricao', requireAuth, async (req, res) => {
    const { igrejaId, membroId } = exigirMembroApp(req);
    await ensureEventos();
    const id = idParam(req.params.id);
    await obterEvento(igrejaId, id);
    await pool.query(
        "UPDATE evento_inscricoes SET status = 'cancelado', presente = 0 WHERE igreja_id = ? AND evento_id = ? AND membro_id = ?",
        [igrejaId, id, membroId]
    );
    res.json({ ok: true, message: 'Inscrição cancelada.' });
});

// ─── Equipe ─────────────────────────────────────────────────────────────────

router.use('/api/eventos-inscricao', requireAuth, authorize(EQUIPE), async (req, res, next) => {
    try {
        if (req.auth?.app_mode) throw createHttpError(403, 'Acesso restrito à equipe.');
        if (!Number(req.auth?.igrejaId)) throw createHttpError(401, 'Sessão inválida.');
        await ensureEventos();
        next();
    } catch (e) { next(e); }
});

router.get('/api/eventos-inscricao/eventos', async (req, res) => {
    const igrejaId = Number(req.auth.igrejaId);
    const agora = new Date();
    const de = req.query.de ? new Date(req.query.de) : new Date(agora.getTime() - 30 * 86400000);
    const ate = req.query.ate ? new Date(req.query.ate) : new Date(agora.getTime() + 366 * 86400000);
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) throw createHttpError(400, 'Período inválido.');
    const [rows] = await pool.query(
        `SELECT id, titulo, descricao, inicio, fim, inscricao_aberta, vagas, inscricao_ate
         FROM agenda_eventos WHERE igreja_id = ? AND fim >= ? AND inicio <= ?
         ORDER BY inicio ASC`,
        [igrejaId, paraSql(de), paraSql(ate)]
    );
    const cont = await contarInscritos(igrejaId, rows.map((r) => r.id));
    res.json({ items: rows.map((r) => mapEvento(r, cont)) });
});

router.put('/api/eventos-inscricao/eventos/:id/config', async (req, res) => {
    const igrejaId = Number(req.auth.igrejaId);
    const id = idParam(req.params.id);
    await obterEvento(igrejaId, id);
    const b = req.body || {};
    const aberta = b.inscricao_aberta === true || b.inscricao_aberta === 1 || b.inscricao_aberta === '1' || b.inscricao_aberta === 'true';
    let vagas = null;
    if (b.vagas !== undefined && b.vagas !== null && String(b.vagas).trim() !== '') {
        vagas = Number(b.vagas);
        if (!Number.isInteger(vagas) || vagas < 1 || vagas > 100000) throw createHttpError(400, 'Vagas deve ser um número inteiro maior que zero (ou vazio para ilimitado).');
    }
    let ate = null;
    if (b.inscricao_ate) {
        const d = new Date(b.inscricao_ate);
        if (Number.isNaN(d.getTime())) throw createHttpError(400, 'Prazo de inscrição inválido.');
        ate = paraSql(d);
    }
    await pool.query(
        'UPDATE agenda_eventos SET inscricao_aberta = ?, vagas = ?, inscricao_ate = ? WHERE id = ? AND igreja_id = ?',
        [aberta ? 1 : 0, vagas, ate, id, igrejaId]
    );
    const ev = await obterEvento(igrejaId, id);
    res.json(mapEvento(ev, await contarInscritos(igrejaId, [id])));
});

router.get('/api/eventos-inscricao/eventos/:id/inscritos', async (req, res) => {
    const igrejaId = Number(req.auth.igrejaId);
    const id = idParam(req.params.id);
    const ev = await obterEvento(igrejaId, id);
    const [rows] = await pool.query(
        `SELECT ei.id, ei.membro_id, COALESCE(m.nome, ei.nome) AS nome, COALESCE(m.celular, ei.celular) AS celular,
                ei.status, ei.presente, ei.presente_em, ei.created_at
         FROM evento_inscricoes ei
         LEFT JOIN membros m ON m.id = ei.membro_id AND m.igreja_id = ei.igreja_id
         WHERE ei.igreja_id = ? AND ei.evento_id = ?
         ORDER BY ei.status ASC, nome ASC`,
        [igrejaId, id]
    );
    res.json({
        evento: mapEvento(ev, await contarInscritos(igrejaId, [id])),
        items: rows.map((r) => ({ ...r, presente: Number(r.presente) === 1 }))
    });
});

router.post('/api/eventos-inscricao/eventos/:id/inscritos', async (req, res) => {
    const igrejaId = Number(req.auth.igrejaId);
    const id = idParam(req.params.id);
    await obterEvento(igrejaId, id);
    const membroId = idParam(req.body?.membro_id);
    const [mb] = await pool.query('SELECT id, nome, celular FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1', [membroId, igrejaId]);
    if (!mb.length) throw createHttpError(404, 'Membro não encontrado nesta igreja.');
    const [ja] = await pool.query('SELECT id FROM evento_inscricoes WHERE evento_id = ? AND membro_id = ? LIMIT 1', [id, membroId]);
    if (ja.length) {
        await pool.query("UPDATE evento_inscricoes SET status = 'inscrito' WHERE id = ?", [ja[0].id]);
        return res.json({ id: ja[0].id });
    }
    const [r] = await pool.query(
        'INSERT INTO evento_inscricoes (igreja_id, evento_id, membro_id, nome, celular) VALUES (?, ?, ?, ?, ?)',
        [igrejaId, id, membroId, mb[0].nome, mb[0].celular || null]
    );
    res.status(201).json({ id: r.insertId });
});

router.patch('/api/eventos-inscricao/inscritos/:id', async (req, res) => {
    const igrejaId = Number(req.auth.igrejaId);
    const id = idParam(req.params.id);
    const [rows] = await pool.query('SELECT id FROM evento_inscricoes WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!rows.length) throw createHttpError(404, 'Inscrição não encontrada.');
    const b = req.body || {};
    if (b.presente !== undefined) {
        const p = b.presente === true || b.presente === 1 || b.presente === '1' || b.presente === 'true';
        await pool.query('UPDATE evento_inscricoes SET presente = ?, presente_em = ? WHERE id = ? AND igreja_id = ?',
            [p ? 1 : 0, p ? paraSql(new Date()) : null, id, igrejaId]);
    }
    if (b.status !== undefined) {
        if (!['inscrito', 'cancelado'].includes(b.status)) throw createHttpError(400, 'Status inválido.');
        await pool.query('UPDATE evento_inscricoes SET status = ? WHERE id = ? AND igreja_id = ?', [b.status, id, igrejaId]);
    }
    res.json({ ok: true });
});

module.exports = router;
module.exports.enriquecerEventosApp = enriquecerEventosApp;
