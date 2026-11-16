'use strict';
/**
 * Correções (nov/2026):
 *  1. Trial absurdo — limite de 1..365 dias na extensão/criação e no fim do trial.
 *  2. Papel no cabeçalho — o shell usa o papel real do usuário (não o data-shell-role fixo).
 *  3. App do Membro — senha padrão (6 primeiros dígitos do CPF) exige troca obrigatória
 *     antes de liberar o token do app; isolamento entre igrejas.
 */
const os = require('os');
const fs = require('fs');
const path = require('path');

const TEST_DB = path.join(os.tmpdir(), `ldfp-correcoes-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH = TEST_DB;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'correcoes-test-secret-32-chars-min!!';
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
    return { token: res.body.token, igrejaId: res.body.user.igrejaId, igreja };
}

const CPF_A = '12345678901';
const CPF_B = '98765432100';
let A, B, superToken, membroA, membroB;

before(async () => {
    await initializeDatabase();
    A = await register('Admin A', 'admin-a@correcoes.test', 'SenhaSegura1!', 'Igreja Correcoes A');
    B = await register('Admin B', 'admin-b@correcoes.test', 'SenhaSegura2!', 'Igreja Correcoes B');

    const hash = await bcrypt.hash('SuperSenha1!', 4);
    await pool.query(
        'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['LDFP Master', A.igrejaId, 'Super', 'super@correcoes.test', hash, 'super-admin']
    );
    const [u] = await pool.query('SELECT id FROM usuarios WHERE email = ?', ['super@correcoes.test']);
    superToken = jwt.sign({ sub: u[0].id, role: 'super-admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    await pool.query('INSERT INTO membros (igreja_id, nome, cpf) VALUES (?, ?, ?)', [A.igrejaId, 'Membro A', '123.456.789-01']);
    await pool.query('INSERT INTO membros (igreja_id, nome, cpf) VALUES (?, ?, ?)', [B.igrejaId, 'Membro B', CPF_B]);
    const [ma] = await pool.query('SELECT id FROM membros WHERE igreja_id = ? AND nome = ?', [A.igrejaId, 'Membro A']);
    const [mb] = await pool.query('SELECT id FROM membros WHERE igreja_id = ? AND nome = ?', [B.igrejaId, 'Membro B']);
    membroA = ma[0].id;
    membroB = mb[0].id;
});

describe('1. Trial absurdo', () => {
    const patch = (body) => request(app).patch(`/api/saas/igrejas/${B.igrejaId}/contrato`).set(auth(superToken)).send(body);

    test('trial_extension_days fora de 1..365 → 400', async () => {
        for (const v of [0, -5, 366, 26710, 2.5, 'abc']) {
            const r = await patch({ trial_extension_days: v });
            assert.equal(r.status, 400, `valor ${v}: ${JSON.stringify(r.body)}`);
            assert.match(r.body.error, /entre 1 e 365/);
        }
    });

    test('trial_extension_days válido estende o trial', async () => {
        await pool.query('UPDATE igrejas SET trial_ends_at = NULL WHERE id = ?', [B.igrejaId]);
        const r = await patch({ trial_extension_days: 30 });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const dias = Math.round((new Date(r.body.trial_ends_at) - Date.now()) / 86400000);
        assert.ok(dias >= 29 && dias <= 31, `dias=${dias}`);
    });

    test('extensão que ultrapassa 365 dias a partir de hoje → 400', async () => {
        const fim = new Date(Date.now() + 300 * 86400000).toISOString();
        await pool.query('UPDATE igrejas SET trial_ends_at = ? WHERE id = ?', [fim, B.igrejaId]);
        const r = await patch({ trial_extension_days: 100 });
        assert.equal(r.status, 400);
        assert.match(r.body.error, /365 dias/);
    });

    test('trial_ends_at direto em 2099 → 400; data razoável → 200', async () => {
        const r1 = await patch({ trial_ends_at: '2099-12-31' });
        assert.equal(r1.status, 400);
        assert.match(r1.body.error, /365 dias/);

        const ok = new Date(Date.now() + 20 * 86400000).toISOString().slice(0, 10);
        const r2 = await patch({ trial_ends_at: ok });
        assert.equal(r2.status, 200, JSON.stringify(r2.body));
    });

    test('criação de igreja com trial_days fora de 1..365 → 400', async () => {
        const r = await request(app).post('/api/saas/igrejas').set(auth(superToken)).send({
            nome: 'Igreja X', plano: 'hebrom', email_admin: 'x@correcoes.test', senha: 'Senha123!',
            status_assinatura: 'trial', trial_days: 26710
        });
        assert.equal(r.status, 400);
        assert.match(r.body.error, /entre 1 e 365/);
    });

    test('igreja comum não altera contrato (só super admin)', async () => {
        const r = await request(app).patch(`/api/saas/igrejas/${B.igrejaId}/contrato`).set(auth(A.token)).send({ trial_extension_days: 10 });
        assert.equal(r.status, 403);
    });
});

describe('2. Papel real no cabeçalho', () => {
    test('enterprise-shell não usa mais o data-shell-role fixo da página', () => {
        const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'enterprise-shell.js'), 'utf8');
        assert.ok(!/dataset\.shellRole/.test(src), 'shell ainda lê data-shell-role');
        assert.match(src, /admin: 'Administrador'/);
        assert.match(src, /secretaria: 'Secretaria'/);
        assert.match(src, /roleLabel: getRoleLabel\(user\)/);
    });
});

describe('3. App do Membro — troca obrigatória da senha padrão', () => {
    const login = (cpf, senha, igreja_nome) => request(app).post('/app-membro/login').send({ cpf, senha, igreja_nome });
    const trocar = (token, novaSenha) => request(app).put('/app-membro/trocar-senha').set(auth(token)).send({ novaSenha });

    let trocaA;

    test('senha errada no primeiro acesso → 401', async () => {
        const r = await login(CPF_A, '000000', 'Igreja Correcoes A');
        assert.equal(r.status, 401);
    });

    test('login com senha padrão → exige troca e NÃO emite token do app', async () => {
        const r = await login(CPF_A, CPF_A.slice(0, 6), 'Igreja Correcoes A');
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.precisa_trocar, true);
        assert.equal(r.body.token, undefined);
        assert.ok(r.body.troca_token);
        trocaA = r.body.troca_token;
        const p = jwt.decode(trocaA);
        assert.equal(p.app_mode, undefined);
        assert.equal(p.igrejaId, undefined);
    });

    test('token de troca não dá acesso ao app nem a rotas autenticadas', async () => {
        const perfil = await request(app).get('/app-membro/meu-perfil').set(auth(trocaA));
        assert.equal(perfil.status, 403);
        const me = await request(app).get('/auth/me').set(auth(trocaA));
        assert.equal(me.status, 401);
        const membros = await request(app).get('/membros').set(auth(trocaA));
        assert.equal(membros.status, 401);
    });

    test('troca inválida é rejeitada (curta, igual à padrão, igual ao CPF)', async () => {
        for (const ruim of ['abc123', CPF_A.slice(0, 6), CPF_A, '123.456.789-01']) {
            const r = await trocar(trocaA, ruim);
            assert.equal(r.status, 400, `senha ${ruim}: ${JSON.stringify(r.body)}`);
        }
    });

    test('troca válida libera o app e o login passa a ser normal', async () => {
        const r = await trocar(trocaA, 'MinhaSenhaForte9');
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.ok(r.body.token);
        assert.equal(jwt.decode(r.body.token).app_mode, true);

        const perfil = await request(app).get('/app-membro/meu-perfil').set(auth(r.body.token));
        assert.equal(perfil.status, 200);
        assert.equal(perfil.body.app_senha, undefined);

        const velha = await login(CPF_A, CPF_A.slice(0, 6), 'Igreja Correcoes A');
        assert.equal(velha.status, 401);

        const nova = await login(CPF_A, 'MinhaSenhaForte9', 'Igreja Correcoes A');
        assert.equal(nova.status, 200);
        assert.equal(nova.body.precisa_trocar, false);
        assert.ok(nova.body.token);
    });

    test('token de troca não pode ser reaproveitado depois da troca', async () => {
        const r = await trocar(trocaA, 'OutraSenhaForte9');
        assert.equal(r.status, 409);
    });

    test('membro que tinha gravado a senha padrão como senha também é obrigado a trocar', async () => {
        const hash = await bcrypt.hash(CPF_B.slice(0, 6), 4);
        await pool.query('UPDATE membros SET app_senha = ?, precisa_trocar_senha = 0 WHERE id = ?', [hash, membroB]);
        const r = await login(CPF_B, CPF_B.slice(0, 6), 'Igreja Correcoes B');
        assert.equal(r.status, 200);
        assert.equal(r.body.precisa_trocar, true);
        assert.equal(r.body.token, undefined);
    });

    test('reset pelo admin volta a exigir troca', async () => {
        const reset = await request(app).post(`/membros/${membroA}/resetar-senha-app`).set(auth(A.token));
        assert.equal(reset.status, 200, JSON.stringify(reset.body));

        const r = await login(CPF_A, CPF_A.slice(0, 6), 'Igreja Correcoes A');
        assert.equal(r.status, 200);
        assert.equal(r.body.precisa_trocar, true);
        assert.equal(r.body.token, undefined);
    });

    test('isolamento: admin da igreja B não reseta membro da igreja A', async () => {
        const r = await request(app).post(`/membros/${membroA}/resetar-senha-app`).set(auth(B.token));
        assert.equal(r.status, 404);
    });

    test('isolamento: token de troca de um membro só altera o próprio membro', async () => {
        const rB = await login(CPF_B, CPF_B.slice(0, 6), 'Igreja Correcoes B');
        const trocaB = rB.body.troca_token;
        const [antesA] = await pool.query('SELECT app_senha FROM membros WHERE id = ?', [membroA]);

        // body com outro membro/igreja é ignorado: vale o que está no token assinado
        const r = await request(app).put('/app-membro/trocar-senha').set(auth(trocaB))
            .send({ novaSenha: 'SenhaDoMembroB9', membro_id: membroA, igrejaId: A.igrejaId });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(jwt.decode(r.body.token).igrejaId, B.igrejaId);

        const [depoisA] = await pool.query('SELECT app_senha FROM membros WHERE id = ?', [membroA]);
        assert.equal(depoisA[0].app_senha, antesA[0].app_senha);

        // token forjado apontando o membro A com a igreja B → 404
        const forjado = jwt.sign({ app_troca_senha: true, membro_id: membroA, troca_igreja_id: B.igrejaId }, process.env.JWT_SECRET, { expiresIn: '5m' });
        const r2 = await trocar(forjado, 'TentativaInvasao9');
        assert.equal(r2.status, 404);
    });

    test('troca voluntária com o token do app também aplica as regras novas', async () => {
        const r = await login(CPF_B, 'SenhaDoMembroB9', 'Igreja Correcoes B');
        assert.equal(r.status, 200);
        const fraca = await trocar(r.body.token, CPF_B);
        assert.equal(fraca.status, 400);
        const ok = await trocar(r.body.token, 'NovaSenhaB12345');
        assert.equal(ok.status, 200);
    });
});
