'use strict';
/**
 * SPED: dados da entidade, dirigentes, validação e geração da ECD (estrutura do arquivo:
 * contagens de blocos, 9900, partidas dobradas, balanço) e ficha da ECF. Isolamento entre igrejas.
 */

const os = require('os');
const path = require('path');

process.env.SQLITE_DB_PATH = path.join(os.tmpdir(), `ldfp-sped-test-${Date.now()}.sqlite`);
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'sped-test-secret-32-chars!!!!!!!!!!!';
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
const sped = require('../src/services/spedService');

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
const num = (s) => Number(String(s).replace(',', '.'));

let A, B, arquivoId, texto;

const CONFIG = {
    nome: 'Igreja SPED A', cnpj: '11.222.333/0001-81', uf: 'SP', municipio: 'São Paulo', codMun: '3550308',
    dtArq: '2010-03-15', codPlanRef: '5', formaTributacao: 'imune'
};
const ECD = { ano: ANO, numLivro: 3, finalidade: '0', sitIniPer: '0' };

before(async () => {
    await initializeDatabase();
    for (const ddl of TABELAS_SQLITE) await pool.query(ddl);
    A = await register('Admin A', 'a@sped.test', 'SenhaSegura1!', 'Igreja SPED A');
    B = await register('Admin B', 'b@sped.test', 'SenhaSegura2!', 'Igreja SPED B');
});

describe('Documentos', () => {
    test('validação de CNPJ e CPF', () => {
        assert.ok(sped.cnpjValido('11.222.333/0001-81'));
        assert.ok(!sped.cnpjValido('11.222.333/0001-82'));
        assert.ok(sped.cpfValido('529.982.247-25'));
        assert.ok(!sped.cpfValido('529.982.247-26'));
        assert.ok(!sped.cpfValido('111.111.111-11'));
    });
});

describe('Dados da entidade e dirigentes', () => {
    test('ECD não valida sem dados, contador e exercício encerrado', async () => {
        const r = await request(app).post('/contabilidade/sped/ecd/validar').set(auth(A.token)).send(ECD);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.ok, false);
        const t = r.body.erros.join(' ');
        assert.match(t, /CNPJ/);
        assert.match(t, /contador/);
        assert.match(t, /encerrado/);
        assert.equal((await request(app).post('/contabilidade/sped/ecd/gerar').set(auth(A.token)).send(ECD)).status, 400);
    });

    test('salvar dados da entidade', async () => {
        let r = await request(app).put('/contabilidade/sped/config').set(auth(A.token)).send({ ...CONFIG, cnpj: '11.222.333/0001-82' });
        assert.equal(r.status, 400);
        r = await request(app).put('/contabilidade/sped/config').set(auth(A.token)).send(CONFIG);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).get('/contabilidade/sped/config').set(auth(A.token));
        assert.equal(r.body.cnpj, '11222333000181');
        assert.equal(r.body.codMun, '3550308');
        r = await request(app).get('/contabilidade/sped/config').set(auth(B.token));
        assert.notEqual(r.body.cnpj, '11222333000181', 'B não vê os dados da A');
    });

    test('cadastro de dirigentes com regras', async () => {
        const novo = (d) => request(app).post('/contabilidade/dirigentes').set(auth(A.token)).send(d);
        assert.equal((await novo({ nome: 'Pastor Presidente', cpf: '529.982.247-26', qualificacao: 203 })).status, 400, 'CPF inválido');
        assert.equal((await novo({ nome: 'Contador Sem CRC', cpf: '111.444.777-35', qualificacao: 900 })).status, 400, 'contador sem CRC');
        let r = await novo({ nome: 'Pastor Presidente', cpf: '529.982.247-25', qualificacao: 203, cargo: 'Presidente', responsavelLegal: true, remuneracao: 24000 });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal((await novo({ nome: 'Duplicado', cpf: '52998224725', qualificacao: 204 })).status, 409);
        r = await novo({ nome: 'Maria Contadora', cpf: '111.444.777-35', qualificacao: 900, crc: 'SP-123456/O-7', ufCrc: 'SP', email: 'contadora@exemplo.com' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await novo({ nome: 'José Conselheiro', cpf: '390.533.447-05', qualificacao: 204, cargo: 'Conselho fiscal', assinaEcd: false });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const lista = (await request(app).get('/contabilidade/dirigentes').set(auth(A.token))).body.items;
        assert.equal(lista.length, 3);
        assert.equal((await request(app).get('/contabilidade/dirigentes').set(auth(B.token))).body.items.length, 0);
        const jose = lista.find((d) => d.nome === 'José Conselheiro');
        assert.equal((await request(app).delete(`/contabilidade/dirigentes/${jose.id}`).set(auth(B.token))).status, 404);
    });
});

describe('Geração da ECD', () => {
    test('movimento, abertura e encerramento do ano', async () => {
        await request(app).put('/caixa/competencia/saldo-inicial').set(auth(A.token)).send({ competencia: COMP, saldoInicial: '500' });
        let r = await request(app).post('/caixa/lancamentos').set(auth(A.token))
            .send({ data: DIA(1), historico: 'Dízimos do culto | domingo', valor: '300', tipo: 'ENTRADA', contaContabil: '4.01.01.01 - Dízimo de Membros' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post('/caixa/lancamentos').set(auth(A.token))
            .send({ data: DIA(1), historico: 'Conta de água', valor: '120,50', tipo: 'SAIDA', contaContabil: '3.01.02 - Água e esgoto' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post('/contabilidade/lancamentos').set(auth(A.token)).send({
            dataLancamento: DIA(1), contaDebito: '1.02.01.03', contaCredito: '2.01.01.01', historico: 'Compra de cadeiras a prazo', valor: '1000', documento: 'NF 10'
        });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        await request(app).put('/contabilidade/balancete-abertura').set(auth(A.token)).send({ conta: '1.02.01.02', saldo: '20000' });
        await request(app).post('/contabilidade/balancete-abertura/ajustar-resultado').set(auth(A.token));
        r = await request(app).post('/contabilidade/encerramento').set(auth(A.token)).send({ ano: ANO });
        assert.equal(r.status, 201, JSON.stringify(r.body));
    });

    test('validação passa e o plano de contas está consistente', async () => {
        const vp = (await request(app).get('/contabilidade/sped/validar-plano').set(auth(A.token))).body;
        assert.equal(vp.ok, true, JSON.stringify(vp.erros));
        const r = await request(app).post('/contabilidade/sped/ecd/validar').set(auth(A.token)).send(ECD);
        assert.equal(r.body.ok, true, JSON.stringify(r.body.erros));
    });

    test('mapeamento referencial entra no I051 e no 0000', async () => {
        let r = await request(app).put('/contabilidade/sped/referencial').set(auth(A.token))
            .send({ itens: [{ codigo: '1.01.01', referencial: '1.01.01.01.01' }, { codigo: '1.01', referencial: 'x' }] });
        assert.equal(r.status, 400, 'conta sintética não é mapeada');
        r = await request(app).put('/contabilidade/sped/referencial').set(auth(A.token)).send({ itens: [{ codigo: '1.01.01', referencial: '1.01.01.01.01' }] });
        assert.equal(r.status, 200);
    });

    test('gera o arquivo com estrutura válida', async () => {
        let r = await request(app).post('/contabilidade/sped/ecd/gerar').set(auth(A.token)).send(ECD);
        assert.equal(r.status, 201, JSON.stringify(r.body));
        arquivoId = r.body.id;
        assert.equal(r.body.arquivo, `SPED-ECD_11222333000181_${ANO}.txt`);

        r = await request(app).get(`/contabilidade/sped/arquivos/${arquivoId}/download`).set(auth(A.token)).buffer(true).parse((res, cb) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => cb(null, Buffer.concat(chunks)));
        });
        assert.equal(r.status, 200);
        assert.match(r.headers['content-disposition'], /SPED-ECD_11222333000181/);
        texto = r.body.toString('latin1');
        assert.ok(texto.endsWith('\r\n'));
        const linhas = texto.trimEnd().split('\r\n');
        const campos = linhas.map((l) => l.split('|'));
        linhas.forEach((l) => assert.match(l, /^\|[0-9A-Z]{4}\|.*\|$/, `linha mal formada: ${l}`));
        const reg = (r0) => campos.filter((c) => c[1] === r0);

        // abertura do arquivo
        const z = reg('0000')[0];
        assert.deepEqual(z.slice(1, 7), ['0000', 'LECD', `0101${ANO}`, `3112${ANO}`, 'Igreja SPED A', '11222333000181']);
        assert.equal(z[z.length - 2], '5', 'COD_PLAN_REF com mapeamento');
        assert.equal(reg('I010')[0][3], '9.00');
        assert.ok(texto.includes('Dízimos do culto domingo'), 'pipe removido do histórico, acento em latin1');

        // 9999 e QTD_LIN dos termos
        const total = linhas.length;
        assert.equal(reg('9999')[0][2], String(total));
        assert.equal(reg('I030')[0][5], String(total));
        assert.equal(reg('J900')[0][6], String(total));
        assert.equal(reg('I030')[0][3], '3', 'nº do livro');

        // contagem por bloco
        for (const b of ['0', 'C', 'I', 'J', 'K', '9']) {
            const n = linhas.filter((l) => l.slice(1, 2) === b).length;
            assert.equal(reg(`${b}990`)[0][2], String(n), `bloco ${b}`);
        }
        // 9900 bate com a contagem real
        const cont = {};
        campos.forEach((c) => { cont[c[1]] = (cont[c[1]] || 0) + 1; });
        reg('9900').forEach((c) => assert.equal(String(cont[c[2]]), c[3], `9900 ${c[2]}`));
        assert.equal(reg('9900').length, Object.keys(cont).length);

        // partidas dobradas: cada I200 = soma dos D = soma dos C
        let atual = null;
        const fechar = () => { if (atual) { assert.equal(atual.d.toFixed(2), atual.v.toFixed(2)); assert.equal(atual.c.toFixed(2), atual.v.toFixed(2)); } };
        campos.forEach((c) => {
            if (c[1] === 'I200') { fechar(); atual = { v: num(c[4]), d: 0, c: 0 }; }
            if (c[1] === 'I250') atual[c[5] === 'D' ? 'd' : 'c'] += num(c[4]);
        });
        fechar();
        assert.ok(reg('I200').some((c) => c[5] === 'E'), 'há lançamentos de encerramento');
        assert.equal(reg('I051').length, 1);

        // I355: resultado antes do encerramento (receita 300 C, despesa 120,50 D)
        const i355 = Object.fromEntries(reg('I355').map((c) => [c[2], `${c[4]}${c[5]}`]));
        assert.equal(i355['4.01.01.01'], '300,00C');
        assert.equal(i355['3.01.02'], '120,50D');

        // J100: Ativo = Passivo + PL no fim; contas de resultado zeradas no I155 de dezembro... e balanço fecha
        const j100 = Object.fromEntries(reg('J100').map((c) => [c[2], c]));
        assert.equal(j100['1'][10], j100['2'][10], 'ativo = passivo + PL');
        // caixa 500 + 300 - 120,50 = 679,50; edificações 20.000; móveis 1.000
        assert.equal(j100['1'][10], '21679,50');
        assert.equal(j100['2.03.03'][10], '0,00', 'resultado do exercício apropriado');
        // J150: DRE do ano
        const j150 = Object.fromEntries(reg('J150').map((c) => [c[3], c]));
        assert.equal(j150['4'][10], '300,00');
        assert.equal(j150['4'][11], 'C');
        assert.equal(j150['3'][10], '120,50');
        // signatários: presidente (resp. legal) e contadora com CRC; conselheiro não assina
        const j930 = reg('J930');
        assert.equal(j930.length, 2);
        const cont930 = j930.find((c) => c[5] === '900');
        assert.equal(cont930[6], 'SP-123456/O-7');
        assert.equal(j930.find((c) => c[5] === '203')[12], 'S');
    });

    test('histórico e isolamento dos arquivos', async () => {
        const la = (await request(app).get('/contabilidade/sped/arquivos?tipo=ECD').set(auth(A.token))).body.items;
        assert.equal(la.length, 1);
        assert.equal(la[0].ano, ANO);
        assert.equal((await request(app).get('/contabilidade/sped/arquivos').set(auth(B.token))).body.items.length, 0);
        assert.equal((await request(app).get(`/contabilidade/sped/arquivos/${arquivoId}/download`).set(auth(B.token))).status, 404);
        assert.equal((await request(app).delete(`/contabilidade/sped/arquivos/${arquivoId}`).set(auth(B.token))).status, 404);
    });

    test('ficha da ECF', async () => {
        const f = (await request(app).get(`/contabilidade/sped/ecf?ano=${ANO}`).set(auth(A.token))).body;
        assert.equal(f.pronto, true, JSON.stringify(f.prerequisitos));
        assert.equal(f.dre.resultado, 179.5);
        assert.equal(f.balanco.totalAtivo, f.balanco.totalPassivo);
        assert.equal(f.dirigentes.length, 2, 'contador não entra na lista de dirigentes');
        const fb = (await request(app).get(`/contabilidade/sped/ecf?ano=${ANO}`).set(auth(B.token))).body;
        assert.equal(fb.pronto, false);
        assert.equal(fb.ecd, null);
    });
});
