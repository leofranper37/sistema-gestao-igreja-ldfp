'use strict';
/**
 * Tenant Isolation Tests
 *
 * Logs in as Igreja A and attempts to read/delete data that belongs to
 * Igreja B. Every cross-tenant request must fail with 403 or 404.
 * Positive controls verify Igreja B's data survives the attacks.
 */

// ── env must be set BEFORE any app module is required ────────────────────────
const os   = require('os');
const path = require('path');
const fs   = require('fs');

const TEST_DB = path.join(os.tmpdir(), `ldfp-tenant-test-${Date.now()}.sqlite`);
process.env.SQLITE_DB_PATH   = TEST_DB;
process.env.NODE_ENV         = 'test';
process.env.JWT_SECRET       = 'tenant-test-secret-32-chars-min!!';
process.env.JWT_EXPIRES_IN   = '1h';
process.env.CORS_ORIGIN      = '';
process.env.MAINTENANCE_MODE = 'false';
process.env.SMTP_HOST        = '';
process.env.MP_ACCESS_TOKEN  = '';

// ── imports ───────────────────────────────────────────────────────────────────
const { test, before, after, describe } = require('node:test');
const assert  = require('node:assert/strict');
const request = require('supertest');

const { initializeDatabase, pool } = require('../src/config/db');
const app = require('../src/app');

// ── SQLite-compatible DDL for module-specific tables ─────────────────────────
const MODULE_TABLES = [
    `CREATE TABLE IF NOT EXISTS batismos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igreja_id INTEGER NOT NULL,
        descricao TEXT NOT NULL,
        data_batismo TEXT,
        horario TEXT,
        local_batismo TEXT,
        pastor TEXT,
        encerrado TEXT NOT NULL DEFAULT 'Não',
        congregacao TEXT,
        data_aula TEXT,
        professor_aula TEXT,
        local_aula TEXT,
        obs TEXT,
        total_batizados INTEGER DEFAULT 0,
        fotografo TEXT,
        link_midia TEXT,
        created_by INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS batismo_candidatos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batismo_id INTEGER NOT NULL,
        igreja_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        telefone TEXT,
        status TEXT NOT NULL DEFAULT 'Pendente',
        membro_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ebd_turmas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igreja_id INTEGER NOT NULL,
        nome TEXT NOT NULL,
        ano TEXT,
        estagio TEXT,
        situacao TEXT DEFAULT 'Ativo',
        professor TEXT,
        segundo_professor TEXT,
        telefone_professor TEXT,
        email_professor TEXT,
        dia_semana TEXT,
        horario TEXT,
        sala TEXT,
        revista_info TEXT,
        licoes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ebd_apontamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igreja_id INTEGER NOT NULL,
        turma_id INTEGER NOT NULL,
        data TEXT NOT NULL,
        licao_numero TEXT,
        licao_titulo TEXT,
        professor_presente TEXT,
        visitantes INTEGER DEFAULT 0,
        oferta REAL DEFAULT 0,
        biblias INTEGER DEFAULT 0,
        revistas INTEGER DEFAULT 0,
        obs TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS ebd_presenca (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        igreja_id INTEGER NOT NULL,
        apontamento_id INTEGER NOT NULL,
        aluno_id INTEGER NOT NULL,
        presente INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS escalas_eventos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        church_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        start_date TEXT NOT NULL,
        recurrence_type TEXT NOT NULL DEFAULT 'none',
        recurrence_end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS escalas_evento_funcoes (
        event_id INTEGER NOT NULL,
        function_id INTEGER NOT NULL,
        PRIMARY KEY (event_id, function_id)
    )`,
    `CREATE TABLE IF NOT EXISTS escalas_instancias (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        church_id INTEGER NOT NULL,
        instance_date TEXT NOT NULL,
        is_cancelled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS escalas_atribuicoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        instance_id INTEGER NOT NULL,
        function_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        church_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
];

// ── shared state ──────────────────────────────────────────────────────────────
let tokenA, tokenB, igrejaIdA, igrejaIdB;
let batismoB_id, candidatoB_id, apontamentoB_id, turmaB_id, eventoB_id;

const authA = () => ({ Authorization: `Bearer ${tokenA}` });
const authB = () => ({ Authorization: `Bearer ${tokenB}` });

async function register(nome, email, senha, igreja) {
    const res = await request(app)
        .post('/api/cadastro-igreja')
        .send({ nome, email, senha, igreja });
    assert.equal(res.status, 201, `Registro falhou para ${email}: ${JSON.stringify(res.body)}`);
    return { token: res.body.token, igrejaId: res.body.user.igrejaId };
}

// ── setup ─────────────────────────────────────────────────────────────────────
before(async () => {
    await initializeDatabase();

    // Create SQLite tables for modules not in the core schema
    for (const ddl of MODULE_TABLES) {
        await pool.query(ddl);
    }

    // Create two independent churches
    ({ token: tokenA, igrejaId: igrejaIdA } = await register(
        'Admin Igreja A', 'admin-a@tenant-test.com', 'SenhaSegura1!', 'Igreja Alfa'
    ));
    ({ token: tokenB, igrejaId: igrejaIdB } = await register(
        'Admin Igreja B', 'admin-b@tenant-test.com', 'SenhaSegura2!', 'Igreja Beta'
    ));

    // ── Create batismo + candidato for Igreja B via API ──────────────────────
    const batRes = await request(app)
        .post('/api/batismos')
        .set(authB())
        .send({ descricao: 'Batismo Secreto da Igreja B' });
    assert.ok(batRes.status < 300, `createBatismo falhou: ${JSON.stringify(batRes.body)}`);
    batismoB_id = batRes.body.id;

    const candRes = await request(app)
        .post(`/api/batismos/${batismoB_id}/candidatos`)
        .set(authB())
        .send({ nome: 'Candidato Secreto B' });
    assert.ok(candRes.status < 300, `addCandidato falhou: ${JSON.stringify(candRes.body)}`);
    candidatoB_id = candRes.body.id;

    // ── Create EBD turma + apontamento for Igreja B (direct insert) ──────────
    const [tRes] = await pool.query(
        `INSERT INTO ebd_turmas (igreja_id, nome, situacao) VALUES (?, ?, ?)`,
        [igrejaIdB, 'Turma Secreta B', 'Ativo']
    );
    turmaB_id = tRes.insertId;

    const [apRes] = await pool.query(
        `INSERT INTO ebd_apontamentos (igreja_id, turma_id, data, visitantes, oferta, biblias, revistas)
         VALUES (?, ?, '2024-06-01', 0, 0, 0, 0)`,
        [igrejaIdB, turmaB_id]
    );
    apontamentoB_id = apRes.insertId;

    // Insert a presença row to verify cascade isolation
    await pool.query(
        `INSERT INTO ebd_presenca (igreja_id, apontamento_id, aluno_id, presente) VALUES (?, ?, 999, 1)`,
        [igrejaIdB, apontamentoB_id]
    );

    // ── Create escalas evento for Igreja B (direct insert) ───────────────────
    const [evRes] = await pool.query(
        `INSERT INTO escalas_eventos (church_id, title, start_date, recurrence_type)
         VALUES (?, ?, '2024-06-01', 'none')`,
        [igrejaIdB, 'Culto Secreto da Igreja B']
    );
    eventoB_id = evRes.insertId;

    // Insert a funcao link so we can verify cascade isolation
    await pool.query(
        `INSERT OR IGNORE INTO escalas_evento_funcoes (event_id, function_id) VALUES (?, 1)`,
        [eventoB_id]
    );
});

// ── teardown ──────────────────────────────────────────────────────────────────
after(async () => {
    try { await pool.end(); } catch (_) {}
    try { fs.unlinkSync(TEST_DB); } catch (_) {}
});

// ── test suites ───────────────────────────────────────────────────────────────

describe('Batismos — isolamento por tenant', () => {
    test('Igreja A NÃO pode deletar batismo da Igreja B', async () => {
        const res = await request(app)
            .delete(`/api/batismos/${batismoB_id}`)
            .set(authA());
        assert.ok(
            res.status === 404 || res.status === 403,
            `Esperava 403/404, recebeu ${res.status}: ${JSON.stringify(res.body)}`
        );
    });

    test('Igreja A NÃO pode deletar candidato da Igreja B', async () => {
        const res = await request(app)
            .delete(`/api/batismos/${batismoB_id}/candidatos/${candidatoB_id}`)
            .set(authA());
        assert.ok(
            res.status === 404 || res.status === 403,
            `Esperava 403/404, recebeu ${res.status}: ${JSON.stringify(res.body)}`
        );
    });

    test('Igreja A NÃO pode ler batismo da Igreja B', async () => {
        const res = await request(app)
            .get(`/api/batismos/${batismoB_id}`)
            .set(authA());
        assert.ok(
            res.status === 404 || res.status === 403,
            `Esperava 403/404, recebeu ${res.status}: ${JSON.stringify(res.body)}`
        );
    });

    test('[positivo] Igreja B ainda acessa seu batismo após ataques', async () => {
        const res = await request(app)
            .get(`/api/batismos/${batismoB_id}`)
            .set(authB());
        assert.equal(res.status, 200);
        assert.equal(res.body.id, batismoB_id);
    });

    test('[positivo] Candidato da Igreja B ainda existe após ataques', async () => {
        const res = await request(app)
            .get(`/api/batismos/${batismoB_id}`)
            .set(authB());
        assert.equal(res.status, 200);
        const candidatos = res.body.candidatos || [];
        assert.ok(
            candidatos.some(c => c.id === candidatoB_id),
            'Candidato da Igreja B deve existir após tentativa de deleção por Igreja A'
        );
    });
});

describe('EBD Apontamentos — isolamento por tenant', () => {
    test('Igreja A NÃO pode deletar apontamento da Igreja B', async () => {
        const res = await request(app)
            .delete(`/api/ebd/apontamentos/${apontamentoB_id}`)
            .set(authA());
        assert.ok(
            res.status === 404 || res.status === 403,
            `Esperava 403/404, recebeu ${res.status}: ${JSON.stringify(res.body)}`
        );
    });

    test('[positivo] Apontamento da Igreja B ainda existe no banco após ataque', async () => {
        const [rows] = await pool.query(
            'SELECT id FROM ebd_apontamentos WHERE id = ? AND igreja_id = ?',
            [apontamentoB_id, igrejaIdB]
        );
        assert.equal(rows.length, 1, 'Apontamento da Igreja B deve existir após tentativa de deleção');
    });

    test('[positivo] Presença da Igreja B não foi deletada após ataque', async () => {
        const [rows] = await pool.query(
            'SELECT id FROM ebd_presenca WHERE apontamento_id = ? AND igreja_id = ?',
            [apontamentoB_id, igrejaIdB]
        );
        assert.equal(rows.length, 1, 'Registro de presença da Igreja B deve sobreviver ao ataque');
    });
});

describe('Escalas Eventos — isolamento por tenant', () => {
    test('Igreja A NÃO pode deletar evento da Igreja B', async () => {
        const res = await request(app)
            .delete(`/api/escalas/eventos/${eventoB_id}`)
            .set(authA());
        assert.ok(
            res.status === 404 || res.status === 403,
            `Esperava 403/404, recebeu ${res.status}: ${JSON.stringify(res.body)}`
        );
    });

    test('[positivo] Evento da Igreja B ainda existe no banco após ataque', async () => {
        const [rows] = await pool.query(
            'SELECT id FROM escalas_eventos WHERE id = ? AND church_id = ?',
            [eventoB_id, igrejaIdB]
        );
        assert.equal(rows.length, 1, 'Evento da Igreja B deve existir após tentativa de deleção');
    });

    test('[positivo] Funcoes do evento da Igreja B não foram deletadas', async () => {
        const [rows] = await pool.query(
            'SELECT event_id FROM escalas_evento_funcoes WHERE event_id = ?',
            [eventoB_id]
        );
        assert.equal(rows.length, 1, 'Funcoes do evento da Igreja B devem sobreviver ao ataque');
    });
});

describe('Acesso sem autenticação', () => {
    test('Sem token → 401', async () => {
        const res = await request(app).delete(`/api/batismos/${batismoB_id}`);
        assert.equal(res.status, 401);
    });

    test('Token inválido → 401', async () => {
        const res = await request(app)
            .delete(`/api/batismos/${batismoB_id}`)
            .set({ Authorization: 'Bearer token.invalido.aqui' });
        assert.equal(res.status, 401);
    });
});
