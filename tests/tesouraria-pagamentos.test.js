'use strict';
/**
 * Tesouraria — Contas a Pagar com pagamento pelo caixa/banco, transferências reais entre
 * caixa e contas, links de pagamento com recebimento lançado, relatórios sem contar em dobro
 * e isolamento entre igrejas.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-pagamentos-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'pagamentos-test-secret-32-chars!!!!!';
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
        observacao TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS payment_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, descricao TEXT NOT NULL,
        valor REAL NOT NULL, provider TEXT, payment_method TEXT, status TEXT NOT NULL DEFAULT 'pendente',
        reference_code TEXT, url TEXT, status_detail TEXT, paid_at TEXT, created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP)`,
    `CREATE TABLE IF NOT EXISTS recibos (
        id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, numero INTEGER NOT NULL,
        favorecido TEXT NOT NULL, referente TEXT NOT NULL, valor REAL NOT NULL DEFAULT 0, data_recibo TEXT NOT NULL,
        observacao TEXT, created_by INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE (igreja_id, numero))`
];

const hoje = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const MES = `${hoje.getFullYear()}-${p2(hoje.getMonth() + 1)}`;
const COMP = `${p2(hoje.getMonth() + 1)}/${hoje.getFullYear()}`;
const DIA = (d) => `${MES}-${p2(d)}`;
const ANO = hoje.getFullYear();

let A, B, bancoA, poupA, bancoB;

const conta = (extra = {}) => ({
    descricao: 'Conta de luz', fornecedor: 'Energisa', valor: '230,50', vencimento: DIA(10),
    categoria: '3.01.03 - Energia elétrica', ...extra
});
const caixaLanc = async (origem, id) => (await pool.query('SELECT * FROM caixa_lancamentos WHERE origem = ? AND origem_id = ?', [origem, id]))[0][0];
const bancoLanc = async (origem, id) => (await pool.query('SELECT * FROM banco_lancamentos WHERE origem = ? AND origem_id = ?', [origem, id]))[0][0];

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@pag.test', 'SenhaSegura1!', 'Igreja Pag A');
    B = await register('Admin B', 'b@pag.test', 'SenhaSegura2!', 'Igreja Pag B');
    const nova = (t, nome, tipo = 'corrente') => request(app).post('/banco/contas').set(auth(t)).send({
        tipo, banco: 'Banco do Brasil', bancoCodigo: '001', nome, agencia: '1', conta: '2', digito: '3',
        saldoInicial: '1000', saldoTipo: 'credito', saldoData: `${MES}-01`
    });
    bancoA = (await nova(A.token, 'BB Movimento')).body.id;
    poupA = (await nova(A.token, 'BB Poupança', 'aplicacao')).body.id;
    bancoB = (await nova(B.token, 'Conta B')).body.id;
});

describe('Contas a Pagar com pagamento', () => {
    let id;
    test('cria, busca e edita', async () => {
        let r = await request(app).post('/contas-pagar').set(auth(A.token)).send(conta());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        id = r.body.id;
        r = await request(app).put(`/contas-pagar/${id}`).set(auth(A.token)).send(conta({ valor: '240,00' }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).get(`/contas-pagar/${id}`).set(auth(A.token));
        assert.equal(r.body.valor, 240);
        assert.equal(r.body.vencimento, DIA(10));
    });

    test('pagar pelo caixa exige o caixa iniciado', async () => {
        const r = await request(app).post(`/contas-pagar/${id}/pagar`).set(auth(A.token)).send({ dataPagamento: DIA(5), pagoCom: 'caixa' });
        assert.equal(r.status, 409, JSON.stringify(r.body));
    });

    test('pagar pelo caixa lança a saída e trava a conta', async () => {
        let r = await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token)).send({ competencia: COMP, saldoInicial: '500' });
        assert.equal(r.status, 200);
        r = await request(app).post(`/contas-pagar/${id}/pagar`).set(auth(A.token)).send({ dataPagamento: DIA(5), pagoCom: 'caixa' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const l = await caixaLanc('conta_pagar', id);
        assert.ok(l);
        assert.equal(String(l.tipo).toUpperCase(), 'SAIDA');
        assert.equal(Number(l.valor), 240);
        assert.equal(l.conta_contabil, '3.01.03 - Energia elétrica');
        assert.match(l.historico, /Conta de luz - Energisa/);
        const c = (await request(app).get(`/contas-pagar/${id}`).set(auth(A.token))).body;
        assert.equal(c.status, 'pago');
        assert.equal(c.pago_com, 'caixa');
        assert.equal((await request(app).get('/caixa/competencia').set(auth(A.token))).body.saldoAtual, 260);

        assert.equal((await request(app).put(`/contas-pagar/${id}`).set(auth(A.token)).send(conta())).status, 409);
        assert.equal((await request(app).delete(`/contas-pagar/${id}`).set(auth(A.token))).status, 409);
        assert.equal((await request(app).delete(`/caixa/lancamentos/${l.id}`).set(auth(A.token))).status, 409);
        assert.equal((await request(app).post(`/contas-pagar/${id}/pagar`).set(auth(A.token)).send({ dataPagamento: DIA(5), pagoCom: 'caixa' })).status, 409);
    });

    test('estornar tira do caixa e reabre a conta', async () => {
        const r = await request(app).post(`/contas-pagar/${id}/estornar`).set(auth(A.token));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(await caixaLanc('conta_pagar', id), undefined);
        const c = (await request(app).get(`/contas-pagar/${id}`).set(auth(A.token))).body;
        assert.notEqual(c.status, 'pago');
        assert.equal(c.pago_com, null);
    });

    test('pagar pela conta bancária', async () => {
        const r = await request(app).post(`/contas-pagar/${id}/pagar`).set(auth(A.token)).send({ dataPagamento: DIA(6), pagoCom: `banco:${bancoA}` });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const l = await bancoLanc('conta_pagar', id);
        assert.equal(Number(l.conta_id), bancoA);
        assert.equal(l.tipo, 'saida');
        assert.equal(await caixaLanc('conta_pagar', id), undefined);
    });

    test('destinos: caixa + contas', async () => {
        const r = await request(app).get('/tesouraria/destinos').set(auth(A.token));
        assert.equal(r.status, 200);
        const v = r.body.items.map((i) => i.valor);
        assert.deepEqual(v.slice(0, 1), ['caixa']);
        assert.ok(v.includes(`banco:${bancoA}`));
    });
});

describe('Transferências reais', () => {
    test('caixa → banco lança nas duas pontas', async () => {
        const r = await request(app).post('/banco/transferencias').set(auth(A.token))
            .send({ origem: 'caixa', destino: `banco:${bancoA}`, valor: '100,00', data: DIA(7) });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.fonte, 'caixa');
        const e = await bancoLanc('caixa', r.body.id);
        assert.equal(Number(e.conta_id), bancoA);
        assert.equal(e.tipo, 'entrada');
    });

    test('banco → aplicação e listagem do mês', async () => {
        const r = await request(app).post('/banco/transferencias').set(auth(A.token))
            .send({ origem: `banco:${bancoA}`, destino: `banco:${poupA}`, valor: '300', data: DIA(8), descricao: 'Reserva' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const l = (await request(app).get('/banco/transferencias').set(auth(A.token)).query({ mes: MES })).body.items;
        assert.equal(l.length, 2);
        assert.equal(l[0].descricao, 'Reserva');
        assert.equal(l[0].de.nome, 'BB Movimento');
        assert.equal(l[0].para.nome, 'BB Poupança');
        assert.equal(l[1].de.nome, 'Caixa');
        assert.equal(l[1].para.nome, 'BB Movimento');
    });

    test('origem igual ao destino e dados inválidos são recusados', async () => {
        let r = await request(app).post('/banco/transferencias').set(auth(A.token)).send({ origem: 'caixa', destino: 'caixa', valor: '1', data: DIA(7) });
        assert.equal(r.status, 400);
        r = await request(app).post('/banco/transferencias').set(auth(A.token)).send({ origem: 'xx', destino: 'caixa', valor: '1', data: DIA(7) });
        assert.equal(r.status, 400);
    });
});

describe('Links de pagamento', () => {
    let link;
    test('confirmar recebimento lança a entrada no banco; desfazer tira', async () => {
        let r = await request(app).post('/pagamentos/links').set(auth(A.token)).send({ descricao: 'Inscrição retiro', valor: '80', provider: 'pix', pixKey: 'chave@igreja.com' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        link = r.body.id;
        r = await request(app).put(`/pagamentos/links/${link}/pago`).set(auth(A.token)).send({ destino: `banco:${bancoA}`, data: DIA(9) });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const l = await bancoLanc('link_pagamento', link);
        assert.equal(l.tipo, 'entrada');
        assert.equal(Number(l.valor), 80);
        r = await request(app).put(`/pagamentos/links/${link}/pendente`).set(auth(A.token));
        assert.equal(r.status, 200);
        assert.equal(await bancoLanc('link_pagamento', link), undefined);
    });
});

describe('Relatórios sem contar em dobro', () => {
    test('anual: transferências não viram receita/despesa; conta paga conta uma vez', async () => {
        const r = await request(app).get('/api/relatorios/tesouraria/anual').set(auth(A.token)).query({ ano: ANO });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        // única despesa real: conta de luz 240 paga pelo banco; nenhuma receita real
        assert.equal(r.body.totais.despesa, 240);
        assert.equal(r.body.totais.receita, 0);
    });
});

describe('Isolamento', () => {
    test('Igreja B não paga conta da A, nem usa banco da A, nem vê transferências/links', async () => {
        const id = (await request(app).post('/contas-pagar').set(auth(A.token)).send(conta({ descricao: 'Água' }))).body.id;
        let r = await request(app).post(`/contas-pagar/${id}/pagar`).set(auth(B.token)).send({ dataPagamento: DIA(5), pagoCom: `banco:${bancoB}` });
        assert.equal(r.status, 404);
        r = await request(app).get(`/contas-pagar/${id}`).set(auth(B.token));
        assert.equal(r.status, 404);

        const idB = (await request(app).post('/contas-pagar').set(auth(B.token)).send(conta())).body.id;
        r = await request(app).post(`/contas-pagar/${idB}/pagar`).set(auth(B.token)).send({ dataPagamento: DIA(5), pagoCom: `banco:${bancoA}` });
        assert.equal(r.status, 400, 'banco de outra igreja não pode ser usado');

        r = await request(app).post('/banco/transferencias').set(auth(B.token)).send({ origem: `banco:${bancoB}`, destino: `banco:${bancoA}`, valor: '1', data: DIA(7) });
        assert.equal(r.status, 400);
        assert.equal((await request(app).get('/banco/transferencias').set(auth(B.token))).body.items.length, 0);

        const links = (await request(app).get('/pagamentos/links').set(auth(A.token))).body;
        r = await request(app).put(`/pagamentos/links/${links[0].id}/pago`).set(auth(B.token)).send({ destino: `banco:${bancoB}`, data: DIA(9) });
        assert.equal(r.status, 404);
        const destB = (await request(app).get('/tesouraria/destinos').set(auth(B.token))).body.items.map((i) => i.rotulo);
        assert.ok(!destB.includes('BB Movimento'));
    });
});

describe('Recibos', () => {
    test('numeração por igreja, nome da igreja no recibo e isolamento', async () => {
        const novo = (t, extra = {}) => request(app).post('/api/recibos').set(auth(t))
            .send({ favorecido: 'Pr. Visitante', referente: 'Pregação', valor: '350,00', data_recibo: DIA(4), ...extra });
        let r = await novo(A.token);
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.numero, 1);
        const idA = r.body.id;
        assert.equal((await novo(A.token)).body.numero, 2);
        assert.equal((await novo(B.token)).body.numero, 1, 'cada igreja tem a própria numeração');
        assert.equal((await novo(A.token, { valor: '0' })).status, 400);

        r = await request(app).get(`/api/recibos/${idA}`).set(auth(A.token));
        assert.equal(r.status, 200);
        assert.equal(r.body.igreja_nome, 'Igreja Pag A');
        assert.equal(Number(r.body.valor), 350);

        assert.equal((await request(app).get(`/api/recibos/${idA}`).set(auth(B.token))).status, 404);
        assert.equal((await request(app).delete(`/api/recibos/${idA}`).set(auth(B.token))).status, 404);
        assert.equal((await request(app).get('/api/recibos').set(auth(B.token))).body.total, 1);
        assert.equal((await request(app).delete(`/api/recibos/${idA}`).set(auth(A.token))).status, 200);
    });
});
