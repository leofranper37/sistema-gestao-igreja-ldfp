/**
 * Acesso do Membro — ficha cadastral preenchida pelo próprio membro
 *
 * Público (sem login), identificado pelo código da igreja (QR/link):
 *   GET  /api/ficha/igreja?c=CODIGO   → nome da igreja
 *   POST /api/ficha                   → envia a ficha para aprovação (tabela autocadastros)
 * App do Membro (token app_mode):
 *   GET  /api/ficha/meus-dados        → dados atuais do membro
 *   PUT  /api/ficha/meus-dados        → membro atualiza os próprios dados
 * Admin:
 *   GET  /api/ficha/acesso            → código, link e nome para a tela "Acesso do Membro"
 *
 * Código da igreja = 6 primeiros caracteres do igrejas.public_token (maiúsculos).
 * O link/QR usa o token completo.
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../config/db');
const { requireAuth, authorize } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');
const { audit } = require('../services/auditService');

const router = express.Router();

const envioLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Muitos envios seguidos. Tente novamente em alguns minutos.' }
});

// Campos que o membro pode preencher/atualizar sozinho.
// Cargo, situação, congregação etc. continuam só com a secretaria.
const CAMPOS_FICHA = {
    nome: 255, apelido: 120, email: 255, telefone: 60, celular: 60, cpf: 30, rg: 30,
    sexo: 30, estado_civil: 50, profissao: 120, nacionalidade: 120, naturalidade: 120,
    nascimento: 30, cep: 30, endereco: 255, numero: 30, bairro: 120, cidade: 120, estado: 60
};

function limparFicha(body) {
    const out = {};
    for (const [campo, max] of Object.entries(CAMPOS_FICHA)) {
        const v = body?.[campo];
        if (v === undefined || v === null) continue;
        out[campo] = String(v).trim().slice(0, max);
    }
    if (out.cpf) out.cpf = out.cpf.replace(/\D/g, '').slice(0, 11);
    if (out.nascimento && !/^\d{4}-\d{2}-\d{2}$/.test(out.nascimento)) {
        throw createHttpError(400, 'Data de nascimento inválida.');
    }
    if (out.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email)) {
        throw createHttpError(400, 'E-mail inválido.');
    }
    if (out.cpf && out.cpf.length !== 11) {
        throw createHttpError(400, 'CPF deve ter 11 dígitos.');
    }
    return out;
}

async function igrejaPorCodigo(codigo) {
    const c = String(codigo || '').trim();
    if (!c) throw createHttpError(400, 'Informe o código da igreja.');
    let rows;
    if (/^[0-9a-f]{40,64}$/i.test(c)) {
        [rows] = await pool.query(
            'SELECT id, nome FROM igrejas WHERE public_token = ? AND is_system = 0 LIMIT 2', [c.toLowerCase()]);
    } else if (/^[0-9a-f]{6}$/i.test(c)) {
        [rows] = await pool.query(
            'SELECT id, nome FROM igrejas WHERE public_token LIKE ? AND is_system = 0 LIMIT 2', [c.toLowerCase() + '%']);
    } else {
        rows = [];
    }
    // Prefixo ambíguo (duas igrejas) é tratado como não encontrado
    if (rows.length !== 1) throw createHttpError(404, 'Igreja não encontrada. Confira o código.');
    return rows[0];
}

async function garantirToken(igrejaId) {
    const [[row]] = await pool.query('SELECT nome, public_token FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
    if (!row) throw createHttpError(404, 'Igreja não encontrada.');
    let token = row.public_token;
    if (!token) {
        token = crypto.randomBytes(20).toString('hex');
        await pool.query(
            "UPDATE igrejas SET public_token = ? WHERE id = ? AND (public_token IS NULL OR public_token = '')",
            [token, igrejaId]);
        const [[again]] = await pool.query('SELECT public_token FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
        token = again.public_token;
    }
    return { nome: row.nome, token };
}

function colunaAusente(err) {
    return err && (err.code === 'ER_BAD_FIELD_ERROR' || err.code === '42703' || /no such column/i.test(err.message || ''));
}

// ── Admin: dados para a tela Acesso do Membro ─────────────────────────────
router.get('/api/ficha/acesso', requireAuth, authorize(['admin', 'secretaria', 'pastor']), async (req, res) => {
    const { nome, token } = await garantirToken(req.auth.igrejaId);
    const base = `${req.protocol}://${req.get('host')}`;
    res.json({
        igreja: nome,
        codigo: token.slice(0, 6).toUpperCase(),
        link: `${base}/autocadastro.html?c=${token}`,
        linkApp: `${base}/app_login.html?igrejaTk=${token}`
    });
});

// ── Público: nome da igreja pelo código ───────────────────────────────────
router.get('/api/ficha/igreja', async (req, res) => {
    const ig = await igrejaPorCodigo(req.query.c);
    res.json({ nome: ig.nome });
});

// ── Público: envio da ficha ───────────────────────────────────────────────
router.post('/api/ficha', envioLimiter, async (req, res) => {
    const ig = await igrejaPorCodigo(req.body?.c);
    const ficha = limparFicha(req.body);
    if (!ficha.nome || ficha.nome.length < 3) throw createHttpError(400, 'Informe o nome completo.');
    if (!ficha.celular && !ficha.telefone && !ficha.email) {
        throw createHttpError(400, 'Informe ao menos um contato (celular ou e-mail).');
    }
    // Campo "armadilha" para robôs: humanos não veem nem preenchem
    if (req.body?.site) return res.status(201).json({ message: 'Cadastro recebido.' });

    const observacao = String(req.body?.observacao || '').trim().slice(0, 2000) || null;
    const dados = JSON.stringify(ficha);
    const base = [ig.id, ig.nome, ficha.nome, ficha.email || null, ficha.celular || ficha.telefone || null, ficha.cidade || null];

    try {
        await pool.query(
            `INSERT INTO autocadastros (igreja_id, igreja_nome, nome, email, telefone, cidade, observacao, dados_ficha)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [...base, observacao, dados]);
    } catch (err) {
        if (!colunaAusente(err)) throw err;
        // Banco sem a coluna dados_ficha (SQL não rodado): guarda a ficha no texto da observação
        await pool.query(
            `INSERT INTO autocadastros (igreja_id, igreja_nome, nome, email, telefone, cidade, observacao)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [...base, [observacao, 'FICHA: ' + dados].filter(Boolean).join('\n')]);
    }

    res.status(201).json({
        message: 'Cadastro enviado! A secretaria da igreja vai conferir e aprovar.',
        podeUsarApp: Boolean(ficha.cpf)
    });
});

// ── App do Membro: meus dados ─────────────────────────────────────────────
function exigirMembroApp(req) {
    if (!req.auth?.app_mode) throw createHttpError(403, 'Rota exclusiva do App de Membros.');
    return { membroId: req.auth.membro_id || req.auth.id, igrejaId: req.auth.igrejaId };
}

router.get('/api/ficha/meus-dados', requireAuth, async (req, res) => {
    const { membroId, igrejaId } = exigirMembroApp(req);
    const [[row]] = await pool.query(
        `SELECT ${Object.keys(CAMPOS_FICHA).join(', ')}, cargo, situacao
         FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1`,
        [membroId, igrejaId]);
    if (!row) throw createHttpError(404, 'Cadastro não encontrado.');
    res.json(row);
});

router.put('/api/ficha/meus-dados', requireAuth, async (req, res) => {
    const { membroId, igrejaId } = exigirMembroApp(req);
    const ficha = limparFicha(req.body);
    // CPF é a chave de login do app — não pode ser trocado pelo próprio membro
    delete ficha.cpf;
    if ('nome' in ficha && ficha.nome.length < 3) throw createHttpError(400, 'Informe o nome completo.');

    const campos = Object.keys(ficha);
    if (!campos.length) throw createHttpError(400, 'Nada para atualizar.');

    const [r] = await pool.query(
        `UPDATE membros SET ${campos.map(c => `${c} = ?`).join(', ')} WHERE id = ? AND igreja_id = ?`,
        [...campos.map(c => ficha[c] || null), membroId, igrejaId]);
    if (!r.affectedRows) throw createHttpError(404, 'Cadastro não encontrado.');

    audit('membro.autoatualizacao', req, { membroId, campos });
    res.json({ message: 'Seus dados foram atualizados.' });
});

module.exports = router;
