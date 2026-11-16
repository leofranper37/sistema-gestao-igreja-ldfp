'use strict';
/**
 * Isolamento financeiro entre igrejas + bloqueio por assinatura e por plano.
 *
 *  1) Igreja B não lê, altera nem apaga conta bancária / conta a pagar da Igreja A
 *  2) Trial vencido ou assinatura suspensa → 402 (pagamento e /auth/me continuam livres;
 *     o acesso de suporte do super-admin não é bloqueado)
 *  3) Módulo fora do plano → 403 no servidor (não só escondido no menu)
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-acesso-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'acesso-plano-test-secret-32-chars!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';
process.env.LOGIN_RATE_LIMIT_MAX = '10000';

const { test, before, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou: ${JSON.stringify(res.body)}`);
    return { token: res.body.token, igrejaId: res.body.user.igrejaId };
}

async function setIgreja(igrejaId, campos) {
    const cols = Object.keys(campos);
    await pool.query(
        `UPDATE igrejas SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
        [...cols.map((c) => campos[c]), igrejaId]
    );
}

const ONTEM = new Date(Date.now() - 86400000).toISOString().slice(0, 19).replace('T', ' ');
const DAQUI_30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');

let A, B, C, superToken;
let contaBancariaA, contaPagarA;

// No SQLite a 1ª DDL do model (BIGSERIAL) é aceita sem criar o id — usa a versão SQLite
const TABELAS_SQLITE = [
    `CREATE TABLE IF NOT EXISTS banco_contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, nome TEXT NOT NULL,
        banco TEXT, agencia TEXT, conta TEXT, tipo TEXT NOT NULL DEFAULT 'corrente',
        saldo_inicial REAL NOT NULL DEFAULT 0, observacao TEXT, ativo INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS banco_lancamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, conta_id INTEGER NOT NULL, igreja_id INTEGER NOT NULL,
        descricao TEXT NOT NULL, tipo TEXT NOT NULL, valor REAL NOT NULL, data_lancamento TEXT NOT NULL,
        observacao TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
];

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'admin-a@acesso.test', 'SenhaSegura1!', 'Igreja Acesso A');
    B = await register('Admin B', 'admin-b@acesso.test', 'SenhaSegura2!', 'Igreja Acesso B');
    C = await register('Admin C', 'admin-c@acesso.test', 'SenhaSegura3!', 'Igreja Acesso C');

    const hash = await bcrypt.hash('SuperSenha1!', 4);
    await pool.query(
        'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['LDFP Master', A.igrejaId, 'Super', 'super@acesso.test', hash, 'super-admin']
    );
    const [u] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['super@acesso.test']);
    superToken = jwt.sign({ sub: u[0].id, role: 'super-admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    // Dados financeiros da Igreja A
    const rConta = await request(app).post('/banco/contas').set(auth(A.token))
        .send({ nome: 'Conta Corrente A', banco: 'Banco X', tipo: 'corrente', saldoInicial: 0 });
    assert.ok([200, 201].includes(rConta.status), `conta bancária: ${JSON.stringify(rConta.body)}`);
    contaBancariaA = rConta.body.id || rConta.body.conta?.id || rConta.body.data?.id;

    const rPagar = await request(app).post('/contas-pagar').set(auth(A.token))
        .send({ descricao: 'Aluguel A', valor: 1500, vencimento: '2026-12-10' });
    assert.ok([200, 201].includes(rPagar.status), `conta a pagar: ${JSON.stringify(rPagar.body)}`);
    contaPagarA = rPagar.body.id || rPagar.body.conta?.id || rPagar.body.data?.id;

    assert.ok(contaBancariaA && contaPagarA, 'ids dos dados da Igreja A');
});

describe('1) Isolamento financeiro entre igrejas', () => {
    test('B não vê a conta bancária de A na listagem', async () => {
        const r = await request(app).get('/banco/contas').set(auth(B.token));
        assert.equal(r.status, 200);
        assert.ok(!JSON.stringify(r.body).includes('Conta Corrente A'));
    });

    test('B não abre a conta bancária de A pelo id', async () => {
        const r = await request(app).get(`/banco/contas/${contaBancariaA}`).set(auth(B.token));
        assert.ok([403, 404].includes(r.status), `status ${r.status}`);
    });

    test('B não altera a conta bancária de A', async () => {
        // (no SQLite o UPDATE usa NOW() e responde 500; o que importa é não mudar nada — conferido no teste [positivo])
        const r = await request(app).put(`/banco/contas/${contaBancariaA}`).set(auth(B.token))
            .send({ nome: 'Hackeada', tipo: 'corrente', saldoInicial: 0 });
        assert.ok(![200, 201].includes(r.status), `status ${r.status}`);
    });

    test('B não lança movimento na conta bancária de A', async () => {
        const r = await request(app).post(`/banco/contas/${contaBancariaA}/lancamentos`).set(auth(B.token))
            .send({ descricao: 'Saque', tipo: 'saida', valor: 999, dataLancamento: '2026-11-16' });
        assert.ok([403, 404].includes(r.status), `status ${r.status}`);
    });

    test('B não apaga a conta bancária nem a conta a pagar de A', async () => {
        const r1 = await request(app).delete(`/banco/contas/${contaBancariaA}`).set(auth(B.token));
        const r2 = await request(app).delete(`/contas-pagar/${contaPagarA}`).set(auth(B.token));
        assert.ok([403, 404].includes(r1.status), `conta bancária: ${r1.status}`);
        assert.ok([403, 404].includes(r2.status), `conta a pagar: ${r2.status}`);
    });

    test('B não vê as contas a pagar de A', async () => {
        const r = await request(app).get('/contas-pagar').set(auth(B.token));
        assert.equal(r.status, 200);
        assert.ok(!JSON.stringify(r.body).includes('Aluguel A'));
    });

    test('[positivo] dados de A continuam intactos e visíveis para A', async () => {
        const r1 = await request(app).get(`/banco/contas/${contaBancariaA}`).set(auth(A.token));
        assert.equal(r1.status, 200);
        assert.ok(JSON.stringify(r1.body).includes('Conta Corrente A'), 'nome não pode ter sido alterado');
        const r2 = await request(app).get('/contas-pagar').set(auth(A.token));
        assert.ok(JSON.stringify(r2.body).includes('Aluguel A'));
    });
});

describe('2) Bloqueio por assinatura', () => {
    test('trial vencido → 402 nas telas da igreja', async () => {
        await setIgreja(B.igrejaId, { status_assinatura: 'trial', trial_ends_at: ONTEM });
        const r = await request(app).get('/membros').set(auth(B.token));
        assert.equal(r.status, 402);
        assert.match(r.body.error, /teste terminou/i);
    });

    test('trial vencido ainda acessa /auth/me e a área de pagamento', async () => {
        const me = await request(app).get('/auth/me').set(auth(B.token));
        assert.equal(me.status, 200);
        const pg = await request(app).get('/api/pagamentos/status').set(auth(B.token));
        assert.notEqual(pg.status, 402);
    });

    test('assinatura suspensa → 402', async () => {
        await setIgreja(B.igrejaId, { status_assinatura: 'suspensa', trial_ends_at: null });
        const r = await request(app).get('/banco/contas').set(auth(B.token));
        assert.equal(r.status, 402);
    });

    test('suporte do super-admin ("Acessar") não é bloqueado pela assinatura', async () => {
        const imp = await request(app).post(`/api/saas/igrejas/${B.igrejaId}/impersonate`).set(auth(superToken)).send({});
        assert.equal(imp.status, 200, JSON.stringify(imp.body));
        const r = await request(app).get('/membros').set(auth(imp.body.token));
        assert.equal(r.status, 200);
    });

    test('[positivo] trial válido e assinatura ativa continuam liberados', async () => {
        await setIgreja(B.igrejaId, { status_assinatura: 'trial', trial_ends_at: DAQUI_30 });
        assert.equal((await request(app).get('/membros').set(auth(B.token))).status, 200);
        await setIgreja(B.igrejaId, { status_assinatura: 'ativa', trial_ends_at: null });
        assert.equal((await request(app).get('/membros').set(auth(B.token))).status, 200);
    });
});

describe('3) Módulos do plano barrados no servidor', () => {
    before(async () => {
        for (const [slug, key] of [['membros', 'membros'], ['financeiro', 'financeiro'], ['escalas', 'escalas']]) {
            await pool.query(
                `INSERT OR IGNORE INTO saas_modulos (slug, nome, feature_key, ativo) VALUES (?, ?, ?, 1)`,
                [slug, slug, key]
            );
        }
        await pool.query('DELETE FROM saas_plano_modulos WHERE plano_slug = ?', ['basico_teste']);
        await pool.query(
            'INSERT INTO saas_plano_modulos (plano_slug, modulo_slug, ativo) VALUES (?, ?, 1)',
            ['basico_teste', 'membros']
        );
        await setIgreja(C.igrejaId, { plano: 'basico_teste', status_assinatura: 'ativa', trial_ends_at: null });
    });

    test('plano só com Membros → tesouraria bloqueada (403)', async () => {
        for (const rota of ['/contas-pagar', '/banco/contas', '/dizimos', '/contabilidade/plano-contas']) {
            const r = await request(app).get(rota).set(auth(C.token));
            assert.equal(r.status, 403, `${rota} → ${r.status}`);
        }
    });

    test('plano só com Membros → escalas bloqueadas (403)', async () => {
        const r = await request(app).get('/api/escalas/eventos').set(auth(C.token));
        assert.equal(r.status, 403);
    });

    test('[positivo] módulo incluído no plano continua liberado', async () => {
        const r = await request(app).get('/membros').set(auth(C.token));
        assert.equal(r.status, 200);
    });

    test('[positivo] ao incluir "financeiro" no plano a tesouraria libera', async () => {
        await pool.query(
            'INSERT INTO saas_plano_modulos (plano_slug, modulo_slug, ativo) VALUES (?, ?, 1)',
            ['basico_teste', 'financeiro']
        );
        const r = await request(app).get('/contas-pagar').set(auth(C.token));
        assert.equal(r.status, 200);
    });

    test('[positivo] durante o trial válido todos os módulos ficam liberados', async () => {
        await setIgreja(C.igrejaId, { status_assinatura: 'trial', trial_ends_at: DAQUI_30 });
        const r = await request(app).get('/api/escalas/eventos').set(auth(C.token));
        assert.notEqual(r.status, 403);
    });
});
