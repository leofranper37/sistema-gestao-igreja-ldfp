'use strict';

/**
 * Lote 6 — Mural da Igreja (posts, comentários, reações, denúncias, moderação).
 *
 * As MESMAS rotas atendem a equipe (login normal) e o membro (App, token app_mode).
 * A igreja vem sempre do token/banco (req.auth.igrejaId) — nunca do corpo da requisição.
 *
 *  Equipe com papel de moderação (admin/secretaria/pastor): vê tudo, publica direto,
 *  fixa, oculta, aprova, exclui e configura.
 *  Membro: vê o que está publicado (+ os próprios pendentes), publica/comenta conforme
 *  a configuração da igreja, reage, denuncia e exclui o que é dele.
 */

const express = require('express');
const { pool } = require('../config/db');
const { requireAuth } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');
const { ensureMural } = require('../models/lote6Schema');

const router = express.Router();

const MODERA = ['admin', 'secretaria', 'pastor'];
const REACOES = ['amem', 'orando', 'gratidao', 'curtir'];
const MAX_TEXTO = 2000;
const MAX_COMENTARIO = 600;

// ─── helpers ────────────────────────────────────────────────────────────────

function quem(req) {
    const a = req.auth || {};
    const igrejaId = Number(a.igrejaId);
    if (!igrejaId) throw createHttpError(401, 'Sessão inválida: igreja não identificada.');
    if (a.app_mode) {
        return { tipo: 'membro', id: Number(a.membro_id || a.id), nome: a.nome || 'Membro', igrejaId, modera: false };
    }
    return { tipo: 'equipe', id: Number(a.id), nome: a.nome || 'Equipe', igrejaId, modera: MODERA.includes(a.role) };
}

function exigirModerador(eu) {
    if (!eu.modera) throw createHttpError(403, 'Apenas admin, secretaria ou pastor podem moderar o mural.');
}

function idParam(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw createHttpError(400, 'Identificador inválido.');
    return n;
}

function textoLimpo(v, max, campo) {
    const t = String(v == null ? '' : v).replace(/\r\n/g, '\n').trim();
    if (!t) throw createHttpError(400, `${campo} é obrigatório.`);
    if (t.length > max) throw createHttpError(400, `${campo} pode ter no máximo ${max} caracteres.`);
    return t;
}

function agoraSql() {
    return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

/** Garante que o membro do token ainda existe nesta igreja (token de 30 dias). */
async function exigirMembroAtivo(eu) {
    if (eu.tipo !== 'membro') return;
    const [rows] = await pool.query('SELECT id, nome FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1', [eu.id, eu.igrejaId]);
    if (!rows.length) throw createHttpError(403, 'Cadastro de membro não encontrado nesta igreja.');
    if (rows[0].nome) eu.nome = rows[0].nome;
}

async function lerConfig(igrejaId) {
    const [rows] = await pool.query('SELECT membros_publicam, exige_aprovacao, comentarios FROM mural_config WHERE igreja_id = ? LIMIT 1', [igrejaId]);
    const r = rows[0] || {};
    return {
        membros_publicam: r.membros_publicam == null ? true : Number(r.membros_publicam) === 1,
        exige_aprovacao: r.exige_aprovacao == null ? true : Number(r.exige_aprovacao) === 1,
        comentarios: r.comentarios == null ? true : Number(r.comentarios) === 1
    };
}

async function obterPost(igrejaId, id) {
    const [rows] = await pool.query('SELECT * FROM mural_posts WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!rows.length) throw createHttpError(404, 'Publicação não encontrada.');
    return rows[0];
}

function ehAutor(eu, row) {
    return row.autor_tipo === eu.tipo && Number(row.autor_id) === eu.id;
}

/** Membro só enxerga post publicado, ou o próprio (mesmo pendente). */
function podeVer(eu, post) {
    if (eu.modera) return true;
    if (post.status === 'publicado') return true;
    return ehAutor(eu, post) && post.status === 'pendente';
}

function placeholders(n) {
    return new Array(n).fill('?').join(',');
}

router.use('/api/mural', requireAuth, async (req, res, next) => {
    try { await ensureMural(); next(); } catch (e) { next(e); }
});

// ─── configuração ───────────────────────────────────────────────────────────

router.get('/api/mural/config', async (req, res) => {
    const eu = quem(req);
    res.json({ ...(await lerConfig(eu.igrejaId)), modera: eu.modera, autor_tipo: eu.tipo });
});

router.put('/api/mural/config', async (req, res) => {
    const eu = quem(req);
    exigirModerador(eu);
    const atual = await lerConfig(eu.igrejaId);
    const b = req.body || {};
    const bool = (v, d) => (v === undefined ? d : (v === true || v === 1 || v === '1' || v === 'true'));
    const nova = {
        membros_publicam: bool(b.membros_publicam, atual.membros_publicam),
        exige_aprovacao: bool(b.exige_aprovacao, atual.exige_aprovacao),
        comentarios: bool(b.comentarios, atual.comentarios)
    };
    const vals = [nova.membros_publicam ? 1 : 0, nova.exige_aprovacao ? 1 : 0, nova.comentarios ? 1 : 0, agoraSql()];
    const [ex] = await pool.query('SELECT igreja_id FROM mural_config WHERE igreja_id = ? LIMIT 1', [eu.igrejaId]);
    if (ex.length) {
        await pool.query(
            'UPDATE mural_config SET membros_publicam = ?, exige_aprovacao = ?, comentarios = ?, updated_at = ? WHERE igreja_id = ?',
            [...vals, eu.igrejaId]
        );
    } else {
        await pool.query(
            'INSERT INTO mural_config (membros_publicam, exige_aprovacao, comentarios, updated_at, igreja_id) VALUES (?, ?, ?, ?, ?)',
            [...vals, eu.igrejaId]
        );
    }
    res.json(nova);
});

// ─── denúncias (antes de /:id) ──────────────────────────────────────────────

router.post('/api/mural/denuncias', async (req, res) => {
    const eu = quem(req);
    await exigirMembroAtivo(eu);
    const alvoTipo = req.body?.alvo_tipo === 'comentario' ? 'comentario' : (req.body?.alvo_tipo === 'post' ? 'post' : null);
    if (!alvoTipo) throw createHttpError(400, 'alvo_tipo deve ser "post" ou "comentario".');
    const alvoId = idParam(req.body?.alvo_id);
    const tabela = alvoTipo === 'post' ? 'mural_posts' : 'mural_comentarios';
    const [alvo] = await pool.query(`SELECT id FROM ${tabela} WHERE id = ? AND igreja_id = ? LIMIT 1`, [alvoId, eu.igrejaId]);
    if (!alvo.length) throw createHttpError(404, 'Conteúdo não encontrado.');
    const motivo = String(req.body?.motivo || '').trim().slice(0, 255) || null;

    const [ja] = await pool.query(
        'SELECT id FROM mural_denuncias WHERE alvo_tipo = ? AND alvo_id = ? AND autor_tipo = ? AND autor_id = ? LIMIT 1',
        [alvoTipo, alvoId, eu.tipo, eu.id]
    );
    if (ja.length) {
        await pool.query('UPDATE mural_denuncias SET resolvida = 0, motivo = ? WHERE id = ?', [motivo, ja[0].id]);
    } else {
        await pool.query(
            'INSERT INTO mural_denuncias (igreja_id, alvo_tipo, alvo_id, autor_tipo, autor_id, motivo) VALUES (?, ?, ?, ?, ?, ?)',
            [eu.igrejaId, alvoTipo, alvoId, eu.tipo, eu.id, motivo]
        );
    }
    res.status(201).json({ ok: true, message: 'Obrigado. A liderança vai analisar.' });
});

router.get('/api/mural/denuncias', async (req, res) => {
    const eu = quem(req);
    exigirModerador(eu);
    const [rows] = await pool.query(
        `SELECT alvo_tipo, alvo_id, COUNT(*) AS total, MAX(motivo) AS motivo, MAX(created_at) AS ultima
         FROM mural_denuncias WHERE igreja_id = ? AND resolvida = 0
         GROUP BY alvo_tipo, alvo_id ORDER BY ultima DESC`,
        [eu.igrejaId]
    );
    const postsIds = rows.filter((r) => r.alvo_tipo === 'post').map((r) => r.alvo_id);
    const comIds = rows.filter((r) => r.alvo_tipo === 'comentario').map((r) => r.alvo_id);
    const textos = {};
    if (postsIds.length) {
        const [p] = await pool.query(`SELECT id, texto, autor_nome, status FROM mural_posts WHERE igreja_id = ? AND id IN (${placeholders(postsIds.length)})`, [eu.igrejaId, ...postsIds]);
        p.forEach((x) => { textos[`post:${x.id}`] = x; });
    }
    if (comIds.length) {
        const [c] = await pool.query(`SELECT id, post_id, texto, autor_nome, status FROM mural_comentarios WHERE igreja_id = ? AND id IN (${placeholders(comIds.length)})`, [eu.igrejaId, ...comIds]);
        c.forEach((x) => { textos[`comentario:${x.id}`] = x; });
    }
    res.json({
        items: rows.map((r) => {
            const alvo = textos[`${r.alvo_tipo}:${r.alvo_id}`] || {};
            return {
                alvo_tipo: r.alvo_tipo, alvo_id: r.alvo_id, total: Number(r.total), motivo: r.motivo, ultima: r.ultima,
                texto: alvo.texto || '(removido)', autor_nome: alvo.autor_nome || '', status: alvo.status || 'removido',
                post_id: r.alvo_tipo === 'post' ? r.alvo_id : alvo.post_id || null
            };
        })
    });
});

router.post('/api/mural/denuncias/resolver', async (req, res) => {
    const eu = quem(req);
    exigirModerador(eu);
    const alvoTipo = req.body?.alvo_tipo === 'comentario' ? 'comentario' : 'post';
    const alvoId = idParam(req.body?.alvo_id);
    await pool.query('UPDATE mural_denuncias SET resolvida = 1 WHERE igreja_id = ? AND alvo_tipo = ? AND alvo_id = ?', [eu.igrejaId, alvoTipo, alvoId]);
    res.json({ ok: true });
});

// ─── comentários: moderação (antes de /:id) ─────────────────────────────────

router.patch('/api/mural/comentarios/:id', async (req, res) => {
    const eu = quem(req);
    exigirModerador(eu);
    const id = idParam(req.params.id);
    const status = req.body?.status;
    if (!['publicado', 'oculto'].includes(status)) throw createHttpError(400, 'Status deve ser "publicado" ou "oculto".');
    const [ex] = await pool.query('SELECT id FROM mural_comentarios WHERE id = ? AND igreja_id = ? LIMIT 1', [id, eu.igrejaId]);
    if (!ex.length) throw createHttpError(404, 'Comentário não encontrado.');
    await pool.query('UPDATE mural_comentarios SET status = ? WHERE id = ? AND igreja_id = ?', [status, id, eu.igrejaId]);
    res.json({ ok: true });
});

router.delete('/api/mural/comentarios/:id', async (req, res) => {
    const eu = quem(req);
    const id = idParam(req.params.id);
    const [rows] = await pool.query('SELECT * FROM mural_comentarios WHERE id = ? AND igreja_id = ? LIMIT 1', [id, eu.igrejaId]);
    if (!rows.length) throw createHttpError(404, 'Comentário não encontrado.');
    if (!eu.modera && !ehAutor(eu, rows[0])) throw createHttpError(403, 'Você só pode excluir os seus comentários.');
    await pool.query('DELETE FROM mural_comentarios WHERE id = ? AND igreja_id = ?', [id, eu.igrejaId]);
    await pool.query("DELETE FROM mural_denuncias WHERE igreja_id = ? AND alvo_tipo = 'comentario' AND alvo_id = ?", [eu.igrejaId, id]);
    res.json({ ok: true });
});

// ─── posts ──────────────────────────────────────────────────────────────────

router.get('/api/mural', async (req, res) => {
    const eu = quem(req);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const pagina = Math.max(1, Number(req.query.pagina) || 1);
    const offset = (pagina - 1) * limit;

    const conds = ['p.igreja_id = ?'];
    const params = [eu.igrejaId];
    if (eu.modera) {
        const st = String(req.query.status || '');
        if (['publicado', 'pendente', 'oculto'].includes(st)) { conds.push('p.status = ?'); params.push(st); }
    } else {
        conds.push("(p.status = 'publicado' OR (p.status = 'pendente' AND p.autor_tipo = ? AND p.autor_id = ?))");
        params.push(eu.tipo, eu.id);
    }

    const where = conds.join(' AND ');
    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM mural_posts p WHERE ${where}`, params);
    const [posts] = await pool.query(
        `SELECT p.id, p.autor_tipo, p.autor_id, p.autor_nome, p.texto, p.fixado, p.status, p.created_at
         FROM mural_posts p WHERE ${where}
         ORDER BY p.fixado DESC, p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    const ids = posts.map((p) => p.id);
    const reacoes = {};
    const minhas = {};
    const comentarios = {};
    const denuncias = {};
    if (ids.length) {
        const ph = placeholders(ids.length);
        const [rr] = await pool.query(
            `SELECT post_id, tipo, COUNT(*) AS n FROM mural_reacoes WHERE igreja_id = ? AND post_id IN (${ph}) GROUP BY post_id, tipo`,
            [eu.igrejaId, ...ids]
        );
        rr.forEach((r) => { (reacoes[r.post_id] = reacoes[r.post_id] || {})[r.tipo] = Number(r.n); });
        const [mr] = await pool.query(
            `SELECT post_id, tipo FROM mural_reacoes WHERE igreja_id = ? AND autor_tipo = ? AND autor_id = ? AND post_id IN (${ph})`,
            [eu.igrejaId, eu.tipo, eu.id, ...ids]
        );
        mr.forEach((r) => { minhas[r.post_id] = r.tipo; });
        const [cc] = await pool.query(
            `SELECT post_id, COUNT(*) AS n FROM mural_comentarios WHERE igreja_id = ? AND post_id IN (${ph})
             ${eu.modera ? '' : "AND status = 'publicado'"} GROUP BY post_id`,
            [eu.igrejaId, ...ids]
        );
        cc.forEach((r) => { comentarios[r.post_id] = Number(r.n); });
        if (eu.modera) {
            const [dd] = await pool.query(
                `SELECT alvo_id, COUNT(*) AS n FROM mural_denuncias WHERE igreja_id = ? AND alvo_tipo = 'post' AND resolvida = 0 AND alvo_id IN (${ph}) GROUP BY alvo_id`,
                [eu.igrejaId, ...ids]
            );
            dd.forEach((r) => { denuncias[r.alvo_id] = Number(r.n); });
        }
    }

    const config = await lerConfig(eu.igrejaId);
    res.json({
        config: { ...config, modera: eu.modera, autor_tipo: eu.tipo },
        meta: { pagina, limit, total: Number(total), totalPaginas: Math.ceil(Number(total) / limit) },
        items: posts.map((p) => ({
            id: p.id,
            autor_tipo: p.autor_tipo,
            autor_nome: p.autor_nome,
            texto: p.texto,
            fixado: Number(p.fixado) === 1,
            status: p.status,
            created_at: p.created_at,
            meu: ehAutor(eu, p),
            reacoes: reacoes[p.id] || {},
            minha_reacao: minhas[p.id] || null,
            comentarios: comentarios[p.id] || 0,
            denuncias: eu.modera ? (denuncias[p.id] || 0) : undefined
        }))
    });
});

router.post('/api/mural', async (req, res) => {
    const eu = quem(req);
    await exigirMembroAtivo(eu);
    const texto = textoLimpo(req.body?.texto, MAX_TEXTO, 'Texto');
    const config = await lerConfig(eu.igrejaId);

    let status = 'publicado';
    let fixado = 0;
    if (eu.tipo === 'membro') {
        if (!config.membros_publicam) throw createHttpError(403, 'A igreja não permite publicações de membros no mural.');
        if (config.exige_aprovacao) status = 'pendente';
    } else {
        if (!eu.modera) throw createHttpError(403, 'Apenas admin, secretaria ou pastor publicam pelo painel.');
        fixado = req.body?.fixado ? 1 : 0;
    }

    const [r] = await pool.query(
        'INSERT INTO mural_posts (igreja_id, autor_tipo, autor_id, autor_nome, texto, fixado, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [eu.igrejaId, eu.tipo, eu.id, String(eu.nome).slice(0, 150), texto, fixado, status]
    );
    res.status(201).json({
        id: r.insertId,
        status,
        message: status === 'pendente' ? 'Publicação enviada! Ela aparece no mural depois da aprovação da liderança.' : 'Publicado no mural.'
    });
});

router.patch('/api/mural/:id', async (req, res) => {
    const eu = quem(req);
    exigirModerador(eu);
    const id = idParam(req.params.id);
    await obterPost(eu.igrejaId, id);
    const sets = [];
    const params = [];
    if (req.body?.status !== undefined) {
        if (!['publicado', 'pendente', 'oculto'].includes(req.body.status)) throw createHttpError(400, 'Status inválido.');
        sets.push('status = ?'); params.push(req.body.status);
    }
    if (req.body?.fixado !== undefined) { sets.push('fixado = ?'); params.push(req.body.fixado ? 1 : 0); }
    if (req.body?.texto !== undefined) { sets.push('texto = ?'); params.push(textoLimpo(req.body.texto, MAX_TEXTO, 'Texto')); }
    if (!sets.length) throw createHttpError(400, 'Nada para alterar.');
    sets.push('updated_at = ?'); params.push(agoraSql());
    await pool.query(`UPDATE mural_posts SET ${sets.join(', ')} WHERE id = ? AND igreja_id = ?`, [...params, id, eu.igrejaId]);
    res.json({ ok: true });
});

router.delete('/api/mural/:id', async (req, res) => {
    const eu = quem(req);
    const id = idParam(req.params.id);
    const post = await obterPost(eu.igrejaId, id);
    if (!eu.modera && !ehAutor(eu, post)) throw createHttpError(403, 'Você só pode excluir as suas publicações.');
    const [coms] = await pool.query('SELECT id FROM mural_comentarios WHERE igreja_id = ? AND post_id = ?', [eu.igrejaId, id]);
    if (coms.length) {
        const cids = coms.map((c) => c.id);
        await pool.query(`DELETE FROM mural_denuncias WHERE igreja_id = ? AND alvo_tipo = 'comentario' AND alvo_id IN (${placeholders(cids.length)})`, [eu.igrejaId, ...cids]);
    }
    await pool.query('DELETE FROM mural_comentarios WHERE igreja_id = ? AND post_id = ?', [eu.igrejaId, id]);
    await pool.query('DELETE FROM mural_reacoes WHERE igreja_id = ? AND post_id = ?', [eu.igrejaId, id]);
    await pool.query("DELETE FROM mural_denuncias WHERE igreja_id = ? AND alvo_tipo = 'post' AND alvo_id = ?", [eu.igrejaId, id]);
    await pool.query('DELETE FROM mural_posts WHERE id = ? AND igreja_id = ?', [id, eu.igrejaId]);
    res.json({ ok: true });
});

// ─── reações ────────────────────────────────────────────────────────────────

router.post('/api/mural/:id/reacao', async (req, res) => {
    const eu = quem(req);
    await exigirMembroAtivo(eu);
    const id = idParam(req.params.id);
    const post = await obterPost(eu.igrejaId, id);
    if (post.status !== 'publicado') throw createHttpError(400, 'Só é possível reagir a publicações publicadas.');
    const tipo = req.body?.tipo ? String(req.body.tipo) : null;
    if (tipo && !REACOES.includes(tipo)) throw createHttpError(400, `Reação inválida. Use: ${REACOES.join(', ')}.`);

    await pool.query('DELETE FROM mural_reacoes WHERE igreja_id = ? AND post_id = ? AND autor_tipo = ? AND autor_id = ?', [eu.igrejaId, id, eu.tipo, eu.id]);
    if (tipo) {
        await pool.query(
            'INSERT INTO mural_reacoes (igreja_id, post_id, autor_tipo, autor_id, tipo) VALUES (?, ?, ?, ?, ?)',
            [eu.igrejaId, id, eu.tipo, eu.id, tipo]
        );
    }
    const [rr] = await pool.query('SELECT tipo, COUNT(*) AS n FROM mural_reacoes WHERE igreja_id = ? AND post_id = ? GROUP BY tipo', [eu.igrejaId, id]);
    const reacoes = {};
    rr.forEach((r) => { reacoes[r.tipo] = Number(r.n); });
    res.json({ minha_reacao: tipo, reacoes });
});

// ─── comentários de um post ─────────────────────────────────────────────────

router.get('/api/mural/:id/comentarios', async (req, res) => {
    const eu = quem(req);
    const id = idParam(req.params.id);
    const post = await obterPost(eu.igrejaId, id);
    if (!podeVer(eu, post)) throw createHttpError(404, 'Publicação não encontrada.');
    const [rows] = await pool.query(
        `SELECT id, autor_tipo, autor_id, autor_nome, texto, status, created_at FROM mural_comentarios
         WHERE igreja_id = ? AND post_id = ? ${eu.modera ? '' : "AND status = 'publicado'"}
         ORDER BY created_at ASC, id ASC`,
        [eu.igrejaId, id]
    );
    res.json({
        items: rows.map((c) => ({
            id: c.id, autor_tipo: c.autor_tipo, autor_nome: c.autor_nome, texto: c.texto,
            status: c.status, created_at: c.created_at, meu: ehAutor(eu, c)
        }))
    });
});

router.post('/api/mural/:id/comentarios', async (req, res) => {
    const eu = quem(req);
    await exigirMembroAtivo(eu);
    const id = idParam(req.params.id);
    const post = await obterPost(eu.igrejaId, id);
    if (post.status !== 'publicado') throw createHttpError(400, 'Só é possível comentar publicações publicadas.');
    const config = await lerConfig(eu.igrejaId);
    if (!config.comentarios && !eu.modera) throw createHttpError(403, 'Os comentários do mural estão desativados.');
    const texto = textoLimpo(req.body?.texto, MAX_COMENTARIO, 'Comentário');
    const [r] = await pool.query(
        'INSERT INTO mural_comentarios (igreja_id, post_id, autor_tipo, autor_id, autor_nome, texto) VALUES (?, ?, ?, ?, ?, ?)',
        [eu.igrejaId, id, eu.tipo, eu.id, String(eu.nome).slice(0, 150), texto]
    );
    res.status(201).json({ id: r.insertId });
});

module.exports = router;
