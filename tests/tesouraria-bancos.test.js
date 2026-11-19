'use strict';
/**
 * Nova Tesouraria — Bancos e Contas: cadastro por tipo (conta corrente, aplicação,
 * cartão de crédito) com conta contábil automática, lançamentos bancários com resumo
 * do mês, transferência entre contas / pagamento de fatura / saque e depósito no caixa
 * (outra ponta automática), dízimo com destino banco e isolamento entre igrejas.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-bancos-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'bancos-novo-test-secret-32-chars!!!!';
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

function mes(delta) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + delta);
    return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, comp: `${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}` };
}
const M1 = mes(-1), M0 = mes(0);

let A, B, cc, ap, cartao;

const contaCorrente = (extra = {}) => ({
    tipo: 'corrente', banco: 'Banco do Brasil', bancoCodigo: '001', nome: 'BB Movimento',
    agencia: '1234', conta: '56789', digito: '0', contaContabil: '',
    saldoInicial: '1.000,00', saldoTipo: 'credito', saldoData: `${M1.iso}-01`, compartilhado: false, ...extra
});
const lanc = (extra = {}) => ({
    dataLancamento: `${M0.iso}-05`, doc: '123', descricao: 'Conta de luz', valor: '100,00', tipo: 'saida',
    contaContabil: '3.01.03 - Energia elétrica', ...extra
});
const resumo = async (t, id, q = {}) =>
    (await request(app).get(`/banco/contas/${id}/lancamentos`).set(auth(t)).query({ mes: M0.iso, ...q })).body;
const espelho = async (origem, origemId) => {
    const [rows] = await pool.query('SELECT * FROM banco_lancamentos WHERE origem = ? AND origem_id = ?', [origem, origemId]);
    return rows[0];
};

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@bancos.test', 'SenhaSegura1!', 'Igreja Bancos A');
    B = await register('Admin B', 'b@bancos.test', 'SenhaSegura2!', 'Igreja Bancos B');
});

describe('Cadastro de contas por tipo', () => {
    test('conta corrente: conta contábil criada automaticamente', async () => {
        const r = await request(app).post('/banco/contas').set(auth(A.token)).send(contaCorrente());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        cc = r.body.id;
        const c = (await request(app).get(`/banco/contas/${cc}`).set(auth(A.token))).body;
        assert.equal(c.conta_contabil, '1.01.02.01 - BB Movimento');
        assert.equal(Number(c.saldo_inicial), 1000);
        assert.equal(c.banco_codigo, '001');
        assert.equal(c.digito, '0');
    });

    test('campos obrigatórios por tipo', async () => {
        let r = await request(app).post('/banco/contas').set(auth(A.token)).send(contaCorrente({ agencia: '' }));
        assert.equal(r.status, 400);
        assert.match(r.body.message || r.body.error || '', /agência/);
        r = await request(app).post('/banco/contas').set(auth(A.token))
            .send({ tipo: 'cartao', banco: 'Nubank', nome: 'Cartão', finalCartao: '123', saldoInicial: '0', saldoData: `${M1.iso}-01` });
        assert.equal(r.status, 400);
    });

    test('aplicação e cartão ganham grupos contábeis próprios; fatura é dívida', async () => {
        let r = await request(app).post('/banco/contas').set(auth(A.token))
            .send(contaCorrente({ tipo: 'aplicacao', nome: 'BB Poupança', saldoInicial: '500,00' }));
        assert.equal(r.status, 201, JSON.stringify(r.body));
        ap = r.body.id;
        r = await request(app).post('/banco/contas').set(auth(A.token)).send({
            tipo: 'cartao', banco: 'Nubank', bancoCodigo: '260', nome: 'Cartão Nubank', finalCartao: '4321',
            saldoInicial: '300,00', saldoData: `${M1.iso}-01`
        });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        cartao = r.body.id;
        const contas = (await request(app).get('/banco/contas').set(auth(A.token)).query({ saldo: 1 })).body;
        const porId = Object.fromEntries(contas.map((c) => [c.id, c]));
        assert.equal(porId[ap].conta_contabil, '1.01.03.01 - BB Poupança');
        assert.equal(porId[cartao].conta_contabil, '2.01.05.01 - Cartão Nubank');
        assert.equal(porId[cartao].final_cartao, '4321');
        assert.equal(Number(porId[cartao].saldo_atual), -300);
        assert.equal(Number(porId[ap].saldo_atual), 500);
    });

    test('saldo de abertura a débito fica negativo; conta contábil não pode repetir', async () => {
        let r = await request(app).post('/banco/contas').set(auth(A.token))
            .send(contaCorrente({ nome: 'Conta Negativa', saldoInicial: '50', saldoTipo: 'debito' }));
        assert.equal(r.status, 201);
        const c = (await request(app).get(`/banco/contas/${r.body.id}`).set(auth(A.token))).body;
        assert.equal(Number(c.saldo_inicial), -50);
        r = await request(app).post('/banco/contas').set(auth(A.token))
            .send(contaCorrente({ nome: 'Duplicada', contaContabil: '1.01.02.01 - BB Movimento' }));
        assert.equal(r.status, 409);
        await request(app).delete(`/banco/contas/${c.id}`).set(auth(A.token));
    });
});

describe('Lançamentos bancários', () => {
    let luz;
    test('data antes do saldo de abertura é recusada', async () => {
        const r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ dataLancamento: `${M1.iso.slice(0, 4) - 1}-01-10` }));
        assert.equal(r.status, 400);
    });

    test('crédito e débito entram no resumo do mês', async () => {
        let r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token)).send(lanc());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        luz = r.body.id;
        r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ descricao: 'Oferta de culto', tipo: 'entrada', valor: '250,50', contaContabil: '4.09.99 - Outras receitas' }));
        assert.equal(r.status, 201);
        r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ dataLancamento: `${M1.iso}-20`, descricao: 'Tarifa', valor: '10' }));
        assert.equal(r.status, 201);

        const x = await resumo(A.token, cc);
        assert.equal(x.resumo.saldoAnterior, 990);
        assert.equal(x.resumo.creditos, 250.5);
        assert.equal(x.resumo.debitos, 100);
        assert.equal(x.resumo.saldoAtual, 1140.5);
        assert.equal(x.items.length, 2);
        assert.equal(x.items[0].doc, '123');
        assert.equal((await resumo(A.token, cc, { periodo: 'todos' })).items.length, 3);
        assert.equal((await resumo(A.token, cc, { tipo: 'entrada' })).items.length, 1);
    });

    test('editar um lançamento manual', async () => {
        const r = await request(app).put(`/banco/lancamentos/${luz}`).set(auth(A.token)).send(lanc({ valor: '120,00' }));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal((await resumo(A.token, cc)).resumo.debitos, 120);
    });

    test('formato antigo da API continua funcionando', async () => {
        const r = await request(app).get(`/banco/contas/${cc}/lancamentos`).set(auth(A.token));
        assert.equal(r.status, 200);
        assert.ok(Array.isArray(r.body.lancamentos));
        assert.equal(r.body.saldo, 1120.5);
    });
});

describe('Outra ponta automática', () => {
    let transf;
    test('transferência para a aplicação lança a entrada lá', async () => {
        const r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ descricao: 'Aplicação mensal', valor: '200', contaContabil: '1.01.03.01 - BB Poupança' }));
        assert.equal(r.status, 201, JSON.stringify(r.body));
        transf = r.body.id;
        const e = await espelho('transferencia', transf);
        assert.ok(e, 'espelho criado');
        assert.equal(Number(e.conta_id), ap);
        assert.equal(e.tipo, 'entrada');
        assert.equal(e.conta_contabil, '1.01.02.01 - BB Movimento');
        assert.equal((await resumo(A.token, ap)).resumo.saldoAtual, 700);
    });

    test('a outra ponta não é editável; editar a origem atualiza ela', async () => {
        const e = await espelho('transferencia', transf);
        let r = await request(app).put(`/banco/lancamentos/${e.id}`).set(auth(A.token)).send(lanc());
        assert.equal(r.status, 409);
        r = await request(app).delete(`/banco/lancamentos/${e.id}`).set(auth(A.token));
        assert.equal(r.status, 409);
        r = await request(app).put(`/banco/lancamentos/${transf}`).set(auth(A.token))
            .send(lanc({ descricao: 'Aplicação mensal', valor: '250', contaContabil: '1.01.03.01 - BB Poupança' }));
        assert.equal(r.status, 200);
        assert.equal(Number((await espelho('transferencia', transf)).valor), 250);
    });

    test('mudar a conta contábil para despesa remove a outra ponta; excluir também', async () => {
        await request(app).put(`/banco/lancamentos/${transf}`).set(auth(A.token)).send(lanc({ valor: '250' }));
        assert.equal(await espelho('transferencia', transf), undefined);
        await request(app).put(`/banco/lancamentos/${transf}`).set(auth(A.token))
            .send(lanc({ valor: '250', contaContabil: '1.01.03.01 - BB Poupança' }));
        assert.ok(await espelho('transferencia', transf));
        const d = await request(app).delete(`/banco/lancamentos/${transf}`).set(auth(A.token));
        assert.equal(d.status, 200);
        assert.equal(await espelho('transferencia', transf), undefined);
    });

    test('pagamento da fatura reduz a dívida do cartão', async () => {
        const r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ descricao: 'Fatura Nubank', valor: '300', contaContabil: '2.01.05.01 - Cartão Nubank' }));
        assert.equal(r.status, 201);
        assert.equal((await resumo(A.token, cartao)).saldo, 0);
    });

    test('saque para o caixa exige o caixa iniciado e então entra no caixa', async () => {
        let r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ descricao: 'Saque', valor: '80', contaContabil: '1.01.01 - Caixa' }));
        assert.equal(r.status, 409, JSON.stringify(r.body));
        r = await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token)).send({ competencia: M0.comp, saldoInicial: '0' });
        assert.equal(r.status, 200);
        r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(A.token))
            .send(lanc({ descricao: 'Saque', valor: '80', contaContabil: '1.01.01 - Caixa' }));
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const [cx] = await pool.query("SELECT * FROM caixa_lancamentos WHERE origem = 'banco' AND origem_id = ?", [r.body.id]);
        assert.equal(cx.length, 1);
        assert.equal(String(cx[0].tipo).toUpperCase(), 'ENTRADA');
        assert.equal(Number(cx[0].valor), 80);
        const est = (await request(app).get('/caixa/competencia').set(auth(A.token))).body;
        assert.equal(est.saldoAtual, 80);
        // excluir no banco tira do caixa
        await request(app).delete(`/banco/lancamentos/${r.body.id}`).set(auth(A.token));
        const [cx2] = await pool.query("SELECT * FROM caixa_lancamentos WHERE origem = 'banco' AND origem_id = ?", [r.body.id]);
        assert.equal(cx2.length, 0);
    });

    test('depósito feito pelo caixa entra no banco', async () => {
        await request(app).post('/caixa/lancamentos').set(auth(A.token)).send({
            data: `${M0.iso}-02`, historico: 'Oferta do culto', valor: '500', tipo: 'ENTRADA', contaContabil: '4.09.99 - Outras receitas'
        });
        const r = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send({
            data: `${M0.iso}-06`, historico: 'Depósito', valor: '400', tipo: 'SAIDA', contaContabil: '1.01.02.01 - BB Movimento'
        });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const e = await espelho('caixa', r.body.id);
        assert.ok(e);
        assert.equal(Number(e.conta_id), cc);
        assert.equal(e.tipo, 'entrada');
        assert.equal(e.conta_contabil, '1.01.01 - Caixa');
        const sug = (await request(app).get('/caixa/contas-sugeridas').set(auth(A.token))).body.items;
        assert.ok(sug.find((s) => s.rotulo === '1.01.02.01 - BB Movimento' && s.natureza === 'transferencia'));
    });

    test('contas sugeridas do banco trazem caixa e as outras contas, não a própria', async () => {
        const sug = (await request(app).get('/banco/contas-sugeridas').set(auth(A.token)).query({ conta: cc })).body.items;
        const rot = sug.map((s) => s.rotulo);
        assert.ok(rot.includes('1.01.01 - Caixa'));
        assert.ok(rot.includes('1.01.03.01 - BB Poupança'));
        assert.ok(!rot.includes('1.01.02.01 - BB Movimento'));
    });

    test('conta com lançamentos não pode ser excluída', async () => {
        const r = await request(app).delete(`/banco/contas/${cc}`).set(auth(A.token));
        assert.equal(r.status, 409);
    });
});

describe('Dízimo com destino banco', () => {
    let dz;
    const dizimo = (extra = {}) => ({
        membroId: null, membroNome: 'Visitante Teste', valor: '60,00', competencia: M0.comp,
        tipo: 'oferta', dataLancamento: `${M0.iso}-07`, destino: `banco:${cc}`, ...extra
    });
    test('entra na conta como crédito; mudar para caixa tira do banco', async () => {
        let r = await request(app).post('/dizimos').set(auth(A.token)).send(dizimo());
        assert.equal(r.status, 201, JSON.stringify(r.body));
        dz = r.body.id;
        const e = await espelho('dizimo', dz);
        assert.ok(e);
        assert.equal(Number(e.conta_id), cc);
        assert.equal(e.tipo, 'entrada');
        assert.match(e.descricao, /Oferta - Visitante Teste/);
        r = await request(app).put(`/banco/lancamentos/${e.id}`).set(auth(A.token)).send(lanc());
        assert.equal(r.status, 409);
        r = await request(app).put(`/dizimos/${dz}`).set(auth(A.token)).send(dizimo({ destino: 'caixa' }));
        assert.equal(r.status, 200);
        assert.equal(await espelho('dizimo', dz), undefined);
    });
});

describe('Isolamento entre igrejas', () => {
    test('Igreja B não vê nem mexe nas contas e lançamentos da A', async () => {
        let r = await request(app).get(`/banco/contas/${cc}/lancamentos`).set(auth(B.token)).query({ mes: M0.iso });
        assert.equal(r.status, 404);
        r = await request(app).get(`/banco/contas/${cc}`).set(auth(B.token));
        assert.equal(r.status, 404);
        const [[l]] = await pool.query('SELECT id FROM banco_lancamentos WHERE conta_id = ? AND origem IS NULL LIMIT 1', [cc]);
        r = await request(app).put(`/banco/lancamentos/${l.id}`).set(auth(B.token)).send(lanc());
        assert.equal(r.status, 404);
        r = await request(app).delete(`/banco/lancamentos/${l.id}`).set(auth(B.token));
        assert.equal(r.status, 404);
        r = await request(app).post(`/banco/contas/${cc}/lancamentos`).set(auth(B.token)).send(lanc());
        assert.equal(r.status, 404);
        r = await request(app).get('/banco/contas').set(auth(B.token));
        assert.equal(r.body.length, 0);
    });

    test('conta contábil da A usada pela B não gera transferência para a A', async () => {
        let r = await request(app).post('/banco/contas').set(auth(B.token)).send(contaCorrente({ nome: 'Conta B' }));
        assert.equal(r.status, 201);
        const contaB = r.body.id;
        const c = (await request(app).get(`/banco/contas/${contaB}`).set(auth(B.token))).body;
        assert.equal(c.conta_contabil, '1.01.02.01 - Conta B', 'numeração própria de cada igreja');
        const antes = (await resumo(A.token, ap, { periodo: 'todos' })).items.length;
        r = await request(app).post(`/banco/contas/${contaB}/lancamentos`).set(auth(B.token))
            .send(lanc({ contaContabil: '1.01.03.01 - BB Poupança' }));
        assert.equal(r.status, 201);
        assert.equal(await espelho('transferencia', r.body.id), undefined);
        assert.equal((await resumo(A.token, ap, { periodo: 'todos' })).items.length, antes);
        const sug = (await request(app).get('/banco/contas-sugeridas').set(auth(B.token))).body.items.map((s) => s.rotulo);
        assert.ok(!sug.some((s) => /BB Poupança|BB Movimento|Nubank/.test(s)));
    });
});
