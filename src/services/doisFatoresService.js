'use strict';

/**
 * Lote 7 — Verificação em duas etapas (TOTP, RFC 6238) para usuários do painel.
 *
 * - Compatível com Google Authenticator, Microsoft Authenticator, Authy etc.
 * - Segredo guardado CRIPTOGRAFADO (AES-256-GCM). Chave: env TWO_FACTOR_KEY, ou derivada
 *   do JWT_SECRET. Trocar a chave invalida os segredos → usuário entra com código de
 *   recuperação (ou o super admin desliga o 2FA dele) e configura de novo.
 * - 10 códigos de recuperação de uso único, guardados como hash SHA-256.
 * - "Desafio" de login: JWT de 5 min assinado com OUTRA chave — não serve como sessão
 *   (requireAuth usa o JWT_SECRET), e limita 5 tentativas por desafio.
 * - totp_ultimo_passo impede reutilizar o mesmo código dentro da janela.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const config = require('../config');
const { createHttpError } = require('../utils/httpError');

const PASSO = 30;          // segundos
const DIGITOS = 6;
const JANELA = 1;          // aceita ±1 passo (relógio do celular adiantado/atrasado)
const QTD_RECUPERACAO = 10;
const EMISSOR = 'LDFP Gestão';
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

// ─── schema (rede de segurança; oficial: INOVACOES_LOTE7_VERIFICACAO_DUAS_ETAPAS.sql) ──

const COLUNAS = [
    ['totp_secret', 'VARCHAR(255) NULL'],
    ['totp_ativo', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['totp_recuperacao', 'TEXT NULL'],
    ['totp_ultimo_passo', 'INT NULL'],
    ['totp_ativado_em', 'DATETIME NULL']
];
let colunasProntas = false;
async function ensureColunas() {
    if (colunasProntas) return;
    for (const [col, tipo] of COLUNAS) {
        try { await pool.query(`ALTER TABLE usuarios ADD COLUMN ${col} ${tipo}`); } catch (_) { /* já existe */ }
    }
    colunasProntas = true;
}

// ─── base32 / TOTP ──────────────────────────────────────────────────────────

function base32Encode(buf) {
    let bits = 0; let valor = 0; let saida = '';
    for (const byte of buf) {
        valor = (valor << 8) | byte; bits += 8;
        while (bits >= 5) { saida += B32[(valor >>> (bits - 5)) & 31]; bits -= 5; }
    }
    if (bits > 0) saida += B32[(valor << (5 - bits)) & 31];
    return saida;
}

function base32Decode(txt) {
    const limpo = String(txt || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0; let valor = 0; const out = [];
    for (const c of limpo) {
        valor = (valor << 5) | B32.indexOf(c); bits += 5;
        if (bits >= 8) { out.push((valor >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
}

function hotp(segredoBuf, contador) {
    const msg = Buffer.alloc(8);
    msg.writeUInt32BE(Math.floor(contador / 0x100000000), 0);
    msg.writeUInt32BE(contador >>> 0, 4);
    const h = crypto.createHmac('sha1', segredoBuf).update(msg).digest();
    const off = h[h.length - 1] & 0x0f;
    const bin = ((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
    return String(bin % (10 ** DIGITOS)).padStart(DIGITOS, '0');
}

function passoAtual(agoraMs = Date.now()) {
    return Math.floor(agoraMs / 1000 / PASSO);
}

/** Retorna o passo que bateu (ou null). */
function verificarTotp(segredoB32, codigo, agoraMs = Date.now()) {
    const c = String(codigo || '').replace(/\D/g, '');
    if (c.length !== DIGITOS) return null;
    const seg = base32Decode(segredoB32);
    const atual = passoAtual(agoraMs);
    for (let d = -JANELA; d <= JANELA; d += 1) {
        const esperado = Buffer.from(hotp(seg, atual + d));
        if (crypto.timingSafeEqual(esperado, Buffer.from(c))) return atual + d;
    }
    return null;
}

// ─── criptografia do segredo ────────────────────────────────────────────────

function chaveCripto() {
    const base = process.env.TWO_FACTOR_KEY || `ldfp-2fa-segredo:${config.security.jwtSecret}`;
    return crypto.createHash('sha256').update(base).digest();
}

function cifrar(texto) {
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv('aes-256-gcm', chaveCripto(), iv);
    const enc = Buffer.concat([c.update(String(texto), 'utf8'), c.final()]);
    return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${enc.toString('base64')}`;
}

function decifrar(valor) {
    const p = String(valor || '').split(':');
    if (p.length !== 4 || p[0] !== 'v1') return null;
    try {
        const d = crypto.createDecipheriv('aes-256-gcm', chaveCripto(), Buffer.from(p[1], 'base64'));
        d.setAuthTag(Buffer.from(p[2], 'base64'));
        return Buffer.concat([d.update(Buffer.from(p[3], 'base64')), d.final()]).toString('utf8');
    } catch (_) {
        return null; // chave mudou ou valor adulterado
    }
}

// ─── códigos de recuperação ─────────────────────────────────────────────────

const hashCodigo = (c) => crypto.createHash('sha256').update(String(c).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex');

function gerarCodigosRecuperacao() {
    const codigos = [];
    for (let i = 0; i < QTD_RECUPERACAO; i += 1) {
        const s = base32Encode(crypto.randomBytes(5)).slice(0, 8);
        codigos.push(`${s.slice(0, 4)}-${s.slice(4)}`);
    }
    return codigos;
}

function lerHashes(txt) {
    try { const a = JSON.parse(txt || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}

// ─── acesso ao banco ────────────────────────────────────────────────────────

async function lerUsuario(userId) {
    await ensureColunas();
    const [rows] = await pool.query(
        `SELECT id, email, nome, password_hash, totp_secret, totp_ativo, totp_recuperacao, totp_ultimo_passo, totp_ativado_em
         FROM usuarios WHERE id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

async function estaAtivo(userId) {
    const u = await lerUsuario(userId);
    return Boolean(u && Number(u.totp_ativo) === 1);
}

/**
 * Confere um código (TOTP de 6 dígitos OU código de recuperação) e já grava o consumo.
 * Retorna 'totp' | 'recuperacao' | null.
 */
async function conferirCodigo(u, codigo) {
    const bruto = String(codigo || '').trim();
    if (!bruto) return null;

    if (/^\d[\d\s]*$/.test(bruto)) {
        const segredo = decifrar(u.totp_secret);
        if (!segredo) return null;
        const passo = verificarTotp(segredo, bruto);
        if (passo === null) return null;
        if (u.totp_ultimo_passo !== null && u.totp_ultimo_passo !== undefined && passo <= Number(u.totp_ultimo_passo)) return null; // reutilizado
        await pool.query('UPDATE usuarios SET totp_ultimo_passo = ? WHERE id = ?', [passo, u.id]);
        u.totp_ultimo_passo = passo;
        return 'totp';
    }

    const hashes = lerHashes(u.totp_recuperacao);
    const h = hashCodigo(bruto);
    const idx = hashes.indexOf(h);
    if (idx === -1) return null;
    hashes.splice(idx, 1);
    await pool.query('UPDATE usuarios SET totp_recuperacao = ? WHERE id = ?', [JSON.stringify(hashes), u.id]);
    u.totp_recuperacao = JSON.stringify(hashes);
    return 'recuperacao';
}

// ─── desafio de login ───────────────────────────────────────────────────────

function chaveDesafio() {
    return crypto.createHash('sha256').update(`ldfp-2fa-desafio:${config.security.jwtSecret}`).digest('hex');
}

const tentativas = new Map(); // jti -> nº de tentativas (memória; desafio vale 5 min)
const MAX_TENTATIVAS = 5;

function criarDesafio(userId) {
    const jti = crypto.randomBytes(12).toString('hex');
    return jwt.sign({ sub: userId, fim: '2fa-login' }, chaveDesafio(), { expiresIn: '5m', jwtid: jti });
}

function lerDesafio(desafio) {
    let p;
    try { p = jwt.verify(String(desafio || ''), chaveDesafio()); } catch (_) {
        throw createHttpError(401, 'A verificação expirou. Entre com e-mail e senha de novo.');
    }
    if (p.fim !== '2fa-login' || !p.sub || !p.jti) throw createHttpError(401, 'Verificação inválida.');
    const n = (tentativas.get(p.jti) || 0) + 1;
    tentativas.set(p.jti, n);
    if (tentativas.size > 5000) tentativas.clear();
    if (n > MAX_TENTATIVAS) throw createHttpError(429, 'Muitas tentativas. Entre com e-mail e senha de novo.');
    return p;
}

function encerrarDesafio(p) {
    tentativas.set(p.jti, MAX_TENTATIVAS + 1); // desafio não pode ser reaproveitado
}

// ─── configuração pelo próprio usuário ──────────────────────────────────────

async function status(userId) {
    const u = await lerUsuario(userId);
    if (!u) throw createHttpError(404, 'Usuário não encontrado.');
    return {
        ativo: Number(u.totp_ativo) === 1,
        ativado_em: u.totp_ativado_em || null,
        codigos_restantes: Number(u.totp_ativo) === 1 ? lerHashes(u.totp_recuperacao).length : 0
    };
}

async function iniciar(userId, senhaInformada, bcrypt) {
    const u = await lerUsuario(userId);
    if (!u) throw createHttpError(404, 'Usuário não encontrado.');
    if (Number(u.totp_ativo) === 1) throw createHttpError(409, 'A verificação em duas etapas já está ativa.');
    if (!senhaInformada || !(await bcrypt.compare(String(senhaInformada), u.password_hash))) {
        throw createHttpError(401, 'Senha incorreta.');
    }
    const segredo = base32Encode(crypto.randomBytes(20));
    await pool.query('UPDATE usuarios SET totp_secret = ?, totp_ativo = 0, totp_ultimo_passo = NULL WHERE id = ?', [cifrar(segredo), u.id]);
    const rotulo = encodeURIComponent(`${EMISSOR}:${u.email}`);
    return {
        segredo,
        segredo_formatado: segredo.match(/.{1,4}/g).join(' '),
        otpauth: `otpauth://totp/${rotulo}?secret=${segredo}&issuer=${encodeURIComponent(EMISSOR)}&algorithm=SHA1&digits=${DIGITOS}&period=${PASSO}`
    };
}

async function ativar(userId, codigo) {
    const u = await lerUsuario(userId);
    if (!u) throw createHttpError(404, 'Usuário não encontrado.');
    if (Number(u.totp_ativo) === 1) throw createHttpError(409, 'A verificação em duas etapas já está ativa.');
    if (!u.totp_secret) throw createHttpError(400, 'Comece pela leitura do QR Code.');
    const segredo = decifrar(u.totp_secret);
    const passo = segredo ? verificarTotp(segredo, codigo) : null;
    if (passo === null) throw createHttpError(400, 'Código incorreto. Confira se o horário do celular está automático e tente o código atual.');
    const codigos = gerarCodigosRecuperacao();
    const agora = new Date().toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
        'UPDATE usuarios SET totp_ativo = 1, totp_recuperacao = ?, totp_ultimo_passo = ?, totp_ativado_em = ? WHERE id = ?',
        [JSON.stringify(codigos.map(hashCodigo)), passo, agora, u.id]
    );
    return { codigos_recuperacao: codigos };
}

async function desativar(userId, senhaInformada, codigo, bcrypt) {
    const u = await lerUsuario(userId);
    if (!u) throw createHttpError(404, 'Usuário não encontrado.');
    if (Number(u.totp_ativo) !== 1) return;
    if (!senhaInformada || !(await bcrypt.compare(String(senhaInformada), u.password_hash))) {
        throw createHttpError(401, 'Senha incorreta.');
    }
    if (!(await conferirCodigo(u, codigo))) throw createHttpError(400, 'Código incorreto.');
    await desligar(u.id);
}

async function novosCodigos(userId, codigo) {
    const u = await lerUsuario(userId);
    if (!u || Number(u.totp_ativo) !== 1) throw createHttpError(400, 'A verificação em duas etapas não está ativa.');
    if (!(await conferirCodigo(u, codigo))) throw createHttpError(400, 'Código incorreto.');
    const codigos = gerarCodigosRecuperacao();
    await pool.query('UPDATE usuarios SET totp_recuperacao = ? WHERE id = ?', [JSON.stringify(codigos.map(hashCodigo)), u.id]);
    return { codigos_recuperacao: codigos };
}

async function desligar(userId) {
    await ensureColunas();
    await pool.query(
        'UPDATE usuarios SET totp_ativo = 0, totp_secret = NULL, totp_recuperacao = NULL, totp_ultimo_passo = NULL, totp_ativado_em = NULL WHERE id = ?',
        [userId]
    );
}

module.exports = {
    // login
    estaAtivo, criarDesafio, lerDesafio, encerrarDesafio, lerUsuario, conferirCodigo,
    // conta
    status, iniciar, ativar, desativar, novosCodigos, desligar, ensureColunas,
    // utilidades (testes)
    _interno: { base32Encode, base32Decode, hotp, verificarTotp, passoAtual, cifrar, decifrar, PASSO }
};
