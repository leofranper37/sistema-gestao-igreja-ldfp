'use strict';

/**
 * Lote 6 — Carteirinha de membro com QR verificável.
 *
 * O QR da carteirinha aponta para /verificar_carteirinha.html?t=<token>.
 * token = "<igrejaId>-<membroId>-<assinatura>", assinatura = HMAC-SHA256 com segredo
 * derivado do JWT_SECRET → ninguém consegue forjar um QR válido, e não precisa de tabela.
 *
 *  GET /api/carteirinha/minha            membro (App): dados da própria carteirinha + token
 *  GET /api/carteirinhas                 equipe: membros p/ impressão em lote (+ token)
 *  GET /api/carteirinha/verificar/:token PÚBLICO: confirma se a carteirinha é válida.
 *       Devolve o mínimo (LGPD): nome, cargo, situação, matrícula e igreja. Sem CPF,
 *       contato, endereço ou foto.
 */

const crypto = require('crypto');
const express = require('express');
const { pool } = require('../config/db');
const config = require('../config');
const { requireAuth, authorize } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');

const router = express.Router();
const EQUIPE = ['admin', 'secretaria', 'pastor'];

function segredo() {
    return crypto.createHash('sha256').update(`ldfp-carteirinha:${config.security.jwtSecret}`).digest();
}

function assinatura(igrejaId, membroId) {
    return crypto.createHmac('sha256', segredo()).update(`${Number(igrejaId)}.${Number(membroId)}`).digest('hex').slice(0, 24);
}

function gerarToken(igrejaId, membroId) {
    return `${Number(igrejaId)}-${Number(membroId)}-${assinatura(igrejaId, membroId)}`;
}

function lerToken(token) {
    const m = /^(\d{1,10})-(\d{1,12})-([a-f0-9]{24})$/.exec(String(token || '').trim());
    if (!m) return null;
    const [, ig, mb, sig] = m;
    const esperado = Buffer.from(assinatura(ig, mb));
    const recebido = Buffer.from(sig);
    if (esperado.length !== recebido.length || !crypto.timingSafeEqual(esperado, recebido)) return null;
    return { igrejaId: Number(ig), membroId: Number(mb) };
}

// cargo/foto_url já existem em produção (db.js); no SQLite local podem faltar.
let colunasOk = null;
function ensureColunasMembros() {
    if (!colunasOk) {
        colunasOk = (async () => {
            for (const [col, tipo] of [['cargo', 'VARCHAR(120) NULL'], ['foto_url', 'VARCHAR(500) NULL']]) {
                try { await pool.query(`ALTER TABLE membros ADD COLUMN ${col} ${tipo}`); } catch (_) { /* já existe */ }
            }
        })();
    }
    return colunasOk;
}

function ativo(situacao) {
    const s = String(situacao || '').trim();
    return !s || /^ativ/i.test(s);
}

function matricula(id) {
    return '#' + String(id).padStart(6, '0');
}

async function nomeIgreja(igrejaId) {
    const [rows] = await pool.query('SELECT nome FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
    return rows[0]?.nome || 'Igreja';
}

function mapMembro(m, igrejaId) {
    return {
        id: m.id,
        nome: m.nome,
        cargo: m.cargo || 'Membro',
        situacao: m.situacao || 'Ativo',
        foto_url: m.foto_url || null,
        matricula: matricula(m.id),
        token: gerarToken(igrejaId, m.id)
    };
}

// ─── Membro (App) ───────────────────────────────────────────────────────────

router.get('/api/carteirinha/minha', requireAuth, async (req, res) => {
    if (!req.auth?.app_mode) throw createHttpError(403, 'Rota exclusiva do App de Membros.');
    const igrejaId = Number(req.auth.igrejaId);
    const membroId = Number(req.auth.membro_id || req.auth.id);
    await ensureColunasMembros();
    const [rows] = await pool.query(
        'SELECT id, nome, cargo, situacao, foto_url FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1',
        [membroId, igrejaId]
    );
    if (!rows.length) throw createHttpError(404, 'Cadastro não encontrado.');
    res.json({ igreja: await nomeIgreja(igrejaId), membro: mapMembro(rows[0], igrejaId) });
});

// ─── Equipe (impressão) ─────────────────────────────────────────────────────

router.get('/api/carteirinhas', requireAuth, authorize(EQUIPE), async (req, res) => {
    if (req.auth?.app_mode) throw createHttpError(403, 'Acesso restrito à equipe.');
    const igrejaId = Number(req.auth.igrejaId);
    if (!igrejaId) throw createHttpError(401, 'Sessão inválida.');
    await ensureColunasMembros();

    const conds = ['igreja_id = ?'];
    const params = [igrejaId];
    const busca = String(req.query.busca || '').trim();
    if (busca) { conds.push('nome LIKE ?'); params.push(`%${busca}%`); }
    const situacao = String(req.query.situacao || '').trim();
    if (situacao) { conds.push('situacao = ?'); params.push(situacao); }
    const ids = String(req.query.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
    if (ids.length) { conds.push(`id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }

    const [rows] = await pool.query(
        `SELECT id, nome, cargo, situacao, foto_url FROM membros WHERE ${conds.join(' AND ')} ORDER BY nome ASC LIMIT 500`,
        params
    );
    res.json({ igreja: await nomeIgreja(igrejaId), items: rows.map((m) => mapMembro(m, igrejaId)) });
});

// ─── Verificação pública ────────────────────────────────────────────────────

router.get('/api/carteirinha/verificar/:token', async (req, res) => {
    const dados = lerToken(req.params.token);
    if (!dados) return res.status(404).json({ valido: false, error: 'Carteirinha inválida ou adulterada.' });
    await ensureColunasMembros();
    const [rows] = await pool.query(
        'SELECT id, nome, cargo, situacao FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1',
        [dados.membroId, dados.igrejaId]
    );
    if (!rows.length) return res.status(404).json({ valido: false, error: 'Membro não encontrado (cadastro removido).' });
    const m = rows[0];
    res.set('Cache-Control', 'no-store');
    res.json({
        valido: true,
        ativo: ativo(m.situacao),
        igreja: await nomeIgreja(dados.igrejaId),
        membro: { nome: m.nome, cargo: m.cargo || 'Membro', situacao: m.situacao || 'Ativo', matricula: matricula(m.id) },
        verificado_em: new Date().toISOString()
    });
});

module.exports = router;
module.exports.gerarToken = gerarToken;
module.exports.lerToken = lerToken;
