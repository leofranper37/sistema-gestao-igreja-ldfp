'use strict';
/**
 * Lote 8 — Login com Google. As chaves do Google são substituídas por um par RSA local
 * (mesmo formato JWKS), então dá para testar assinatura, audiência, emissor e vínculo.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const TEST_DB = path.join(os.tmpdir(), `ldfp-lote8-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lote8-test-secret-32-chars-min!!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
const CLIENT_ID = 'teste-123.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_ID = CLIENT_ID;

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');
const googleAuth = require('../src/services/googleAuthService');
const { _interno: T } = require('../src/services/doisFatoresService');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const outra = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
googleAuth._definirChavesTeste({ keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' }] });

function idToken(over = {}, opts = {}) {
    const payload = { sub: 'g-111', email: 'admin-a@lote8-test.com', email_verified: true, name: 'Admin A', ...over };
    return jwt.sign(payload, opts.chave || privateKey, {
        algorithm: 'RS256', keyid: opts.kid || 'k1', audience: opts.aud || CLIENT_ID,
        issuer: opts.iss || 'https://accounts.google.com', expiresIn: opts.exp || '5m'
    });
}

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let tokenA; let tokenB;

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou para ${email}: ${JSON.stringify(res.body)}`);
    return res.body.token;
}

before(async () => {
    await initializeDatabase();
    tokenA = await register('Admin A', 'admin-a@lote8-test.com', 'SenhaSegura1!', 'Igreja Alfa');
    tokenB = await register('Admin B', 'admin-b@lote8-test.com', 'SenhaSegura2!', 'Igreja Beta');
    await register('Super', 'super@lote8-test.com', 'SenhaSegura9!', 'Igreja Sistema');
    await pool.query("UPDATE usuarios SET role = 'super-admin' WHERE email = 'super@lote8-test.com'");
});

after(() => {
    try { fs.unlinkSync(TEST_DB); } catch (_) { /* ignore */ }
});

const google = (credential) => request(app).post('/login/google').send({ credential });

describe('Lote 8 — Login com Google', () => {
    test('config pública indica ativo + client id', async () => {
        const r = await request(app).get('/api/auth/google/config');
        assert.deepEqual(r.body, { ativo: true, clientId: CLIENT_ID });
    });

    test('credenciais inválidas são recusadas', async () => {
        for (const [nome, cred] of [
            ['lixo', 'abc'],
            ['assinada por outra chave', idToken({}, { chave: outra.privateKey })],
            ['kid desconhecido', idToken({}, { kid: 'k9' })],
            ['outro client id', idToken({}, { aud: 'app-de-outro.apps.googleusercontent.com' })],
            ['emissor falso', idToken({}, { iss: 'https://evil.example.com' })],
            ['expirada', idToken({}, { exp: -10 })],
            ['e-mail não verificado', idToken({ email_verified: false })]
        ]) {
            const r = await google(cred);
            assert.equal(r.status, 401, `${nome}: ${JSON.stringify(r.body)}`);
            assert.equal(r.body.token, undefined);
        }
    });

    test('e-mail sem usuário no painel → 404 (não cria conta)', async () => {
        const r = await google(idToken({ sub: 'g-999', email: 'ninguem@gmail.com' }));
        assert.equal(r.status, 404);
        const [rows] = await pool.query("SELECT id FROM usuarios WHERE email = 'ninguem@gmail.com'");
        assert.equal(rows.length, 0);
    });

    test('e-mail conhecido entra e vincula a conta Google', async () => {
        const r = await google(idToken());
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.body.token);
        assert.equal(r.body.user.email, 'admin-a@lote8-test.com');
        const s = await request(app).get('/api/minha-conta/google').set(auth(r.body.token));
        assert.equal(s.body.vinculado, true);
    });

    test('mesmo e-mail com OUTRA conta Google (sub diferente) é barrado', async () => {
        const r = await google(idToken({ sub: 'g-impostor' }));
        assert.equal(r.status, 401, JSON.stringify(r.body));
    });

    test('super admin não entra com Google', async () => {
        const r = await google(idToken({ sub: 'g-super', email: 'super@lote8-test.com' }));
        assert.equal(r.status, 403);
    });

    test('com 2FA ativo, o Google também pede o código', async () => {
        let r = await request(app).post('/api/2fa/iniciar').set(auth(tokenA)).send({ senha: 'SenhaSegura1!' });
        const seg = r.body.segredo;
        r = await request(app).post('/api/2fa/ativar').set(auth(tokenA)).send({ codigo: T.hotp(T.base32Decode(seg), T.passoAtual()) });
        assert.equal(r.status, 200);

        r = await google(idToken());
        assert.equal(r.body.requer_2fa, true);
        assert.equal(r.body.token, undefined);
        r = await request(app).post('/login/2fa').send({ desafio: r.body.desafio, codigo: T.hotp(T.base32Decode(seg), T.passoAtual() + 1) });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.body.token);
    });

    test('vincular outra conta Google estando logado; conta já usada → 409', async () => {
        let r = await request(app).post('/api/minha-conta/google').set(auth(tokenB)).send({ credential: idToken({ sub: 'g-111', email: 'qualquer@gmail.com' }) });
        assert.equal(r.status, 409, 'g-111 já é do usuário A');

        r = await request(app).post('/api/minha-conta/google').set(auth(tokenB)).send({ credential: idToken({ sub: 'g-222', email: 'pessoal.b@gmail.com' }) });
        assert.equal(r.status, 200, JSON.stringify(r.body));

        r = await google(idToken({ sub: 'g-222', email: 'pessoal.b@gmail.com' }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.user.email, 'admin-b@lote8-test.com', 'entra no usuário B pelo vínculo, mesmo com e-mail Google diferente');
    });

    test('desvincular exige senha', async () => {
        let r = await request(app).delete('/api/minha-conta/google').set(auth(tokenB)).send({ senha: 'errada' });
        assert.equal(r.status, 401);
        r = await request(app).delete('/api/minha-conta/google').set(auth(tokenB)).send({ senha: 'SenhaSegura2!' });
        assert.equal(r.status, 200);
        r = await google(idToken({ sub: 'g-222', email: 'pessoal.b@gmail.com' }));
        assert.equal(r.status, 404, 'sem vínculo e e-mail diferente → não entra');
    });

    test('sem GOOGLE_CLIENT_ID fica desligado', async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        try {
            let r = await request(app).get('/api/auth/google/config');
            assert.deepEqual(r.body, { ativo: false, clientId: null });
            r = await google(idToken());
            assert.equal(r.status, 503);
        } finally {
            process.env.GOOGLE_CLIENT_ID = CLIENT_ID;
        }
    });
});
