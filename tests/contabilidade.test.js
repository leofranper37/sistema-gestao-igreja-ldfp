'use strict';
/**
 * Contabilidade: plano de contas padrão, lançamentos (manuais + automáticos da Tesouraria),
 * balancete de abertura, relatórios fechando (balanço/DRE), encerramento do exercício com trava
 * de período e isolamento entre igrejas.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-contab-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'contabil-test-secret-32-chars!!!!!!!';
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

const hoje = new Date();
const p2 = (n) => String(n).padStart(2, '0');
const ANO = hoje.getFullYear();
const MES = `${ANO}-${p2(hoje.getMonth() + 1)}`;
const COMP = `${p2(hoje.getMonth() + 1)}/${ANO}`;
const DIA = (d) => `${MES}-${p2(d)}`;
const HOJE = DIA(hoje.getDate());

let A, B, banco, bancoRotulo;

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@contab.test', 'SenhaSegura1!', 'Igreja Contábil A');
    B = await register('Admin B', 'b@contab.test', 'SenhaSegura2!', 'Igreja Contábil B');
});

describe('Plano de contas', () => {
    test('plano padrão criado com grupos e contas analíticas', async () => {
        const r = await request(app).get('/contabilidade/plano-contas').set(auth(A.token));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const por = new Map(r.body.items.map((c) => [c.codigo, c]));
        assert.equal(por.get('1').tipo, 'S');
        assert.equal(por.get('1.01.01').nome, 'Caixa');
        assert.equal(por.get('1.01.01').tipo, 'A');
        assert.equal(por.get('1.01.01').tesouraria, 'caixa');
        assert.equal(por.get('4.01.01.01').natureza, 'receita');
        assert.equal(por.get('2.03.02').natureza, 'passivo');
        assert.ok(por.get('1.01.02').temFilhos === false);
    });

    test('criar subconta, regras de exclusão', async () => {
        let r = await request(app).post('/contabilidade/plano-contas').set(auth(A.token)).send({ pai: '1.02.01', nome: 'Placas solares' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.codigo, '1.02.01.08');
        const nova = r.body.id;
        r = await request(app).post('/contabilidade/plano-contas').set(auth(A.token)).send({ pai: '1.01.01', nome: 'Sub do caixa' });
        assert.equal(r.status, 400, 'analítica não aceita subconta');
        r = await request(app).post('/contabilidade/plano-contas').set(auth(A.token)).send({ pai: '1.02.01', codigo: '1.02.01.08', nome: 'Duplicada' });
        assert.equal(r.status, 409);

        const plano = (await request(app).get('/contabilidade/plano-contas').set(auth(A.token))).body.items;
        const sistema = plano.find((c) => c.codigo === '3.01.01');
        assert.equal((await request(app).delete(`/contabilidade/plano-contas/${sistema.id}`).set(auth(A.token))).status, 409);
        r = await request(app).put(`/contabilidade/plano-contas/${nova}`).set(auth(A.token)).send({ nome: 'Placas solares do templo' });
        assert.equal(r.status, 200);
        assert.equal((await request(app).delete(`/contabilidade/plano-contas/${nova}`).set(auth(A.token))).status, 200);
    });
});

describe('Lançamentos contábeis', () => {
    test('Tesouraria vira lançamento contábil automaticamente (sem duplicar transferências)', async () => {
        await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token)).send({ competencia: COMP, saldoInicial: '500' });
        const c = await request(app).post('/banco/contas').set(auth(A.token)).send({
            tipo: 'corrente', banco: 'Banco do Brasil', bancoCodigo: '001', nome: 'BB Movimento', agencia: '1', conta: '2', digito: '3',
            saldoInicial: '1000', saldoTipo: 'credito', saldoData: `${MES}-01`
        });
        banco = c.body.id;
        bancoRotulo = (await request(app).get(`/banco/contas/${banco}`).set(auth(A.token))).body.conta_contabil;
        assert.match(bancoRotulo, /^1\.01\.02\.01 - /);
        let r = await request(app).post('/caixa/lancamentos').set(auth(A.token))
            .send({ data: DIA(1), historico: 'Dízimos do culto', valor: '200', tipo: 'ENTRADA', contaContabil: '4.01.01.01 - Dízimo de Membros' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post(`/banco/contas/${banco}/lancamentos`).set(auth(A.token))
            .send({ dataLancamento: DIA(1), descricao: 'Conta de luz', tipo: 'saida', valor: '80', contaContabil: '3.01.03 - Energia elétrica' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post('/banco/transferencias').set(auth(A.token)).send({ origem: 'caixa', destino: `banco:${banco}`, valor: '100', data: DIA(1) });
        assert.equal(r.status, 201, JSON.stringify(r.body));

        const l = (await request(app).get('/contabilidade/lancamentos').set(auth(A.token)).query({ mes: MES })).body;
        assert.equal(l.items.length, 3, JSON.stringify(l.items));
        const dizimo = l.items.find((x) => x.historico === 'Dízimos do culto');
        assert.equal(dizimo.debito, '1.01.01 - Caixa');
        assert.equal(dizimo.credito, '4.01.01.01 - Dízimo de Membros');
        const luz = l.items.find((x) => x.historico === 'Conta de luz');
        assert.equal(luz.debito, '3.01.03 - Energia elétrica');
        assert.equal(luz.credito, bancoRotulo);
        const transf = l.items.filter((x) => x.valor === 100);
        assert.equal(transf.length, 1, 'transferência aparece uma vez');
        assert.equal(transf[0].debito, bancoRotulo);
        assert.equal(transf[0].credito, '1.01.01 - Caixa');
    });

    test('lançamento manual: regras de conta', async () => {
        const novo = (extra) => request(app).post('/contabilidade/lancamentos').set(auth(A.token)).send({
            dataLancamento: DIA(1), contaDebito: '1.02.01.03 - Móveis e utensílios', contaCredito: '2.01.01.01 - Fornecedores a pagar',
            historico: 'Compra de cadeiras a prazo', valor: '1.500,00', documento: 'NF 991', movimentoCC: 'D', ...extra
        });
        let r = await novo();
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const id = r.body.id;
        assert.equal((await novo({ contaDebito: '1.01.01 - Caixa' })).status, 400, 'caixa é da Tesouraria');
        assert.equal((await novo({ contaDebito: bancoRotulo })).status, 400, 'banco é da Tesouraria');
        assert.equal((await novo({ contaDebito: '1.02.01 - Imobilizado' })).status, 400, 'sintética não');
        assert.equal((await novo({ contaCredito: '1.02.01.03 - Móveis e utensílios' })).status, 400, 'mesma conta');
        assert.equal((await novo({ contaDebito: '9.9 - Inexistente' })).status, 400);

        r = await request(app).get(`/contabilidade/lancamentos/${id}`).set(auth(A.token));
        assert.equal(r.body.valor, 1500);
        assert.equal(r.body.documento, 'NF 991');
        r = await request(app).put(`/contabilidade/lancamentos/${id}`).set(auth(A.token)).send({
            dataLancamento: DIA(1), contaDebito: '1.02.01.03', contaCredito: '2.01.01.01', historico: 'Compra de cadeiras a prazo', valor: '1500'
        });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const l = (await request(app).get('/contabilidade/lancamentos').set(auth(A.token)).query({ mes: MES, busca: 'cadeiras' })).body;
        assert.equal(l.items.length, 1);
        assert.equal(l.items[0].fonte, 'manual');
        assert.equal(l.items[0].debito, '1.02.01.03 - Móveis e utensílios');
    });
});

describe('Balancete de abertura e relatórios', () => {
    test('saldos da Tesouraria + manuais, ajuste do resultado acumulado', async () => {
        let b = (await request(app).get('/contabilidade/balancete-abertura').set(auth(A.token))).body;
        const caixa = b.ativo.find((x) => x.codigo === '1.01.01');
        assert.equal(caixa.saldo, 500);
        assert.equal(caixa.tesouraria, 'Caixa');
        assert.equal(b.totalAtivo, 1500);
        assert.equal(b.dataAbertura, `${MES}-01`);

        let r = await request(app).put('/contabilidade/balancete-abertura').set(auth(A.token)).send({ conta: '1.02.01.02 - Edificações e templos', saldo: '50.000,00' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).put('/contabilidade/balancete-abertura').set(auth(A.token)).send({ conta: '1.01.01', saldo: '10' });
        assert.equal(r.status, 409, 'saldo do caixa vem da Tesouraria');
        b = (await request(app).get('/contabilidade/balancete-abertura').set(auth(A.token))).body;
        assert.equal(b.totalAtivo, 51500);
        assert.equal(b.diferenca, 51500);

        r = await request(app).post('/contabilidade/balancete-abertura/ajustar-resultado').set(auth(A.token));
        assert.equal(r.status, 200);
        assert.equal(r.body.valor, 51500);
        b = (await request(app).get('/contabilidade/balancete-abertura').set(auth(A.token))).body;
        assert.equal(b.diferenca, 0);
    });

    test('balanço fecha e DRE mostra o resultado', async () => {
        const bal = (await request(app).get('/api/relatorios/contabil/balanco').set(auth(A.token)).query({ data: HOJE })).body;
        // caixa 600 + banco 1020 + edificações 50.000 + móveis 1.500
        assert.equal(bal.ativo.total, 53120, JSON.stringify(bal.ativo));
        assert.equal(bal.diferenca, 0, JSON.stringify(bal));
        const dre = (await request(app).get('/api/relatorios/contabil/dre').set(auth(A.token)).query({ inicio: `${ANO}-01-01`, fim: `${ANO}-12-31` })).body;
        assert.equal(dre.receitas.total, 200);
        assert.equal(dre.despesas.total, 80);
        assert.equal(dre.resultado, 120);
    });
});

describe('Isolamento', () => {
    test('Igreja B não vê nem altera a contabilidade da A', async () => {
        const lb = (await request(app).get('/contabilidade/lancamentos').set(auth(B.token)).query({ mes: MES })).body;
        assert.equal(lb.items.length, 0);
        const la = (await request(app).get('/contabilidade/lancamentos').set(auth(A.token)).query({ mes: MES, busca: 'cadeiras' })).body.items[0];
        assert.equal((await request(app).get(`/contabilidade/lancamentos/${la.fonteId}`).set(auth(B.token))).status, 404);
        assert.equal((await request(app).delete(`/contabilidade/lancamentos/${la.fonteId}`).set(auth(B.token))).status, 404);
        const bb = (await request(app).get('/contabilidade/balancete-abertura').set(auth(B.token))).body;
        assert.equal(bb.totalAtivo, 0);
        const planoA = (await request(app).get('/contabilidade/plano-contas').set(auth(A.token))).body.items;
        const contaA = planoA.find((c) => c.codigo === '3.01.01');
        assert.equal((await request(app).put(`/contabilidade/plano-contas/${contaA.id}`).set(auth(B.token)).send({ nome: 'Hack' })).status, 404);
    });
});

describe('Encerramento do exercício', () => {
    test('encerra, trava o período e mantém os relatórios corretos; reabrir destrava', async () => {
        let e = (await request(app).get('/contabilidade/encerramento').set(auth(A.token))).body;
        assert.equal(e.ultimoExercicioFechado, null);
        assert.equal(e.anoEncerramento, ANO);
        assert.equal(e.previa.resultado, 120);

        assert.equal((await request(app).post('/contabilidade/encerramento').set(auth(A.token)).send({ ano: ANO + 1 })).status, 400);
        assert.equal((await request(app).post('/contabilidade/encerramento').set(auth(A.token)).send({ ano: ANO, semMovimento: true })).status, 400);
        let r = await request(app).post('/contabilidade/encerramento').set(auth(A.token)).send({ ano: ANO });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.resultado, 120);
        assert.equal(r.body.lancamentos, 3);

        e = (await request(app).get('/contabilidade/encerramento').set(auth(A.token))).body;
        assert.equal(e.ultimoExercicioFechado, ANO);
        assert.equal(e.historico[0].resultado, 120);

        // período travado em todo lugar
        r = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send({ data: DIA(1), historico: 'x', valor: '1', tipo: 'ENTRADA', contaContabil: '4.09.99 - Outras receitas' });
        assert.equal(r.status, 409, JSON.stringify(r.body));
        r = await request(app).post(`/banco/contas/${banco}/lancamentos`).set(auth(A.token)).send({ dataLancamento: DIA(1), descricao: 'x', tipo: 'saida', valor: '1', contaContabil: '3.09.99 - Outras despesas' });
        assert.equal(r.status, 409, JSON.stringify(r.body));
        r = await request(app).post('/contabilidade/lancamentos').set(auth(A.token)).send({ dataLancamento: DIA(1), contaDebito: '1.02.01.05', contaCredito: '2.01.04.01', historico: 'Compra de veículo', valor: '1' });
        assert.equal(r.status, 409);
        r = await request(app).put('/contabilidade/balancete-abertura').set(auth(A.token)).send({ conta: '1.02.01.01', saldo: '1' });
        assert.equal(r.status, 409);
        const lista = (await request(app).get('/contabilidade/lancamentos').set(auth(A.token)).query({ mes: MES })).body;
        assert.ok(lista.items.every((x) => x.bloqueado));
        const dez = (await request(app).get('/contabilidade/lancamentos').set(auth(A.token)).query({ mes: ANO + '-12' })).body;
        assert.equal(dez.items.filter((x) => x.fonte === 'encerramento').length, 3);

        // relatórios: balanço segue fechando; DRE do ano não zera por causa do encerramento
        const bal = (await request(app).get('/api/relatorios/contabil/balanco').set(auth(A.token)).query({ data: `${ANO}-12-31` })).body;
        assert.equal(bal.diferenca, 0, JSON.stringify(bal));
        const dre = (await request(app).get('/api/relatorios/contabil/dre').set(auth(A.token)).query({ inicio: `${ANO}-01-01`, fim: `${ANO}-12-31` })).body;
        assert.equal(dre.resultado, 120);

        assert.equal((await request(app).post('/contabilidade/encerramento/reabrir').set(auth(B.token)).send({ ano: ANO })).status, 400, 'B não tem o que reabrir');
        r = await request(app).post('/contabilidade/encerramento/reabrir').set(auth(A.token)).send({ ano: ANO });
        assert.equal(r.status, 200);
        r = await request(app).post('/caixa/lancamentos').set(auth(A.token)).send({ data: DIA(1), historico: 'Oferta', valor: '5', tipo: 'ENTRADA', contaContabil: '4.09.99 - Outras receitas' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
    });
});
