const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');
const cadastrosTesouraria = require('./cadastrosTesourariaModel');

// natureza: dizimo | oferta | missoes  ·  publico: membro | visitante | congregado | crianca
const BASE_TIPOS_RECEITA = [
    { slug: 'dizimos', descricao: 'Dízimos', planoConta: '4.01.01.01 - Dízimo de Membros', natureza: 'dizimo', publico: 'membro' },
    { slug: 'ofertas', descricao: 'Ofertas', planoConta: '4.01.01.02 - Oferta de Membros', natureza: 'oferta', publico: 'membro' },
    { slug: 'oferta-missionaria', descricao: 'Oferta Missionária', planoConta: '4.01.03.01 - Oferta Missionária de Membros', natureza: 'missoes', publico: 'membro' },
    { slug: 'dizimo-visitantes', descricao: 'Dízimo de Visitantes', planoConta: '4.01.02.01 - Dízimo de Visitantes', natureza: 'dizimo', publico: 'visitante' },
    { slug: 'oferta-visitantes', descricao: 'Oferta de Visitantes', planoConta: '4.01.02.02 - Oferta de Visitantes', natureza: 'oferta', publico: 'visitante' },
    { slug: 'oferta-missionaria-visitantes', descricao: 'Oferta Missionária de Visitantes', planoConta: '4.01.03.02 - Oferta Missionária de Visitantes', natureza: 'missoes', publico: 'visitante' },
    { slug: 'dizimo-congregados', descricao: 'Dízimo de Congregados', planoConta: '4.01.04.01 - Dízimo de Congregados', natureza: 'dizimo', publico: 'congregado' },
    { slug: 'oferta-congregados', descricao: 'Oferta de Congregados', planoConta: '4.01.04.02 - Oferta de Congregados', natureza: 'oferta', publico: 'congregado' },
    { slug: 'dizimo-criancas', descricao: 'Dízimo de Crianças', planoConta: '4.01.05.01 - Dízimo de Crianças', natureza: 'dizimo', publico: 'crianca' },
    { slug: 'oferta-criancas', descricao: 'Oferta de Crianças', planoConta: '4.01.05.02 - Oferta de Crianças', natureza: 'oferta', publico: 'crianca' }
];

// Colunas novas criadas em tempo de execução (mesmo padrão do cadastrosTesourariaModel)
const COLUNAS_EXTRAS = {
    dizimos: [
        ['data_lancamento', 'DATE NULL'],
        ['tipo_receita_id', 'VARCHAR(80) NULL'],
        ['destino', 'VARCHAR(20) NULL'],
        ['destino_banco_id', 'INT NULL'],
        ['atualizado_em', 'DATETIME NULL']
    ],
    tipos_receita: [
        ['natureza', 'VARCHAR(20) NULL'],
        ['publico', 'VARCHAR(20) NULL']
    ]
};
const colunasExtrasProntas = new Set();

async function ensureColunasExtras(tabela) {
    for (const [col, tipo] of COLUNAS_EXTRAS[tabela] || []) {
        const k = `${tabela}.${col}`;
        if (colunasExtrasProntas.has(k)) continue;
        try {
            await pool.query(`ALTER TABLE ${tabela} ADD COLUMN ${col} ${tipo}`);
            colunasExtrasProntas.add(k);
        } catch (e) {
            if (/duplicate column|already exists/i.test(String(e && e.message))) colunasExtrasProntas.add(k);
        }
    }
}

let financeTablesReadyPromise = null;

async function ensureFinanceTables() {
    if (!financeTablesReadyPromise) {
        financeTablesReadyPromise = (async () => {
            await ensureTable('transacoes', [
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id BIGSERIAL PRIMARY KEY,
                    description VARCHAR(255) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    description VARCHAR(255) NOT NULL,
                    type VARCHAR(20) NOT NULL,
                    amount DECIMAL(12,2) NOT NULL,
                    igreja_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS transacoes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    description TEXT NOT NULL,
                    type TEXT NOT NULL,
                    amount REAL NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_transacoes_igreja ON transacoes (igreja_id)'
            ]);

            await ensureTable('caixa_saldo_inicial', [
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id BIGSERIAL PRIMARY KEY,
                    competencia VARCHAR(20) NOT NULL,
                    saldo_inicial DECIMAL(12,2) NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (igreja_id, competencia)
                )`,
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    competencia VARCHAR(20) NOT NULL,
                    saldo_inicial DECIMAL(12,2) NOT NULL,
                    igreja_id INT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_csi_igreja_comp (igreja_id, competencia)
                )`,
                `CREATE TABLE IF NOT EXISTS caixa_saldo_inicial (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    competencia TEXT NOT NULL,
                    saldo_inicial REAL NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (igreja_id, competencia)
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_csi_igreja_comp ON caixa_saldo_inicial (igreja_id, competencia)'
            ]);

            await ensureTable('dizimos', [
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    membro_id INTEGER,
                    membro_nome VARCHAR(255) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    competencia VARCHAR(20) NOT NULL,
                    tipo VARCHAR(30) NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    membro_id INT,
                    membro_nome VARCHAR(255) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    competencia VARCHAR(20) NOT NULL,
                    tipo VARCHAR(30) NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS dizimos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    membro_id INTEGER,
                    membro_nome TEXT NOT NULL,
                    valor REAL NOT NULL,
                    competencia TEXT NOT NULL,
                    tipo TEXT NOT NULL DEFAULT 'dizimo',
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_dizimos_igreja_comp ON dizimos (igreja_id, competencia)'
            ]);
        })();
    }

    await financeTablesReadyPromise;
}

async function getLatestSaldoInicial(igrejaId) {
    await ensureFinanceTables();

    const [[row]] = await pool.query(
        'SELECT saldo_inicial, competencia FROM caixa_saldo_inicial WHERE igreja_id = ? ORDER BY competencia DESC LIMIT 1',
        [igrejaId]
    );

    return row || null;
}

async function getTotais(igrejaId) {
    await ensureFinanceTables();

    const [[row]] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN type = 'entrada' THEN amount ELSE 0 END), 0) AS total_entradas,
            COALESCE(SUM(CASE WHEN type = 'saida' THEN amount ELSE 0 END), 0) AS total_saidas
         FROM transacoes
         WHERE igreja_id = ?`,
        [igrejaId]
    );

    return row;
}

async function listTransacoes(igrejaId) {
    await ensureFinanceTables();

    const [rows] = await pool.query(
        'SELECT * FROM transacoes WHERE igreja_id = ? ORDER BY id DESC LIMIT 200',
        [igrejaId]
    );

    return rows;
}

async function listTransacoesWithFilters(filters) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.tipo) {
        where.push('type = ?');
        values.push(filters.tipo);
    }

    if (filters.descricao) {
        where.push('description LIKE ?');
        values.push(`%${filters.descricao}%`);
    }

    if (filters.startDate) {
        where.push('DATE(created_at) >= ?');
        values.push(filters.startDate);
    }

    if (filters.endDate) {
        where.push('DATE(created_at) <= ?');
        values.push(filters.endDate);
    }

    const sortByMap = {
        id: 'id',
        created_at: 'created_at',
        amount: 'amount',
        description: 'description',
        type: 'type'
    };

    const sortBy = sortByMap[filters.sortBy] || 'id';
    const sortOrder = String(filters.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM transacoes
         WHERE ${where.join(' AND ')}`,
        values
    );

    const total = Number(countRows[0]?.total || 0);
    const limit = Number(filters.limit || 200);
    const page = Number(filters.page || 1);
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
        `SELECT *
         FROM transacoes
         WHERE ${where.join(' AND ')}
         ORDER BY ${sortBy} ${sortOrder}
         LIMIT ? OFFSET ?`,
        [...values, limit, offset]
    );

    return {
        items: rows,
        meta: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit))
        }
    };
}

async function createTransacao(payload) {
    await ensureFinanceTables();

    await pool.query(
        'INSERT INTO transacoes (description, type, amount, igreja_id) VALUES (?, ?, ?, ?)',
        [payload.descricao, payload.tipo, payload.amount, payload.igrejaId]
    );
}

async function upsertSaldoInicial(payload) {
    await ensureFinanceTables();

    await pool.query(
        `INSERT INTO caixa_saldo_inicial (competencia, saldo_inicial, igreja_id)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE saldo_inicial = VALUES(saldo_inicial)`,
        [payload.competencia, payload.saldoInicial, payload.igrejaId]
    );
}

// ─── Dízimos ────────────────────────────────────────────────────────────────

async function listDizimos(filters) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [filters.igrejaId];

    if (filters.competencia) {
        where.push('competencia = ?');
        values.push(filters.competencia);
    }

    if (filters.tipo) {
        where.push('tipo = ?');
        values.push(filters.tipo);
    }

    if (filters.membroNome) {
        where.push('membro_nome LIKE ?');
        values.push(`%${filters.membroNome}%`);
    }

    const limit = Math.min(Number(filters.limit || 100), 500);
    const page = Math.max(Number(filters.page || 1), 1);
    const offset = (page - 1) * limit;

    const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM dizimos WHERE ${where.join(' AND ')}`,
        values
    );

    await ensureColunasExtras('dizimos');
    const [rows] = await pool.query(
        `SELECT * FROM dizimos WHERE ${where.join(' AND ')}
         ORDER BY COALESCE(data_lancamento, created_at) DESC, id DESC LIMIT ? OFFSET ?`,
        [...values, limit, offset]
    );

    return {
        items: rows,
        meta: { page, limit, total: Number(countRow.total), totalPages: Math.max(1, Math.ceil(countRow.total / limit)) }
    };
}

async function getTotaisDizimos(igrejaId, competencia) {
    await ensureFinanceTables();

    const where = ['igreja_id = ?'];
    const values = [igrejaId];

    if (competencia) {
        where.push('competencia = ?');
        values.push(competencia);
    }

    const [[row]] = await pool.query(
        `SELECT
            COALESCE(SUM(valor), 0) AS total_geral,
            COALESCE(SUM(CASE WHEN tipo = 'dizimo' THEN valor ELSE 0 END), 0) AS total_dizimos,
            COALESCE(SUM(CASE WHEN tipo = 'oferta' THEN valor ELSE 0 END), 0) AS total_ofertas,
            COALESCE(SUM(CASE WHEN tipo = 'missoes' THEN valor ELSE 0 END), 0) AS total_missoes,
            COALESCE(SUM(CASE WHEN tipo = 'outros' THEN valor ELSE 0 END), 0) AS total_outros,
            COUNT(*) AS total_lancamentos
         FROM dizimos
         WHERE ${where.join(' AND ')}`,
        values
    );

    return row;
}

async function createDizimo(payload) {
    await ensureFinanceTables();
    await ensureColunasExtras('dizimos');

    const [result] = await pool.query(
        `INSERT INTO dizimos (igreja_id, membro_id, membro_nome, valor, competencia, tipo, observacao, created_by,
                              data_lancamento, tipo_receita_id, destino, destino_banco_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            payload.igrejaId,
            payload.membroId || null,
            payload.membroNome,
            payload.valor,
            payload.competencia,
            payload.tipo || 'dizimo',
            payload.observacao || null,
            payload.createdBy || null,
            payload.dataLancamento || null,
            payload.tipoReceitaId || null,
            payload.destino || null,
            payload.destinoBancoId || null
        ]
    );

    return result.insertId;
}

async function getDizimoById(id, igrejaId) {
    await ensureFinanceTables();
    await ensureColunasExtras('dizimos');
    const [rows] = await pool.query('SELECT * FROM dizimos WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    return rows[0] || null;
}

async function updateDizimo(id, igrejaId, payload) {
    await ensureFinanceTables();
    await ensureColunasExtras('dizimos');
    const [info] = await pool.query(
        `UPDATE dizimos SET membro_id = ?, membro_nome = ?, valor = ?, competencia = ?, tipo = ?, observacao = ?,
                data_lancamento = ?, tipo_receita_id = ?, destino = ?, destino_banco_id = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ? AND igreja_id = ?`,
        [
            payload.membroId || null, payload.membroNome, payload.valor, payload.competencia,
            payload.tipo || 'dizimo', payload.observacao || null, payload.dataLancamento || null,
            payload.tipoReceitaId || null, payload.destino || null, payload.destinoBancoId || null,
            id, igrejaId
        ]
    );
    return info.affectedRows;
}

// Cartões do topo: total e quantidade da competência + total do ano dela
async function getResumoDizimos(igrejaId, competencia) {
    await ensureFinanceTables();
    const ano = String(competencia).slice(3);
    const [[mes]] = await pool.query(
        'SELECT COALESCE(SUM(valor), 0) AS total, COUNT(*) AS qtd FROM dizimos WHERE igreja_id = ? AND competencia = ?',
        [igrejaId, competencia]
    );
    const [[doAno]] = await pool.query(
        'SELECT COALESCE(SUM(valor), 0) AS total FROM dizimos WHERE igreja_id = ? AND competencia LIKE ?',
        [igrejaId, `%/${ano}`]
    );
    return { totalMes: Number(mes.total), lancamentosMes: Number(mes.qtd), totalAno: Number(doAno.total), ano: Number(ano) };
}

async function deleteDizimo(id, igrejaId) {
    await ensureFinanceTables();

    const [info] = await pool.query('DELETE FROM dizimos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return info.affectedRows;
}

// ─── Tipos de Receita ──────────────────────────────────────────────────────

async function ensureTiposReceitaTable() {
    await pool.query(
        `CREATE TABLE IF NOT EXISTS tipos_receita (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            descricao VARCHAR(255) NOT NULL,
            plano_conta VARCHAR(255) NOT NULL,
            origem VARCHAR(20) NOT NULL DEFAULT 'custom',
            ativo INTEGER NOT NULL DEFAULT 1,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    await ensureColunasExtras('tipos_receita');
}

const igrejasComBase = new Set();

async function ensureBaseTiposReceita(igrejaId) {
    await ensureTiposReceitaTable();
    if (igrejasComBase.has(Number(igrejaId))) return;

    for (const item of BASE_TIPOS_RECEITA) {
        // linhas criadas antes desta versão não tinham natureza/público
        await pool.query(
            `UPDATE tipos_receita SET natureza = ?, publico = ?
             WHERE igreja_id = ? AND origem = 'base' AND descricao = ? AND natureza IS NULL`,
            [item.natureza, item.publico, igrejaId, item.descricao]
        );
        const [rows] = await pool.query(
            `SELECT id
             FROM tipos_receita
             WHERE igreja_id = ? AND origem = 'base' AND descricao = ?
             LIMIT 1`,
            [igrejaId, item.descricao]
        );

        if (rows[0]) {
            continue;
        }

        await pool.query(
            `INSERT INTO tipos_receita (id, igreja_id, descricao, plano_conta, origem, ativo, natureza, publico)
             VALUES (?, ?, ?, ?, 'base', 1, ?, ?)`,
            [`base-${igrejaId}-${item.slug}`, igrejaId, item.descricao, item.planoConta, item.natureza, item.publico]
        );
    }
    igrejasComBase.add(Number(igrejaId));
}

async function listTiposReceita(filters) {
    await ensureBaseTiposReceita(filters.igrejaId);

    const where = ['igreja_id = ?', 'ativo = 1'];
    const values = [filters.igrejaId];

    if (filters.search) {
        where.push('(descricao LIKE ? OR plano_conta LIKE ?)');
        values.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const [rows] = await pool.query(
        `SELECT id, igreja_id, descricao, plano_conta, origem, ativo, natureza, publico, created_by, created_at
         FROM tipos_receita
         WHERE ${where.join(' AND ')}
         ORDER BY CASE WHEN origem = 'base' THEN 0 ELSE 1 END, descricao ASC`,
        values
    );

    return rows;
}

async function findTipoReceitaById(id, igrejaId) {
    await ensureTiposReceitaTable();
    const [rows] = await pool.query(
        `SELECT id, igreja_id, descricao, plano_conta, origem, ativo, natureza, publico, created_by, created_at
         FROM tipos_receita
         WHERE id = ? AND igreja_id = ?
         LIMIT 1`,
        [id, igrejaId]
    );

    return rows[0] || null;
}

async function createTipoReceita(payload) {
    await ensureTiposReceitaTable();
    const id = `custom-${payload.igrejaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await pool.query(
        `INSERT INTO tipos_receita (id, igreja_id, descricao, plano_conta, origem, ativo, created_by, natureza, publico)
         VALUES (?, ?, ?, ?, 'custom', 1, ?, ?, ?)`,
        [id, payload.igrejaId, payload.descricao, payload.planoConta, payload.createdBy || null,
            payload.natureza || null, payload.publico || null]
    );

    return id;
}

async function updateTipoReceita(id, igrejaId, payload) {
    await ensureTiposReceitaTable();
    await pool.query(
        // Tipos padrão: só a conta contábil muda (nome, natureza e público ficam fixos)
        `UPDATE tipos_receita
         SET descricao = CASE WHEN origem = 'base' THEN descricao ELSE ? END,
             natureza  = CASE WHEN origem = 'base' THEN natureza ELSE ? END,
             publico   = CASE WHEN origem = 'base' THEN publico ELSE ? END,
             plano_conta = ?
         WHERE id = ? AND igreja_id = ?`,
        [payload.descricao, payload.natureza || null, payload.publico || null, payload.planoConta, id, igrejaId]
    );
}

async function deleteTipoReceita(id, igrejaId) {
    await ensureTiposReceitaTable();
    await pool.query(
        `UPDATE tipos_receita
         SET ativo = 0
         WHERE id = ? AND igreja_id = ? AND origem = 'custom'`,
        [id, igrejaId]
    );
}

// ─── Caixa ────────────────────────────────────────────────────────────────────

async function ensureCaixaTables() {
    await ensureTable('caixa_meses', [
        `CREATE TABLE IF NOT EXISTS caixa_meses (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id INT NOT NULL,
            mes_competencia VARCHAR(7) NOT NULL,
            saldo_inicial DECIMAL(14,2) DEFAULT 0,
            observacao TEXT NULL,
            ativo TINYINT(1) DEFAULT 1,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY uq_caixa_mes (igreja_id, mes_competencia),
            INDEX idx_caixa_mes_igreja (igreja_id)
        )`,
        `CREATE TABLE IF NOT EXISTS caixa_meses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            igreja_id INTEGER NOT NULL,
            mes_competencia TEXT NOT NULL,
            saldo_inicial REAL DEFAULT 0,
            observacao TEXT,
            ativo INTEGER DEFAULT 1,
            atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (igreja_id, mes_competencia)
        )`
    ]);

    await ensureTable('caixa_lancamentos', [
        `CREATE TABLE IF NOT EXISTS caixa_lancamentos (
            id INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id INT NOT NULL,
            data DATE NULL,
            doc VARCHAR(50) NULL,
            historico VARCHAR(500) NOT NULL,
            valor DECIMAL(14,2) NOT NULL DEFAULT 0,
            tipo VARCHAR(10) NOT NULL DEFAULT 'ENTRADA',
            observacao TEXT NULL,
            created_by INT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_caixa_lanc_igreja (igreja_id),
            INDEX idx_caixa_lanc_data (data)
        )`,
        `CREATE TABLE IF NOT EXISTS caixa_lancamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            igreja_id INTEGER NOT NULL,
            data TEXT,
            doc TEXT,
            historico TEXT NOT NULL,
            valor REAL NOT NULL DEFAULT 0,
            tipo TEXT NOT NULL DEFAULT 'ENTRADA',
            observacao TEXT,
            created_by INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`
    ]);

    // Lote 5: centro de custo / fornecedor no lançamento do caixa
    await cadastrosTesouraria.ensureTabelas();
    await cadastrosTesouraria.ensureColunas('caixa_lancamentos');
}

async function getCaixaMes(igrejaId, mesCompetencia) {
    await ensureCaixaTables();
    const mes = mesCompetencia || new Date().toISOString().slice(0, 7);
    const [rows] = await pool.query(
        'SELECT * FROM caixa_meses WHERE igreja_id = ? AND mes_competencia = ? LIMIT 1',
        [igrejaId, mes]
    );
    return rows[0] || null;
}

async function upsertCaixaMes(igrejaId, { mesCompetencia, saldoInicial, observacao }) {
    await ensureCaixaTables();
    const existing = await getCaixaMes(igrejaId, mesCompetencia);
    if (existing) {
        await pool.query(
            `UPDATE caixa_meses SET saldo_inicial=?, observacao=?, ativo=1, atualizado_em=NOW() WHERE id=?`,
            [saldoInicial || 0, observacao || null, existing.id]
        );
        return existing.id;
    }
    const [{ insertId }] = await pool.query(
        'INSERT INTO caixa_meses (igreja_id, mes_competencia, saldo_inicial, observacao) VALUES (?, ?, ?, ?)',
        [igrejaId, mesCompetencia, saldoInicial || 0, observacao || null]
    );
    return insertId;
}

async function getCaixaResumo(igrejaId, mes) {
    await ensureCaixaTables();
    const mesRef = mes || new Date().toISOString().slice(0, 7);
    const inicio = mesRef + '-01';
    const fimDate = new Date(mesRef + '-01');
    fimDate.setMonth(fimDate.getMonth() + 1);
    const fim = fimDate.toISOString().slice(0, 10);

    const [mesRows] = await pool.query(
        'SELECT * FROM caixa_meses WHERE igreja_id = ? AND mes_competencia = ? LIMIT 1',
        [igrejaId, mesRef]
    );
    const mesData = mesRows[0] || null;
    const saldoInicial = Number(mesData?.saldo_inicial || 0);

    const [totais] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN tipo='SAIDA' THEN valor ELSE 0 END), 0) AS saidas
         FROM caixa_lancamentos
         WHERE igreja_id = ? AND data >= ? AND data < ?`,
        [igrejaId, inicio, fim]
    );
    const t = totais[0] || { entradas: 0, saidas: 0 };
    const entradasMes = Number(t.entradas);
    const saidasMes = Number(t.saidas);
    const saldoMes = saldoInicial + entradasMes - saidasMes;

    return {
        mesCompetencia: mesRef,
        ativo: !!mesData,
        saldoInicial,
        entradasMes,
        saidasMes,
        saldoMes,
        saldoAtual: saldoMes,
        entradasPeriodo: entradasMes,
        saidasPeriodo: saidasMes,
        atualizadoEm: mesData ? String(mesData.atualizado_em || '').slice(0, 10) : null
    };
}

async function listCaixaLancamentos(igrejaId, { page = 1, limit = 50, inicio, fim, tipo, busca }) {
    await ensureCaixaTables();
    const pageNum = Number(page) || 1;
    const limitNum = Number(limit) || 50;
    const offset = (pageNum - 1) * limitNum;
    const where = ['igreja_id = ?'];
    const params = [igrejaId];

    if (inicio) { where.push('data >= ?'); params.push(inicio); }
    if (fim) { where.push('data <= ?'); params.push(fim); }
    if (tipo) { where.push('tipo = ?'); params.push(tipo.toUpperCase()); }
    if (busca) { where.push('historico LIKE ?'); params.push(`%${busca}%`); }

    const whereStr = where.join(' AND ');
    const [[countRow]] = await pool.query(
        `SELECT COUNT(*) AS total FROM caixa_lancamentos WHERE ${whereStr}`,
        [...params]
    );
    const total = Number(countRow?.total || 0);

    const [items] = await pool.query(
        `SELECT cl.*,
                (SELECT cc.nome FROM centros_custo cc WHERE cc.id = cl.centro_custo_id AND cc.igreja_id = cl.igreja_id) AS centro_custo_nome
         FROM caixa_lancamentos cl WHERE ${whereStr} ORDER BY data DESC, id DESC LIMIT ? OFFSET ?`,
        [...params, limitNum, offset]
    );

    return { items, meta: { page: pageNum, totalPages: Math.max(1, Math.ceil(total / limitNum)) } };
}

async function createCaixaLancamento(igrejaId, userId, { data, doc, historico, valor, tipo, observacao, centroCustoId, fornecedorId }) {
    await ensureCaixaTables();
    const [{ insertId }] = await pool.query(
        'INSERT INTO caixa_lancamentos (igreja_id, data, doc, historico, valor, tipo, observacao, created_by, centro_custo_id, fornecedor_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [igrejaId, data || null, doc || null, historico, valor, (tipo || 'ENTRADA').toUpperCase(), observacao || null, userId || null, centroCustoId || null, fornecedorId || null]
    );
    return insertId;
}

async function deleteCaixaLancamento(id, igrejaId) {
    await ensureCaixaTables();
    const [info] = await pool.query('DELETE FROM caixa_lancamentos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return info.affectedRows;
}

module.exports = {
    ensureFinanceTables,
    ensureCaixaTables,
    upsertSaldoInicial,
    createTransacao,
    getLatestSaldoInicial,
    getTotais,
    listTransacoesWithFilters,
    listTransacoes,
    createDizimo,
    deleteDizimo,
    getDizimoById,
    updateDizimo,
    getResumoDizimos,
    getTotaisDizimos,
    listDizimos,
    createTipoReceita,
    deleteTipoReceita,
    findTipoReceitaById,
    listTiposReceita,
    updateTipoReceita,
    getCaixaResumo,
    listCaixaLancamentos,
    createCaixaLancamento,
    deleteCaixaLancamento,
    upsertCaixaMes
};