'use strict';
/**
 * Lote 6 — Mural (posts/comentários/reações/denúncias/moderação),
 * Inscrição em eventos e Carteirinha com QR verificável.
 *
 * Foco: regras de permissão e isolamento multi-tenant (Igreja B nunca vê/mexe na A).
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ldfp-lote6-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'lote6-test-secret-32-chars-min!!!';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST = '';
process.env.MP_ACCESS_TOKEN = '';

const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');

let tokenA; let tokenB;
let igrejaA; let igrejaB;
let membroA1; let membroA2; let membroB1;
let appA1; let appA2; let appB1;

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function register(nome, email, senha, igreja) {
    const res = await request(app).post('/api/cadastro-igreja').send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou para ${email}: ${JSON.stringify(res.body)}`);
    return res.body.token;
}

async function igrejaDoToken(token) {
    const { sub } = jwt.decode(token);
    const [[u]] = await pool.query('SELECT igreja_id FROM usuarios WHERE id = ?', [sub]);
    return Number(u.igreja_id);
}

async function criarMembro(igrejaId, nome, situacao = 'Ativo') {
    const [r] = await pool.query(
        'INSERT INTO membros (igreja_id, nome, cpf, situacao, celular) VALUES (?, ?, ?, ?, ?)',
        [igrejaId, nome, String(Date.now()).slice(-11), situacao, '11999990000']
    );
    return r.insertId;
}

/** Mesmo payload do loginMembroApp. */
function tokenApp(igrejaId, membroId, nome) {
    return jwt.sign({
        id: membroId, membro_id: membroId, nome, igrejaId, role: 'membro', app_mode: true
    }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

before(async () => {
    await initializeDatabase();
    tokenA = await register('Admin A', 'admin-a@lote6-test.com', 'SenhaSegura1!', 'Igreja Alfa');
    tokenB = await register('Admin B', 'admin-b@lote6-test.com', 'SenhaSegura2!', 'Igreja Beta');
    igrejaA = await igrejaDoToken(tokenA);
    igrejaB = await igrejaDoToken(tokenB);
    assert.notEqual(igrejaA, igrejaB);
    membroA1 = await criarMembro(igrejaA, 'Ana Alfa');
    membroA2 = await criarMembro(igrejaA, 'Bruno Alfa', 'Inativo');
    membroB1 = await criarMembro(igrejaB, 'Carla Beta');
    appA1 = tokenApp(igrejaA, membroA1, 'Ana Alfa');
    appA2 = tokenApp(igrejaA, membroA2, 'Bruno Alfa');
    appB1 = tokenApp(igrejaB, membroB1, 'Carla Beta');
});

after(() => {
    try { fs.unlinkSync(TEST_DB); } catch (_) { /* ignore */ }
});

// ─── MURAL ──────────────────────────────────────────────────────────────────

describe('Lote 6 — Mural', () => {
    let postEquipe; let postMembro; let comentario;

    test('sem login → 401', async () => {
        const r = await request(app).get('/api/mural');
        assert.equal(r.status, 401);
    });

    test('admin publica direto; membro fica pendente (exige aprovação por padrão)', async () => {
        let r = await request(app).post('/api/mural').set(auth(tokenA)).send({ texto: 'Culto de domingo às 18h!', fixado: true });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.status, 'publicado');
        postEquipe = r.body.id;

        r = await request(app).post('/api/mural').set(auth(appA1)).send({ texto: 'Glória a Deus pela cura da minha mãe' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        assert.equal(r.body.status, 'pendente');
        postMembro = r.body.id;
    });

    test('texto vazio → 400', async () => {
        const r = await request(app).post('/api/mural').set(auth(appA1)).send({ texto: '   ' });
        assert.equal(r.status, 400);
    });

    test('membro vê o publicado + o próprio pendente; outro membro só o publicado', async () => {
        let r = await request(app).get('/api/mural').set(auth(appA1));
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.items.map((p) => p.id).sort(), [postEquipe, postMembro].sort());
        assert.equal(r.body.items[0].fixado, true, 'fixado vem primeiro');
        assert.equal(r.body.config.modera, false);

        r = await request(app).get('/api/mural').set(auth(appA2));
        assert.deepEqual(r.body.items.map((p) => p.id), [postEquipe]);
    });

    test('Igreja B (admin e membro) não vê nada da Igreja A', async () => {
        let r = await request(app).get('/api/mural').set(auth(tokenB));
        assert.equal(r.body.items.length, 0);
        r = await request(app).get('/api/mural').set(auth(appB1));
        assert.equal(r.body.items.length, 0);
        r = await request(app).get(`/api/mural/${postEquipe}/comentarios`).set(auth(appB1));
        assert.equal(r.status, 404);
        r = await request(app).post(`/api/mural/${postEquipe}/reacao`).set(auth(appB1)).send({ tipo: 'amem' });
        assert.equal(r.status, 404);
        r = await request(app).patch(`/api/mural/${postEquipe}`).set(auth(tokenB)).send({ status: 'oculto' });
        assert.equal(r.status, 404);
        r = await request(app).delete(`/api/mural/${postEquipe}`).set(auth(tokenB));
        assert.equal(r.status, 404);
    });

    test('membro não modera; admin aprova', async () => {
        let r = await request(app).patch(`/api/mural/${postMembro}`).set(auth(appA1)).send({ status: 'publicado' });
        assert.equal(r.status, 403);
        r = await request(app).patch(`/api/mural/${postMembro}`).set(auth(tokenA)).send({ status: 'publicado' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).get('/api/mural').set(auth(appA2));
        assert.equal(r.body.items.length, 2);
    });

    test('reação: troca e remove; contagem por tipo', async () => {
        let r = await request(app).post(`/api/mural/${postMembro}/reacao`).set(auth(appA2)).send({ tipo: 'amem' });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        r = await request(app).post(`/api/mural/${postMembro}/reacao`).set(auth(tokenA)).send({ tipo: 'amem' });
        assert.deepEqual(r.body.reacoes, { amem: 2 });
        r = await request(app).post(`/api/mural/${postMembro}/reacao`).set(auth(appA2)).send({ tipo: 'gratidao' });
        assert.deepEqual(r.body.reacoes, { amem: 1, gratidao: 1 });
        r = await request(app).post(`/api/mural/${postMembro}/reacao`).set(auth(appA2)).send({ tipo: null });
        assert.deepEqual(r.body.reacoes, { amem: 1 });
        r = await request(app).post(`/api/mural/${postMembro}/reacao`).set(auth(appA2)).send({ tipo: 'invalida' });
        assert.equal(r.status, 400);

        r = await request(app).get('/api/mural').set(auth(tokenA));
        const p = r.body.items.find((x) => x.id === postMembro);
        assert.equal(p.minha_reacao, 'amem');
    });

    test('comentário: membro comenta, moderador oculta, membro deixa de ver', async () => {
        let r = await request(app).post(`/api/mural/${postEquipe}/comentarios`).set(auth(appA2)).send({ texto: 'Estarei lá!' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        comentario = r.body.id;

        r = await request(app).get(`/api/mural/${postEquipe}/comentarios`).set(auth(appA1));
        assert.equal(r.body.items.length, 1);

        r = await request(app).patch(`/api/mural/comentarios/${comentario}`).set(auth(tokenB)).send({ status: 'oculto' });
        assert.equal(r.status, 404, 'Igreja B não modera comentário da A');
        r = await request(app).patch(`/api/mural/comentarios/${comentario}`).set(auth(tokenA)).send({ status: 'oculto' });
        assert.equal(r.status, 200);

        r = await request(app).get(`/api/mural/${postEquipe}/comentarios`).set(auth(appA1));
        assert.equal(r.body.items.length, 0, 'membro não vê comentário oculto');
        r = await request(app).get(`/api/mural/${postEquipe}/comentarios`).set(auth(tokenA));
        assert.equal(r.body.items.length, 1, 'moderador continua vendo');
    });

    test('denúncia aparece para o moderador e pode ser resolvida', async () => {
        let r = await request(app).post('/api/mural/denuncias').set(auth(appA1)).send({ alvo_tipo: 'post', alvo_id: postEquipe, motivo: 'teste' });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post('/api/mural/denuncias').set(auth(appB1)).send({ alvo_tipo: 'post', alvo_id: postEquipe });
        assert.equal(r.status, 404, 'Igreja B não denuncia conteúdo da A');

        r = await request(app).get('/api/mural/denuncias').set(auth(appA1));
        assert.equal(r.status, 403);
        r = await request(app).get('/api/mural/denuncias').set(auth(tokenB));
        assert.equal(r.body.items.length, 0);
        r = await request(app).get('/api/mural/denuncias').set(auth(tokenA));
        assert.equal(r.body.items.length, 1);
        assert.equal(r.body.items[0].alvo_id, postEquipe);

        r = await request(app).post('/api/mural/denuncias/resolver').set(auth(tokenA)).send({ alvo_tipo: 'post', alvo_id: postEquipe });
        assert.equal(r.status, 200);
        r = await request(app).get('/api/mural/denuncias').set(auth(tokenA));
        assert.equal(r.body.items.length, 0);
    });

    test('configuração: desligar publicações de membros e comentários', async () => {
        let r = await request(app).put('/api/mural/config').set(auth(appA1)).send({ membros_publicam: false });
        assert.equal(r.status, 403);
        r = await request(app).put('/api/mural/config').set(auth(tokenA)).send({ membros_publicam: false, comentarios: false });
        assert.equal(r.status, 200, JSON.stringify(r.body));

        r = await request(app).post('/api/mural').set(auth(appA1)).send({ texto: 'Bloqueado' });
        assert.equal(r.status, 403);
        r = await request(app).post(`/api/mural/${postEquipe}/comentarios`).set(auth(appA1)).send({ texto: 'Bloqueado' });
        assert.equal(r.status, 403);

        r = await request(app).post('/api/mural').set(auth(appB1)).send({ texto: 'Na Beta pode (config é por igreja)' });
        assert.equal(r.status, 201, 'config da Igreja A não afeta a B');

        r = await request(app).put('/api/mural/config').set(auth(tokenA)).send({ membros_publicam: true, exige_aprovacao: false, comentarios: true });
        r = await request(app).post('/api/mural').set(auth(appA1)).send({ texto: 'Agora publica direto' });
        assert.equal(r.body.status, 'publicado');
    });

    test('membro exclui só o que é dele', async () => {
        let r = await request(app).delete(`/api/mural/${postEquipe}`).set(auth(appA1));
        assert.equal(r.status, 403);
        r = await request(app).delete(`/api/mural/${postMembro}`).set(auth(appA1));
        assert.equal(r.status, 200);
        r = await request(app).get('/api/mural').set(auth(tokenA));
        assert.ok(!r.body.items.find((x) => x.id === postMembro));
    });
});

// ─── EVENTOS ────────────────────────────────────────────────────────────────

describe('Lote 6 — Inscrição em eventos', () => {
    let eventoA;
    const mes = new Date(Date.now() + 5 * 86400000);
    const ym = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, '0')}`;

    test('admin cria evento na agenda e abre inscrição com 1 vaga', async () => {
        const inicio = new Date(Date.now() + 5 * 86400000);
        const fim = new Date(inicio.getTime() + 2 * 3600000);
        let r = await request(app).post('/agenda/eventos').set(auth(tokenA))
            .send({ titulo: 'Retiro de Jovens', descricao: 'Chácara', inicio: inicio.toISOString(), fim: fim.toISOString() });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        eventoA = r.body.event?.id;
        assert.ok(eventoA, `evento precisa de id: ${JSON.stringify(r.body)}`);

        r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA1)).send({});
        assert.equal(r.status, 400, 'inscrição ainda fechada');

        r = await request(app).put(`/api/eventos-inscricao/eventos/${eventoA}/config`).set(auth(tokenB)).send({ inscricao_aberta: true });
        assert.equal(r.status, 404, 'Igreja B não configura evento da A');
        r = await request(app).put(`/api/eventos-inscricao/eventos/${eventoA}/config`).set(auth(appA1)).send({ inscricao_aberta: true });
        assert.equal(r.status, 403, 'membro não configura');
        r = await request(app).put(`/api/eventos-inscricao/eventos/${eventoA}/config`).set(auth(tokenA)).send({ inscricao_aberta: true, vagas: 1 });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.vagas, 1);
    });

    test('membro se inscreve; vaga esgota para o segundo; app mostra "minha inscrição"', async () => {
        let r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA1)).send({});
        assert.equal(r.status, 201, JSON.stringify(r.body));
        r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA2)).send({});
        assert.equal(r.status, 409, 'vagas esgotadas');
        r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appB1)).send({});
        assert.equal(r.status, 404, 'membro da Igreja B não se inscreve em evento da A');

        r = await request(app).get('/api/app/eventos').set(auth(appA1)).query({ mes: ym });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const ev = r.body.find((e) => e.id === eventoA);
        assert.ok(ev && ev.inscricao, JSON.stringify(r.body));
        assert.equal(ev.inscricao.minha, true);
        assert.equal(ev.inscricao.vagas_restantes, 0);

        r = await request(app).get('/api/app/eventos').set(auth(appB1)).query({ mes: ym });
        assert.ok(!r.body.find((e) => e.id === eventoA), 'Igreja B não lista evento da A');
    });

    test('cancelar libera a vaga', async () => {
        let r = await request(app).delete(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA1)).send({});
        assert.equal(r.status, 200);
        r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA2)).send({});
        assert.equal(r.status, 201, JSON.stringify(r.body));
    });

    test('equipe lista inscritos e marca presença; Igreja B não', async () => {
        let r = await request(app).get(`/api/eventos-inscricao/eventos/${eventoA}/inscritos`).set(auth(tokenB));
        assert.equal(r.status, 404);
        r = await request(app).get(`/api/eventos-inscricao/eventos/${eventoA}/inscritos`).set(auth(tokenA));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const insc = r.body.items.find((i) => i.membro_id === membroA2 && i.status === 'inscrito');
        assert.ok(insc, JSON.stringify(r.body.items));

        r = await request(app).patch(`/api/eventos-inscricao/inscritos/${insc.id}`).set(auth(tokenB)).send({ presente: true });
        assert.equal(r.status, 404);
        r = await request(app).patch(`/api/eventos-inscricao/inscritos/${insc.id}`).set(auth(tokenA)).send({ presente: true });
        assert.equal(r.status, 200);

        r = await request(app).get('/api/eventos-inscricao/eventos').set(auth(tokenA));
        const ev = r.body.items.find((e) => e.id === eventoA);
        assert.equal(ev.inscritos, 1);
        assert.equal(ev.presentes, 1);

        r = await request(app).get('/api/eventos-inscricao/eventos').set(auth(tokenB));
        assert.equal(r.body.items.length, 0);
    });

    test('equipe inscreve manualmente só membro da própria igreja', async () => {
        let r = await request(app).post(`/api/eventos-inscricao/eventos/${eventoA}/inscritos`).set(auth(tokenA)).send({ membro_id: membroB1 });
        assert.equal(r.status, 404);
        r = await request(app).post(`/api/eventos-inscricao/eventos/${eventoA}/inscritos`).set(auth(tokenA)).send({ membro_id: membroA1 });
        assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
    });

    test('prazo vencido encerra inscrição', async () => {
        await request(app).put(`/api/eventos-inscricao/eventos/${eventoA}/config`).set(auth(tokenA))
            .send({ inscricao_aberta: true, vagas: '', inscricao_ate: new Date(Date.now() - 3600000).toISOString() });
        await request(app).delete(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA1)).send({});
        const r = await request(app).post(`/api/app/eventos/${eventoA}/inscricao`).set(auth(appA1)).send({});
        assert.equal(r.status, 400);
        assert.match(r.body.error || '', /encerrad/i);
    });
});

// ─── CARTEIRINHA ────────────────────────────────────────────────────────────

describe('Lote 6 — Carteirinha', () => {
    let tokenQr;

    test('membro obtém a própria carteirinha com token', async () => {
        const r = await request(app).get('/api/carteirinha/minha').set(auth(appA1));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.membro.nome, 'Ana Alfa');
        assert.equal(r.body.igreja, 'Igreja Alfa');
        tokenQr = r.body.membro.token;
        assert.match(tokenQr, /^\d+-\d+-[a-f0-9]{24}$/);
    });

    test('verificação pública: válido, sem dados sensíveis', async () => {
        const r = await request(app).get(`/api/carteirinha/verificar/${tokenQr}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.valido, true);
        assert.equal(r.body.ativo, true);
        assert.equal(r.body.membro.nome, 'Ana Alfa');
        assert.equal(r.body.membro.cpf, undefined);
        assert.equal(r.body.membro.celular, undefined);
    });

    test('token adulterado (trocar o membro) é recusado', async () => {
        const [ig, , sig] = tokenQr.split('-');
        let r = await request(app).get(`/api/carteirinha/verificar/${ig}-${membroA2}-${sig}`);
        assert.equal(r.status, 404);
        assert.equal(r.body.valido, false);
        r = await request(app).get(`/api/carteirinha/verificar/${igrejaB}-${membroA1}-${sig}`);
        assert.equal(r.status, 404);
        r = await request(app).get('/api/carteirinha/verificar/lixo');
        assert.equal(r.status, 404);
    });

    test('membro inativo aparece como não ativo', async () => {
        const r1 = await request(app).get('/api/carteirinha/minha').set(auth(appA2));
        const r = await request(app).get(`/api/carteirinha/verificar/${r1.body.membro.token}`);
        assert.equal(r.status, 200);
        assert.equal(r.body.ativo, false);
    });

    test('impressão em lote: só membros da própria igreja; membro do app não acessa', async () => {
        let r = await request(app).get('/api/carteirinhas').set(auth(tokenA));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(r.body.items.map((m) => m.id).sort(), [membroA1, membroA2].sort());

        r = await request(app).get('/api/carteirinhas').set(auth(tokenA)).query({ ids: `${membroA1},${membroB1}` });
        assert.deepEqual(r.body.items.map((m) => m.id), [membroA1], 'id de outra igreja é ignorado');

        r = await request(app).get('/api/carteirinhas').set(auth(appA1));
        assert.equal(r.status, 403);
        r = await request(app).get('/api/carteirinha/minha').set(auth(tokenA));
        assert.equal(r.status, 403);
    });
});

describe('Lote 6 — páginas', () => {
    for (const pg of ['/mural.html', '/eventos_inscricoes.html', '/carteirinhas.html', '/verificar_carteirinha.html', '/app_membro_v2.html']) {
        test(`GET ${pg}`, async () => {
            const r = await request(app).get(pg);
            assert.equal(r.status, 200);
        });
    }
});
