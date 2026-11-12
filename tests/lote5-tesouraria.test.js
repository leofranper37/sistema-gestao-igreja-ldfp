'use strict';
/**
 * Lote 5 — Cadastros da Tesouraria (fornecedores, centros de custo, tipos de documento)
 * + smoke dos relatórios dos Lotes 3/4.
 *
 * Garante: CRUD funciona, vínculos são gravados, e uma igreja NÃO consegue
 * ler/alterar/usar cadastros de outra (isolamento multi-tenant).
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ldfp-lote5-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lote5-test-secret-32-chars-min!!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const { initializeDatabase } = require('../src/config/db');
const app = require('../src/app');

let tokenA;
let tokenB;
const authA = () => ({ Authorization: `Bearer ${tokenA}` });
const authB = () => ({ Authorization: `Bearer ${tokenB}` });
const ano = new Date().getFullYear();
const hoje = new Date().toISOString().slice(0, 10);

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou para ${email}: ${JSON.stringify(res.body)}`);
    return res.body.token;
}

let fornecedorA;
let centroA;
let tipoDocA;

before(async () => {
    await initializeDatabase();
    tokenA = await register('Admin A', 'admin-a@lote5-test.com', 'SenhaSegura1!', 'Igreja Alfa');
    tokenB = await register('Admin B', 'admin-b@lote5-test.com', 'SenhaSegura2!', 'Igreja Beta');
});

after(() => {
    try { fs.unlinkSync(TEST_DB); } catch (_) { /* ignore */ }
});

describe('Lote 5 — cadastros da tesouraria', () => {
    test('Igreja A cria fornecedor, centro de custo e tipo de documento', async () => {
        let r = await request(app).post('/api/tesouraria/fornecedores').set(authA()).send({ nome: 'Papelaria Central', cpf_cnpj: '12.345.678/0001-90' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        fornecedorA = r.body.id;

        r = await request(app).post('/api/tesouraria/centros-custo').set(authA()).send({ codigo: '01', nome: 'Missões' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        centroA = r.body.id;

        r = await request(app).post('/api/tesouraria/tipos-documento').set(authA()).send({ nome: 'Nota Fiscal' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        tipoDocA = r.body.id;

        r = await request(app).get('/api/tesouraria/centros-custo').set(authA());
        assert.equal(r.status, 200);
        assert.equal(r.body.items.length, 1);
        assert.equal(r.body.items[0].nome, 'Missões');
    });

    test('validação: nome obrigatório e recurso inválido', async () => {
        let r = await request(app).post('/api/tesouraria/centros-custo').set(authA()).send({ codigo: '02' });
        assert.equal(r.status, 400);
        r = await request(app).get('/api/tesouraria/qualquer-coisa').set(authA());
        assert.equal(r.status, 404);
    });

    test('Igreja B não vê nem altera os cadastros da Igreja A', async () => {
        let r = await request(app).get('/api/tesouraria/centros-custo').set(authB());
        assert.equal(r.status, 200);
        assert.equal(r.body.items.length, 0);

        r = await request(app).put(`/api/tesouraria/centros-custo/${centroA}`).set(authB()).send({ nome: 'Invadido' });
        assert.equal(r.status, 404);

        r = await request(app).delete(`/api/tesouraria/fornecedores/${fornecedorA}`).set(authB());
        assert.equal(r.status, 404);

        r = await request(app).get('/api/tesouraria/centros-custo').set(authA());
        assert.equal(r.body.items[0].nome, 'Missões', 'cadastro da Igreja A não pode ter sido alterado');
    });

    test('Igreja B não consegue lançar usando centro de custo / fornecedor da Igreja A', async () => {
        let r = await request(app).post('/contas-pagar').set(authB())
            .send({ descricao: 'Tentativa', valor: 10, vencimento: hoje, centroCustoId: centroA });
        assert.equal(r.status, 400, JSON.stringify(r.body));

        r = await request(app).post('/caixa/lancamentos').set(authB())
            .send({ data: hoje, historico: 'Tentativa', valor: 10, tipo: 'SAIDA', fornecedorId: fornecedorA });
        assert.equal(r.status, 400, JSON.stringify(r.body));
    });

    test('Contas a Pagar grava os vínculos e a listagem traz os nomes', async () => {
        let r = await request(app).post('/contas-pagar').set(authA()).send({
            descricao: 'Material de missões', valor: '150,00', vencimento: hoje,
            fornecedorId: fornecedorA, centroCustoId: centroA, tipoDocumentoId: tipoDocA, numeroDocumento: '123'
        });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const id = r.body.id;

        r = await request(app).get('/contas-pagar').set(authA());
        assert.equal(r.status, 200);
        const item = r.body.items.find((x) => x.id === id);
        assert.ok(item, `conta criada deve aparecer: id=${id} lista=${JSON.stringify(r.body).slice(0, 400)}`);
        assert.equal(item.fornecedor, 'Papelaria Central', 'nome do fornecedor preenchido a partir do cadastro');
        assert.equal(item.centro_custo_nome, 'Missões');
        assert.equal(item.tipo_documento_nome, 'Nota Fiscal');
        assert.equal(item.numero_documento, '123');

        r = await request(app).patch(`/contas-pagar/${id}`).set(authA()).send({ status: 'pago', dataPagamento: hoje });
        assert.equal(r.status, 200);
    });

    test('Caixa grava centro de custo e o relatório agrupa por centro e por fornecedor', async () => {
        let r = await request(app).post('/caixa/lancamentos').set(authA())
            .send({ data: hoje, historico: 'Passagem missionário', valor: 50, tipo: 'SAIDA', centroCustoId: centroA });
        assert.equal(r.status, 201, JSON.stringify(r.body));

        r = await request(app).get('/api/relatorios/tesouraria/por-centro').set(authA()).query({ inicio: `${ano}-01-01`, fim: `${ano}-12-31` });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const missoes = r.body.grupos.find((g) => g.nome === '01 - Missões');
        assert.ok(missoes, `centro "01 - Missões" deve existir: ${JSON.stringify(r.body.grupos.map((g) => g.nome))}`);
        assert.equal(missoes.saidas, 200, 'conta paga (150) + saída do caixa (50)');

        r = await request(app).get('/api/relatorios/tesouraria/por-centro').set(authA()).query({ inicio: `${ano}-01-01`, fim: `${ano}-12-31`, agrupar: 'fornecedor' });
        assert.equal(r.status, 200);
        assert.ok(r.body.grupos.find((g) => g.nome === 'Papelaria Central' && g.saidas === 150));

        r = await request(app).get('/api/relatorios/tesouraria/por-centro').set(authB()).query({ inicio: `${ano}-01-01`, fim: `${ano}-12-31` });
        assert.equal(r.status, 200);
        assert.equal(r.body.grupos.length, 0, 'Igreja B não enxerga lançamentos da Igreja A');
    });

    test('desativar mantém o registro, mas tira da lista padrão', async () => {
        let r = await request(app).delete(`/api/tesouraria/tipos-documento/${tipoDocA}`).set(authA());
        assert.equal(r.status, 200);
        r = await request(app).get('/api/tesouraria/tipos-documento').set(authA());
        assert.equal(r.body.items.length, 0);
        r = await request(app).get('/api/tesouraria/tipos-documento').set(authA()).query({ todos: '1' });
        assert.equal(r.body.items.length, 1);
    });
});

describe('Relatórios (Lotes 3 e 4) — respondem e isolam por igreja', () => {
    const rotas = [
        ['/api/relatorios/secretaria/resumo', {}],
        ['/api/relatorios/secretaria/lista', { tipo: 'membros' }],
        ['/api/relatorios/secretaria/aniversariantes', { mes: 1 }],
        ['/api/relatorios/secretaria/grupos', {}],
        ['/api/relatorios/tesouraria/anual', { ano }],
        ['/api/relatorios/tesouraria/dizimistas', { ano }],
        ['/api/relatorios/tesouraria/movimento', { fonte: 'caixa' }],
        ['/api/relatorios/tesouraria/contas-pagar', { status: 'vencido' }],
        ['/api/relatorios/contabil/balancete', {}],
        ['/api/relatorios/contabil/balanco', {}],
        ['/api/relatorios/contabil/dre', {}],
        ['/api/relatorios/contabil/fluxo-caixa', { fonte: 'tesouraria' }],
        ['/api/relatorios/contabil/dmpl', { ano }]
    ];
    for (const [rota, q] of rotas) {
        test(`GET ${rota}`, async () => {
            const r = await request(app).get(rota).set(authA()).query(q);
            assert.equal(r.status, 200, `${rota}: ${JSON.stringify(r.body)}`);
        });
    }

    test('sem login → 401', async () => {
        const r = await request(app).get('/api/relatorios/tesouraria/anual');
        assert.equal(r.status, 401);
    });

    test('anual da Igreja A soma a despesa; Igreja B fica zerada', async () => {
        let r = await request(app).get('/api/relatorios/tesouraria/anual').set(authA()).query({ ano });
        assert.equal(r.body.totais.despesa, 200);
        r = await request(app).get('/api/relatorios/tesouraria/anual').set(authB()).query({ ano });
        assert.equal(r.body.totais.despesa, 0);
    });
});
