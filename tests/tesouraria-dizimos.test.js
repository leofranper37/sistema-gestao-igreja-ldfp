'use strict';
/**
 * Nova Tesouraria — Dízimos: lançamento com data/destino/tipo de receita, edição,
 * resumo do mês/ano, busca de membro, destinos e tipos de receita — sempre isolados por igreja.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-dizimos-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'dizimos-novo-test-secret-32-chars!!';
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

// No SQLite a 1ª DDL do bancoModel (BIGSERIAL) é aceita sem criar o id — usa a versão SQLite
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

let A, B, membroA, membroB, bancoA, bancoB, dizimoA;

async function membro(igrejaId, nome) {
    await pool.query('INSERT INTO membros (igreja_id, nome) VALUES (?, ?)', [igrejaId, nome]);
    const [r] = await pool.query('SELECT id FROM membros WHERE igreja_id = ? AND nome = ?', [igrejaId, nome]);
    return r[0].id;
}

async function conta(token, nome) {
    const r = await request(app).post('/banco/contas').set(auth(token)).send({ nome, tipo: 'corrente', saldoInicial: 0 });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return r.body.id;
}

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@dizimos.test', 'SenhaSegura1!', 'Igreja Dizimos A');
    B = await register('Admin B', 'b@dizimos.test', 'SenhaSegura2!', 'Igreja Dizimos B');
    membroA = await membro(A.igrejaId, 'Maria Dizimista', '123');
    membroB = await membro(B.igrejaId, 'Joao Outra Igreja', '777');
    bancoA = await conta(A.token, 'Conta A');
    bancoB = await conta(B.token, 'Conta B');
});

const base = (extra = {}) => ({
    membroId: membroA, membroNome: 'Maria Dizimista', valor: '150,00', competencia: '11/2026',
    tipo: 'dizimo', dataLancamento: '2026-11-16', destino: 'caixa', ...extra
});

describe('Lançamento de dízimo', () => {
    test('cria com data, destino e tipo de receita automático', async () => {
        const r = await request(app).post('/dizimos').set(auth(A.token)).send(base());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        dizimoA = r.body.id;

        const g = await request(app).get(`/dizimos/${dizimoA}`).set(auth(A.token));
        assert.equal(g.status, 200);
        assert.equal(g.body.destino, 'caixa');
        assert.match(String(g.body.data_lancamento), /^2026-11-16/);
        assert.match(String(g.body.tipo_receita_id), /dizimos$/, 'membro + dízimo → tipo "Dízimos"');
    });

    test('destino em conta bancária da própria igreja', async () => {
        const r = await request(app).post('/dizimos').set(auth(A.token))
            .send(base({ tipo: 'oferta', valor: '50', destino: `banco:${bancoA}` }));
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const g = await request(app).get(`/dizimos/${r.body.id}`).set(auth(A.token));
        assert.equal(g.body.destino, 'banco');
        assert.equal(Number(g.body.destino_banco_id), bancoA);
        assert.match(String(g.body.tipo_receita_id), /ofertas$/);
    });

    test('recusa membro de outra igreja', async () => {
        const r = await request(app).post('/dizimos').set(auth(A.token)).send(base({ membroId: membroB }));
        assert.equal(r.status, 400);
    });

    test('recusa conta bancária de outra igreja como destino', async () => {
        const r = await request(app).post('/dizimos').set(auth(A.token)).send(base({ destino: `banco:${bancoB}` }));
        assert.equal(r.status, 400);
    });

    test('edita o lançamento', async () => {
        const r = await request(app).put(`/dizimos/${dizimoA}`).set(auth(A.token)).send(base({ valor: '200,00' }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const g = await request(app).get(`/dizimos/${dizimoA}`).set(auth(A.token));
        assert.equal(Number(g.body.valor), 200);
    });

    test('outra igreja não abre nem edita o lançamento', async () => {
        const g = await request(app).get(`/dizimos/${dizimoA}`).set(auth(B.token));
        assert.equal(g.status, 404);
        const p = await request(app).put(`/dizimos/${dizimoA}`).set(auth(B.token))
            .send({ membroNome: 'Hack', valor: '1', competencia: '11/2026' });
        assert.equal(p.status, 404);
        const ok = await request(app).get(`/dizimos/${dizimoA}`).set(auth(A.token));
        assert.equal(Number(ok.body.valor), 200, 'valor de A intacto');
    });
});

describe('Resumo, busca e destinos', () => {
    test('resumo do mês e do ano', async () => {
        const r = await request(app).get('/dizimos/resumo?competencia=11/2026').set(auth(A.token));
        assert.equal(r.status, 200);
        assert.equal(r.body.totalMes, 250);
        assert.equal(r.body.lancamentosMes, 2);
        assert.equal(r.body.totalAno, 250);
        const b = await request(app).get('/dizimos/resumo?competencia=11/2026').set(auth(B.token));
        assert.equal(b.body.totalMes, 0, 'B não soma os lançamentos de A');
    });

    test('busca membro por nome e por nº da ficha, só da própria igreja', async () => {
        const n = await request(app).get('/dizimos/membros?q=Maria').set(auth(A.token));
        assert.equal(n.body.items.length, 1);
        const f = await request(app).get('/dizimos/membros?q=' + membroA).set(auth(A.token));
        assert.equal(f.body.items[0].id, membroA);
        const outro = await request(app).get('/dizimos/membros?q=Joao').set(auth(A.token));
        const fichaB = await request(app).get('/dizimos/membros?q=' + membroB).set(auth(A.token));
        assert.equal(fichaB.body.items.length, 0, 'nº da ficha de outra igreja não aparece');
        assert.equal(outro.body.items.length, 0);
    });

    test('destinos: caixa + só as contas da igreja', async () => {
        const r = await request(app).get('/dizimos/destinos').set(auth(A.token));
        const valores = r.body.items.map((i) => i.valor);
        assert.ok(valores.includes('caixa'));
        assert.ok(valores.includes(`banco:${bancoA}`));
        assert.ok(!valores.includes(`banco:${bancoB}`));
    });
});

describe('Tipos de receita', () => {
    test('lista os tipos padrão com natureza e público', async () => {
        const r = await request(app).get('/tipos-receita').set(auth(A.token));
        assert.equal(r.status, 200);
        assert.ok(r.body.items.length >= 10);
        const visit = r.body.items.find((t) => t.descricao === 'Dízimo de Visitantes');
        assert.equal(visit.natureza, 'dizimo');
        assert.equal(visit.publico, 'visitante');
    });

    test('tipo padrão: só a conta contábil muda', async () => {
        const lista = await request(app).get('/tipos-receita').set(auth(A.token));
        const diz = lista.body.items.find((t) => t.descricao === 'Dízimos');
        const r = await request(app).put(`/tipos-receita/${diz.id}`).set(auth(A.token))
            .send({ descricao: 'Nome Trocado', planoConta: '4.9.9 - Conta Própria' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const depois = (await request(app).get('/tipos-receita').set(auth(A.token))).body.items.find((t) => t.id === diz.id);
        assert.equal(depois.descricao, 'Dízimos');
        assert.equal(depois.planoConta, '4.9.9 - Conta Própria');
    });

    test('tipo personalizado com natureza e público', async () => {
        const r = await request(app).post('/tipos-receita').set(auth(A.token))
            .send({ descricao: 'Oferta de Gratidão', planoConta: '4.01.06.01 - Gratidão', natureza: 'oferta', publico: 'membro' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const b = await request(app).get('/tipos-receita').set(auth(B.token));
        assert.ok(!b.body.items.some((t) => t.descricao === 'Oferta de Gratidão'), 'B não vê tipos de A');
    });
});
