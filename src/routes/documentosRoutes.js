/**
 * Editor de cartas e certificados
 * Modelos (HTML) por igreja com campos inteligentes {nome}, {cpf}, {igreja}...
 * Tabela: documentos_modelos (ver INOVACOES_LOTE1_2026-11.sql)
 */
const express = require('express');
const { pool } = require('../config/db');
const { requireAuth, authorize } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');
const { audit } = require('../services/auditService');

const router = express.Router();
const auth = [requireAuth, authorize(['admin', 'secretaria', 'pastor'])];

const TIPOS = ['carta', 'certificado', 'declaracao', 'outro'];
const ORIENTACOES = ['retrato', 'paisagem'];
const MAX_CONTEUDO = 500000; // ~500 KB de HTML (imagens devem ser por URL, não base64 grande)

function tabelaAusente(err) {
    return err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === '42P01' || /no such table/i.test(err.message || ''));
}

function semTabela() {
    return createHttpError(503, 'O módulo de cartas ainda não foi ativado no banco. Rode o SQL INOVACOES_LOTE1_2026-11.sql no phpMyAdmin.');
}

function validarModelo(body) {
    const nome = String(body?.nome || '').trim().slice(0, 150);
    const tipo = TIPOS.includes(body?.tipo) ? body.tipo : 'carta';
    const orientacao = ORIENTACOES.includes(body?.orientacao) ? body.orientacao : 'retrato';
    const conteudo = String(body?.conteudo || '');
    if (!nome) throw createHttpError(400, 'Informe o nome do modelo.');
    if (!conteudo.trim()) throw createHttpError(400, 'O modelo está vazio.');
    if (conteudo.length > MAX_CONTEUDO) throw createHttpError(413, 'Modelo muito grande. Use imagens por link em vez de colar a imagem.');
    return { nome, tipo, orientacao, conteudo };
}

// ── Modelos ─────────────────────────────────────────────
router.get('/api/documentos/modelos', ...auth, async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, nome, tipo, orientacao, conteudo, updated_at
             FROM documentos_modelos WHERE igreja_id = ? ORDER BY nome`,
            [req.auth.igrejaId]);
        res.json(rows);
    } catch (err) {
        if (tabelaAusente(err)) throw semTabela();
        throw err;
    }
});

router.post('/api/documentos/modelos', ...auth, async (req, res) => {
    const m = validarModelo(req.body);
    try {
        const [r] = await pool.query(
            `INSERT INTO documentos_modelos (igreja_id, nome, tipo, orientacao, conteudo, created_by)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.auth.igrejaId, m.nome, m.tipo, m.orientacao, m.conteudo, req.auth.id || null]);
        audit('documento_modelo.create', req, { id: r.insertId, nome: m.nome });
        res.status(201).json({ id: r.insertId });
    } catch (err) {
        if (tabelaAusente(err)) throw semTabela();
        throw err;
    }
});

router.put('/api/documentos/modelos/:id', ...auth, async (req, res) => {
    const m = validarModelo(req.body);
    const [r] = await pool.query(
        `UPDATE documentos_modelos SET nome = ?, tipo = ?, orientacao = ?, conteudo = ?, updated_at = NOW()
         WHERE id = ? AND igreja_id = ?`,
        [m.nome, m.tipo, m.orientacao, m.conteudo, Number(req.params.id), req.auth.igrejaId]);
    if (!r.affectedRows) throw createHttpError(404, 'Modelo não encontrado.');
    audit('documento_modelo.update', req, { id: Number(req.params.id) });
    res.json({ ok: true });
});

router.delete('/api/documentos/modelos/:id', ...auth, async (req, res) => {
    const [r] = await pool.query(
        'DELETE FROM documentos_modelos WHERE id = ? AND igreja_id = ?',
        [Number(req.params.id), req.auth.igrejaId]);
    if (!r.affectedRows) throw createHttpError(404, 'Modelo não encontrado.');
    audit('documento_modelo.delete', req, { id: Number(req.params.id) });
    res.json({ ok: true });
});

// ── Dados para preencher os campos ──────────────────────
router.get('/api/documentos/membros', ...auth, async (req, res) => {
    const [rows] = await pool.query(
        `SELECT id, nome, cargo, situacao FROM membros WHERE igreja_id = ? ORDER BY nome LIMIT 5000`,
        [req.auth.igrejaId]);
    res.json(rows);
});

router.get('/api/documentos/dados', ...auth, async (req, res) => {
    const igrejaId = req.auth.igrejaId;
    const [[igreja]] = await pool.query(
        'SELECT nome, responsavel, telefone, cnpj, email_admin FROM igrejas WHERE id = ? LIMIT 1',
        [igrejaId]);

    let membro = null;
    const membroId = Number(req.query.membroId);
    if (membroId) {
        const [[row]] = await pool.query(
            `SELECT id, nome, apelido, email, telefone, celular, cpf, rg, sexo, estado_civil, profissao,
                    nacionalidade, naturalidade, nascimento, data_nascimento, cep, endereco, numero,
                    bairro, cidade, estado, cargo, situacao, created_at
             FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1`,
            [membroId, igrejaId]);
        if (!row) throw createHttpError(404, 'Membro não encontrado.');
        membro = row;
    }

    res.json({ igreja: igreja || {}, membro });
});

module.exports = router;
