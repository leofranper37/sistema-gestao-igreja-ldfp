'use strict';

/**
 * Lote 8 — Login com Google (Google Identity Services) para usuários do painel.
 *
 * Desligado até existir GOOGLE_CLIENT_ID no .env (pode ser mais de um, separados por vírgula).
 * O navegador recebe do Google um "ID token" (JWT RS256); aqui conferimos assinatura
 * (chaves públicas do Google, em cache), audiência (nosso Client ID), emissor, validade
 * e e-mail verificado. Nada de senha do Google passa pelo LDFP.
 *
 * Regras de vínculo (sem autocadastro):
 *  - procura usuário por usuarios.google_sub; se não houver, pelo e-mail — e só vincula
 *    se esse usuário ainda não tiver outra conta Google vinculada;
 *  - super-admin NÃO entra com Google (só senha + 2FA);
 *  - verificação em duas etapas continua valendo.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

const URL_CHAVES = 'https://www.googleapis.com/oauth2/v3/certs';
const EMISSORES = ['accounts.google.com', 'https://accounts.google.com'];
const SUPER_ROLES = ['super-admin', 'super_admin', 'superadmin', 'master', 'owner', 'root'];

let cache = { chaves: null, expira: 0 };
let chavesTeste = null;

function clientIds() {
    return String(process.env.GOOGLE_CLIENT_ID || '').split(',').map((s) => s.trim()).filter(Boolean);
}

function ativo() {
    return clientIds().length > 0;
}

/** Só para testes: substitui as chaves do Google por um JWKS local. */
function _definirChavesTeste(jwks) {
    chavesTeste = jwks;
}

async function obterChaves(forcar = false) {
    if (chavesTeste) return chavesTeste.keys;
    if (!forcar && cache.chaves && Date.now() < cache.expira) return cache.chaves;
    const r = await fetch(URL_CHAVES);
    if (!r.ok) throw createHttpError(503, 'Não foi possível falar com o Google agora. Tente de novo.');
    const corpo = await r.json();
    const m = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
    cache = { chaves: corpo.keys || [], expira: Date.now() + (m ? Number(m[1]) * 1000 : 3600 * 1000) };
    return cache.chaves;
}

async function verificarIdToken(credential) {
    if (!ativo()) throw createHttpError(503, 'Login com Google não está configurado.');
    const token = String(credential || '');
    const dec = jwt.decode(token, { complete: true });
    if (!dec || !dec.header || dec.header.alg !== 'RS256' || !dec.header.kid) {
        throw createHttpError(401, 'Credencial do Google inválida.');
    }
    let chaves = await obterChaves();
    let jwk = chaves.find((k) => k.kid === dec.header.kid);
    if (!jwk && !chavesTeste) { // Google troca as chaves periodicamente
        chaves = await obterChaves(true);
        jwk = chaves.find((k) => k.kid === dec.header.kid);
    }
    if (!jwk) throw createHttpError(401, 'Credencial do Google inválida.');

    let p;
    try {
        const chavePublica = crypto.createPublicKey({ key: jwk, format: 'jwk' });
        p = jwt.verify(token, chavePublica, { algorithms: ['RS256'], audience: clientIds(), issuer: EMISSORES });
    } catch (_) {
        throw createHttpError(401, 'Credencial do Google inválida ou expirada.');
    }
    if (!p.sub || !p.email) throw createHttpError(401, 'Credencial do Google incompleta.');
    if (p.email_verified !== true && p.email_verified !== 'true') {
        throw createHttpError(401, 'Este e-mail do Google ainda não foi verificado.');
    }
    return { sub: String(p.sub), email: String(p.email).toLowerCase().trim(), nome: p.name || '' };
}

// ─── schema (oficial: INOVACOES_LOTE8_LOGIN_GOOGLE.sql) ─────────────────────

let colunasProntas = false;
async function ensureColunas() {
    if (colunasProntas) return;
    for (const [col, tipo] of [['google_sub', 'VARCHAR(64) NULL'], ['google_email', 'VARCHAR(255) NULL'], ['google_vinculado_em', 'DATETIME NULL']]) {
        try { await pool.query(`ALTER TABLE usuarios ADD COLUMN ${col} ${tipo}`); } catch (_) { /* já existe */ }
    }
    colunasProntas = true;
}

const agoraSql = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

/** Login: devolve o e-mail do usuário do LDFP a ser autenticado. */
async function resolverUsuario(perfil) {
    await ensureColunas();
    let [rows] = await pool.query('SELECT id, email, role, google_sub FROM usuarios WHERE google_sub = ? LIMIT 1', [perfil.sub]);
    let u = rows[0];
    if (!u) {
        [rows] = await pool.query('SELECT id, email, role, google_sub FROM usuarios WHERE LOWER(email) = ? LIMIT 1', [perfil.email]);
        u = rows[0];
        if (!u) {
            throw createHttpError(404, 'Não há usuário do painel com este e-mail do Google. Peça ao administrador da igreja para cadastrar o seu e-mail, ou entre com senha e vincule o Google em "Segurança da Conta".');
        }
        if (u.google_sub && u.google_sub !== perfil.sub) {
            throw createHttpError(401, 'Esta conta do LDFP está vinculada a outra conta Google.');
        }
    }
    if (SUPER_ROLES.includes(String(u.role || '').toLowerCase())) {
        throw createHttpError(403, 'O administrador do sistema entra só com senha e verificação em duas etapas.');
    }
    if (!u.google_sub) {
        await pool.query('UPDATE usuarios SET google_sub = ?, google_email = ?, google_vinculado_em = ? WHERE id = ?', [perfil.sub, perfil.email, agoraSql(), u.id]);
    }
    return u;
}

// ─── vínculo pela página Segurança da Conta ─────────────────────────────────

async function statusVinculo(userId) {
    await ensureColunas();
    const [[u]] = await pool.query('SELECT google_sub, google_email, google_vinculado_em, role FROM usuarios WHERE id = ? LIMIT 1', [userId]);
    return {
        disponivel: ativo() && !SUPER_ROLES.includes(String(u?.role || '').toLowerCase()),
        clientId: ativo() ? clientIds()[0] : null,
        vinculado: Boolean(u && u.google_sub),
        email: u?.google_email || null,
        vinculado_em: u?.google_vinculado_em || null
    };
}

async function vincular(userId, credential) {
    const perfil = await verificarIdToken(credential);
    await ensureColunas();
    const [[eu]] = await pool.query('SELECT id, role FROM usuarios WHERE id = ? LIMIT 1', [userId]);
    if (!eu) throw createHttpError(404, 'Usuário não encontrado.');
    if (SUPER_ROLES.includes(String(eu.role || '').toLowerCase())) throw createHttpError(403, 'O administrador do sistema não usa login com Google.');
    const [outro] = await pool.query('SELECT id FROM usuarios WHERE google_sub = ? AND id <> ? LIMIT 1', [perfil.sub, userId]);
    if (outro.length) throw createHttpError(409, 'Esta conta Google já está vinculada a outro usuário.');
    await pool.query('UPDATE usuarios SET google_sub = ?, google_email = ?, google_vinculado_em = ? WHERE id = ?', [perfil.sub, perfil.email, agoraSql(), userId]);
    return { email: perfil.email };
}

async function desvincular(userId) {
    await ensureColunas();
    await pool.query('UPDATE usuarios SET google_sub = NULL, google_email = NULL, google_vinculado_em = NULL WHERE id = ?', [userId]);
}

module.exports = {
    ativo, clientIds, verificarIdToken, resolverUsuario, statusVinculo, vincular, desvincular, ensureColunas,
    _definirChavesTeste
};
