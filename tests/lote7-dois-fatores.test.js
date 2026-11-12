'use strict';
/**
 * Lote 7 — Verificação em duas etapas (TOTP) no login do painel.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ldfp-lote7-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lote7-test-secret-32-chars-min!!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');
const { _interno: T } = require('../src/services/doisFatoresService');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const EMAIL_A = 'admin-a@lote7-test.com';
const SENHA_A = 'SenhaSegura1!';
const EMAIL_S = 'super@lote7-test.com';
const SENHA_S = 'SenhaSegura9!';

let tokenA; let tokenS; let userIdA;
let segredo; let codigosRec;

const codigo = (deslocamento = 0) => T.hotp(T.base32Decode(segredo), T.passoAtual() + deslocamento);

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou para ${email}: ${JSON.stringify(res.body)}`);
    return res.body.token;
}

before(async () => {
    await initializeDatabase();
    tokenA = await register('Admin A', EMAIL_A, SENHA_A, 'Igreja Alfa');
    await register('Super', EMAIL_S, SENHA_S, 'Igreja Sistema');
    await pool.query("UPDATE usuarios SET role = 'super-admin' WHERE email = ?", [EMAIL_S]);
    const r = await request(app).post('/login').send({ email: EMAIL_S, senha: SENHA_S });
    tokenS = r.body.token;
    const [[u]] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [EMAIL_A]);
    userIdA = u.id;
});

after(() => {
    try { fs.unlinkSync(TEST_DB); } catch (_) { /* ignore */ }
});

describe('Lote 7 — TOTP (RFC 6238)', () => {
    test('vetor oficial da RFC 6238 (SHA1, T=59s → 287082)', () => {
        const seg = Buffer.from('12345678901234567890');
        assert.equal(T.hotp(seg, Math.floor(59 / 30)), '287082');
        assert.equal(T.hotp(seg, Math.floor(1111111109 / 30)), '081804');
    });
    test('base32 ida e volta', () => {
        const b = Buffer.from('LDFP gestão ✓');
        assert.deepEqual(T.base32Decode(T.base32Encode(b)), b);
    });
    test('cifra do segredo: decifra com a mesma chave, recusa adulteração', () => {
        const c = T.cifrar('SEGREDO');
        assert.equal(T.decifrar(c), 'SEGREDO');
        assert.equal(T.decifrar(c.slice(0, -4) + 'AAAA'), null);
    });
});

describe('Lote 7 — ativação e login', () => {
    test('status inicial: desligado; login normal entrega token', async () => {
        let r = await request(app).get('/api/2fa/status').set(auth(tokenA));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.ativo, false);
        r = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        assert.ok(r.body.token);
    });

    test('iniciar exige a senha; ativar exige código correto', async () => {
        let r = await request(app).post('/api/2fa/iniciar').set(auth(tokenA)).send({ senha: 'errada' });
        assert.equal(r.status, 401);
        r = await request(app).post('/api/2fa/iniciar').set(auth(tokenA)).send({ senha: SENHA_A });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        segredo = r.body.segredo;
        assert.match(r.body.otpauth, /^otpauth:\/\/totp\//);

        const [[row]] = await pool.query('SELECT totp_secret, totp_ativo FROM usuarios WHERE id = ?', [userIdA]);
        assert.ok(!String(row.totp_secret).includes(segredo), 'segredo NÃO pode ficar em texto puro no banco');
        assert.equal(Number(row.totp_ativo), 0, 'ainda não ativo antes de confirmar o código');

        r = await request(app).post('/api/2fa/ativar').set(auth(tokenA)).send({ codigo: '000000' === codigo() ? '111111' : '000000' });
        assert.equal(r.status, 400);
        r = await request(app).post('/api/2fa/ativar').set(auth(tokenA)).send({ codigo: codigo() });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        codigosRec = r.body.codigos_recuperacao;
        assert.equal(codigosRec.length, 10);
    });

    test('com 2FA ativo, a senha sozinha NÃO entrega token', async () => {
        const r = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        assert.equal(r.status, 200);
        assert.equal(r.body.requer_2fa, true);
        assert.equal(r.body.token, undefined);
        assert.ok(r.body.desafio);

        const s = await request(app).get('/api/2fa/status').set(auth(r.body.desafio));
        assert.equal(s.status, 401, 'o desafio não pode funcionar como sessão');
    });

    test('código errado → 401; código já usado (replay) → 401; código novo → token', async () => {
        const { body } = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        let r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: '12345' });
        assert.equal(r.status, 401);
        r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigo(0) });
        assert.equal(r.status, 401, 'o código usado na ativação não pode ser reutilizado');
        r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigo(1) });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.body.token);

        const s = await request(app).get('/api/2fa/status').set(auth(r.body.token));
        assert.equal(s.body.ativo, true);
        assert.equal(s.body.codigos_restantes, 10);

        r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigosRec[9] });
        assert.equal(r.status, 429, 'desafio já usado não serve de novo');
    });

    test('limite de 5 tentativas por desafio', async () => {
        const { body } = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        for (let i = 0; i < 5; i += 1) {
            const r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: 'ZZZZ-ZZZZ' });
            assert.equal(r.status, 401);
        }
        const r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigosRec[0] });
        assert.equal(r.status, 429);
    });

    test('desafio falso/expirado → 401', async () => {
        const r = await request(app).post('/login/2fa').send({ desafio: 'abc.def.ghi', codigo: '123456' });
        assert.equal(r.status, 401);
    });

    test('código de recuperação entra uma única vez', async () => {
        let { body } = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        let r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigosRec[0].toLowerCase() });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.match(r.body.aviso, /Restam 9/);
        ({ body } = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A }));
        r = await request(app).post('/login/2fa').send({ desafio: body.desafio, codigo: codigosRec[0] });
        assert.equal(r.status, 401);
    });

    test('desativar exige senha + código', async () => {
        let r = await request(app).post('/api/2fa/desativar').set(auth(tokenA)).send({ senha: SENHA_A, codigo: 'ERRADO00' });
        assert.equal(r.status, 400);
        r = await request(app).post('/api/2fa/desativar').set(auth(tokenA)).send({ senha: 'x', codigo: codigosRec[1] });
        assert.equal(r.status, 401);
        r = await request(app).post('/api/2fa/desativar').set(auth(tokenA)).send({ senha: SENHA_A, codigo: codigosRec[2] });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        assert.ok(r.body.token, 'sem 2FA volta ao login normal');
    });
});

describe('Lote 7 — super admin', () => {
    test('super admin usa o 2FA (rota liberada no churchGuard) e o login exige código', async () => {
        let r = await request(app).post('/api/2fa/iniciar').set(auth(tokenS)).send({ senha: SENHA_S });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const seg = r.body.segredo;
        const cod = (d) => T.hotp(T.base32Decode(seg), T.passoAtual() + d);
        r = await request(app).post('/api/2fa/ativar').set(auth(tokenS)).send({ codigo: cod(0) });
        assert.equal(r.status, 200);

        r = await request(app).post('/login').send({ email: EMAIL_S, senha: SENHA_S });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.requer_2fa, true);
        assert.equal(r.body.token, undefined);
        const desafio = r.body.desafio;
        r = await request(app).post('/login/2fa').send({ desafio, codigo: cod(1) });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.user.role, 'super-admin');
        tokenS = r.body.token;
    });

    test('só o super admin desliga o 2FA de outro usuário', async () => {
        // reativa o 2FA da Igreja A
        let r = await request(app).post('/api/2fa/iniciar').set(auth(tokenA)).send({ senha: SENHA_A });
        segredo = r.body.segredo;
        r = await request(app).post('/api/2fa/ativar').set(auth(tokenA)).send({ codigo: codigo() });
        assert.equal(r.status, 200);

        r = await request(app).post(`/api/saas/usuarios/${userIdA}/2fa/desativar`).set(auth(tokenA)).send({});
        assert.equal(r.status, 403);
        r = await request(app).post(`/api/saas/usuarios/${userIdA}/2fa/desativar`).set(auth(tokenS)).send({});
        assert.equal(r.status, 200, JSON.stringify(r.body));

        r = await request(app).post('/login').send({ email: EMAIL_A, senha: SENHA_A });
        assert.ok(r.body.token);
        r = await request(app).get('/api/saas/usuarios').set(auth(tokenS)).query({ q: 'lote7' });
        assert.equal(r.status, 200);
        assert.ok(r.body.find((u) => u.email === EMAIL_A && Number(u.totp_ativo) === 0));
    });
});
