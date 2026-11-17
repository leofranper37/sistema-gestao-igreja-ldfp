'use strict';
/**
 * Nova Tesouraria — Caixa por competência: saldo inicial (competência travada),
 * lançamentos só na competência ativa, ativar competência em sequência,
 * saldo anterior calculado, dízimo com destino "Caixa" entrando no caixa
 * e isolamento entre igrejas.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-caixa-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'caixa-novo-test-secret-32-chars!!!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';
process.env.LOGIN_RATE_LIMIT_MAX = '10000';

const { test, before, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou: ${JSON.stringify(res.body)}`);
    return { token: res.body.token, igrejaId: res.body.user.igrejaId };
}

const TABELAS_SQLITE = [
    `CREATE TABLE IF NOT EXISTS dizimos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, membro_id INTEGER,
        membro_nome TEXT NOT NULL, valor REAL NOT NULL, competencia TEXT NOT NULL,
        tipo TEXT NOT NULL DEFAULT 'dizimo', observacao TEXT, created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS banco_contas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, nome TEXT NOT NULL,
        banco TEXT, agencia TEXT, conta TEXT, tipo TEXT NOT NULL DEFAULT 'corrente',
        saldo_inicial REAL NOT NULL DEFAULT 0, observacao TEXT, ativo INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS banco_lancamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, conta_id INTEGER NOT NULL, igreja_id INTEGER NOT NULL,
        descricao TEXT NOT NULL, tipo TEXT NOT NULL, valor REAL NOT NULL, data_lancamento TEXT NOT NULL,
        observacao TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`
];

// Meses relativos a hoje: o teste não envelhece
function mes(delta) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, comp: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` };
}
const M2 = mes(-2), M1 = mes(-1), M0 = mes(0), P1 = mes(1);

let A, B, lancA, bancoA;

const lanc = (extra = {}) => ({
    data: `${M2.iso}-10`, doc: 'NF 1', historico: 'Conta de luz', valor: '50,00', tipo: 'SAIDA',
    contaContabil: '3.01.03 - Energia elétrica', ...extra
});
const estado = async (t) => (await request(app).get('/caixa/competencia').set(auth(t))).body;

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@caixa.test', 'SenhaSegura1!', 'Igreja Caixa A');
    B = await register('Admin B', 'b@caixa.test', 'SenhaSegura2!', 'Igreja Caixa B');
    const c = await request(app).post('/banco/contas').set(auth(A.token)).send({ nome: 'Conta A', tipo: 'corrente', saldoInicial: 0 });
    bancoA = c.body.id;
});

describe('Saldo inicial e competência', () => {
    test('sem saldo inicial: caixa não configurado e lançamento bloqueado', async () => {
        const e = await estado(A.token);
        assert.equal(e.configurado, false);
        const r = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send(lanc());
        assert.equal(r.status, 409);
    });

    test('define o saldo inicial e a competência inicial', async () => {
        const r = await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token))
            .send({ competencia: M2.comp, saldoInicial: '1.000,00' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.estado.primeiraCompetencia, M2.comp);
        assert.equal(r.body.estado.competenciaAtiva, M2.comp);
        assert.equal(r.body.estado.saldoAnterior, 1000);
    });

    test('a competência do saldo inicial não muda; o valor sim', async () => {
        const outra = await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token))
            .send({ competencia: M1.comp, saldoInicial: '10' });
        assert.equal(outra.status, 409);
        const ok = await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token))
            .send({ competencia: M2.comp, saldoInicial: '1254,55' });
        assert.equal(ok.status, 200);
        assert.equal(ok.body.estado.saldoInicial, 1254.55);
    });
});

describe('Lançamentos de caixa', () => {
    test('crédito e débito na competência ativa entram no resumo', async () => {
        const c = await request(app).post('/caixa/lancamentos').set(auth(A.token))
            .send(lanc({ historico: 'Oferta especial', valor: '200,00', tipo: 'ENTRADA', contaContabil: '4.09.99 - Outras receitas' }));
        assert.equal(c.status, 201, JSON.stringify(c.body));
        const d = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send(lanc());
        assert.equal(d.status, 201);
        lancA = d.body.id;

        const e = await estado(A.token);
        assert.equal(e.creditos, 200);
        assert.equal(e.debitos, 50);
        assert.equal(e.saldoAtual, 1404.55);

        const g = await request(app).get(`/caixa/lancamentos/${lancA}`).set(auth(A.token));
        assert.equal(g.body.conta_contabil, '3.01.03 - Energia elétrica');
        assert.equal(g.body.data, `${M2.iso}-10`);
    });

    test('data fora da competência ativa é recusada', async () => {
        const r = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send(lanc({ data: `${M1.iso}-05` }));
        assert.equal(r.status, 400);
        assert.match(r.body.error || r.body.message, /competência ativa/);
    });

    test('edita um lançamento da competência ativa', async () => {
        const r = await request(app).put(`/caixa/lancamentos/${lancA}`).set(auth(A.token)).send(lanc({ valor: '80,00' }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal((await estado(A.token)).debitos, 80);
    });

    test('lista filtra por período, tipo e busca', async () => {
        const r = await request(app).get(`/caixa/lancamentos?inicio=${M2.iso}-01&fim=${M1.iso}-01&tipo=SAIDA&busca=luz`).set(auth(A.token));
        assert.equal(r.status, 200);
        assert.equal(r.body.meta.total, 1);
        assert.equal(r.body.items[0].historico, 'Conta de luz');
    });
});

describe('Ativar competência', () => {
    test('ativa o mês seguinte levando o saldo', async () => {
        const r = await request(app).post('/caixa/competencia/ativar').set(auth(A.token)).send({});
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.estado.competenciaAtiva, M1.comp);
        assert.equal(r.body.estado.saldoAnterior, 1374.55);
        assert.equal(r.body.estado.creditos, 0);
    });

    test('lançamento da competência encerrada não pode ser editado nem excluído', async () => {
        const e = await request(app).put(`/caixa/lancamentos/${lancA}`).set(auth(A.token)).send(lanc({ data: `${M1.iso}-02` }));
        assert.equal(e.status, 409);
        const d = await request(app).delete(`/caixa/lancamentos/${lancA}`).set(auth(A.token));
        assert.equal(d.status, 409);
    });

    test('não ativa competência futura', async () => {
        await request(app).post('/caixa/competencia/ativar').set(auth(A.token)).send({}); // M0
        const r1 = await request(app).post('/caixa/competencia/ativar').set(auth(A.token)).send({}); // P1 (mês seguinte é permitido)
        assert.equal(r1.status, 200);
        assert.equal(r1.body.estado.competenciaAtiva, P1.comp);
        const r2 = await request(app).post('/caixa/competencia/ativar').set(auth(A.token)).send({});
        assert.equal(r2.status, 409);
        assert.equal((await estado(A.token)).competenciaAtiva, P1.comp);
    });
});

describe('Isolamento entre igrejas', () => {
    test('igreja B não vê, não altera e não exclui lançamento da A', async () => {
        const e = await estado(B.token);
        assert.equal(e.configurado, false);
        assert.equal((await request(app).get(`/caixa/lancamentos/${lancA}`).set(auth(B.token))).status, 404);
        assert.equal((await request(app).delete(`/caixa/lancamentos/${lancA}`).set(auth(B.token))).status, 404);
        const l = await request(app).get('/caixa/lancamentos').set(auth(B.token));
        assert.equal(l.body.meta.total, 0);
        const [[row]] = await pool.query('SELECT valor FROM caixa_lancamentos WHERE id = ?', [lancA]);
        assert.equal(Number(row.valor), 80);
    });
});

describe('Dízimo com destino Caixa', () => {
    let dizimoId;
    const dizimo = (extra = {}) => ({
        membroId: null, membroNome: 'Visitante Teste', valor: '30,00', competencia: P1.comp,
        tipo: 'oferta', dataLancamento: `${P1.iso}-03`, destino: 'caixa', ...extra
    });
    const ligado = async () => {
        const [rows] = await pool.query("SELECT * FROM caixa_lancamentos WHERE origem = 'dizimo' AND origem_id = ?", [dizimoId]);
        return rows[0];
    };

    test('entra no caixa como crédito com a conta do tipo de receita', async () => {
        const r = await request(app).post('/dizimos').set(auth(A.token)).send(dizimo());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        dizimoId = r.body.id;
        const l = await ligado();
        assert.ok(l, 'lançamento no caixa');
        assert.equal(String(l.tipo).toUpperCase(), 'ENTRADA');
        assert.equal(Number(l.valor), 30);
        assert.match(l.historico, /Oferta - Visitante Teste/);
        assert.match(l.conta_contabil, /4\.01\.02\.02/);
        assert.equal(Number(l.igreja_id), A.igrejaId);
        assert.equal((await estado(A.token)).creditos, 30);
    });

    test('não pode ser alterado nem excluído pelo caixa', async () => {
        const l = await ligado();
        const e = await request(app).put(`/caixa/lancamentos/${l.id}`).set(auth(A.token)).send(lanc({ data: `${P1.iso}-04` }));
        assert.equal(e.status, 409);
        const d = await request(app).delete(`/caixa/lancamentos/${l.id}`).set(auth(A.token));
        assert.equal(d.status, 409);
    });

    test('editar o valor do dízimo atualiza o caixa', async () => {
        const r = await request(app).put(`/dizimos/${dizimoId}`).set(auth(A.token)).send(dizimo({ valor: '45,00' }));
        assert.equal(r.status, 200);
        assert.equal(Number((await ligado()).valor), 45);
    });

    test('mudar o destino para banco tira do caixa', async () => {
        const r = await request(app).put(`/dizimos/${dizimoId}`).set(auth(A.token)).send(dizimo({ destino: `banco:${bancoA}` }));
        assert.equal(r.status, 200);
        assert.equal(await ligado(), undefined);
    });

    test('excluir o dízimo tira do caixa', async () => {
        await request(app).put(`/dizimos/${dizimoId}`).set(auth(A.token)).send(dizimo());
        assert.ok(await ligado());
        const d = await request(app).delete(`/dizimos/${dizimoId}`).set(auth(A.token));
        assert.equal(d.status, 200);
        assert.equal(await ligado(), undefined);
    });
});

describe('Contas sugeridas', () => {
    test('traz receitas dos tipos de receita e despesas comuns', async () => {
        const r = await request(app).get('/caixa/contas-sugeridas').set(auth(A.token));
        assert.equal(r.status, 200);
        const rotulos = r.body.items.map((i) => i.rotulo);
        assert.ok(rotulos.includes('4.01.01.01 - Dízimo de Membros'), rotulos.slice(0, 5).join(' | '));
        assert.ok(rotulos.includes('3.01.03 - Energia elétrica'));
        assert.ok(r.body.items.every((i) => ['receita', 'despesa'].includes(i.natureza)));
    });
});
