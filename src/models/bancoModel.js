const { pool } = require('../config/db');
const { ensureTable } = require('./tableEnsure');
const cadastrosTesouraria = require('./cadastrosTesourariaModel');

let bancoTablesReadyPromise = null;

// Colunas do cadastro novo (conta corrente / aplicação / cartão) e dos lançamentos
const COLUNAS_EXTRAS = [
    ['banco_contas', 'banco_codigo', 'VARCHAR(10) NULL'],
    ['banco_contas', 'digito', 'VARCHAR(5) NULL'],
    ['banco_contas', 'final_cartao', 'VARCHAR(4) NULL'],
    ['banco_contas', 'saldo_data', 'DATE NULL'],
    ['banco_contas', 'conta_contabil', 'VARCHAR(255) NULL'],
    ['banco_contas', 'compartilhado', 'TINYINT(1) NOT NULL DEFAULT 0'],
    ['banco_lancamentos', 'doc', 'VARCHAR(50) NULL'],
    ['banco_lancamentos', 'conta_contabil', 'VARCHAR(255) NULL'],
    ['banco_lancamentos', 'origem', 'VARCHAR(20) NULL'],
    ['banco_lancamentos', 'origem_id', 'INT NULL'],
    ['banco_lancamentos', 'atualizado_em', 'DATETIME NULL']
];
let colunasProntas = false;

async function ensureColunasExtras() {
    if (colunasProntas) return;
    for (const [tabela, col, tipo] of COLUNAS_EXTRAS) {
        try {
            await pool.query(`ALTER TABLE ${tabela} ADD COLUMN ${col} ${tipo}`);
        } catch (e) {
            if (!/duplicate column|already exists/i.test(String(e && e.message))) throw e;
        }
    }
    colunasProntas = true;
}

async function ensureBancoTables() {
    if (!bancoTablesReadyPromise) {
        bancoTablesReadyPromise = (async () => {
            await ensureTable('banco_contas', [
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id BIGSERIAL PRIMARY KEY,
                    igreja_id INTEGER NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    banco VARCHAR(255),
                    agencia VARCHAR(120),
                    conta VARCHAR(120),
                    tipo VARCHAR(50) NOT NULL DEFAULT 'corrente',
                    saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo SMALLINT NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    igreja_id INT NOT NULL,
                    nome VARCHAR(255) NOT NULL,
                    banco VARCHAR(255),
                    agencia VARCHAR(120),
                    conta VARCHAR(120),
                    tipo VARCHAR(50) NOT NULL DEFAULT 'corrente',
                    saldo_inicial DECIMAL(12,2) NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo TINYINT(1) NOT NULL DEFAULT 1,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_contas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igreja_id INTEGER NOT NULL,
                    nome TEXT NOT NULL,
                    banco TEXT,
                    agencia TEXT,
                    conta TEXT,
                    tipo TEXT NOT NULL DEFAULT 'corrente',
                    saldo_inicial REAL NOT NULL DEFAULT 0,
                    observacao TEXT,
                    ativo INTEGER NOT NULL DEFAULT 1,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_banco_contas_igreja ON banco_contas (igreja_id)'
            ]);

            await ensureTable('banco_lancamentos', [
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id BIGSERIAL PRIMARY KEY,
                    conta_id INTEGER NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    descricao VARCHAR(255) NOT NULL,
                    tipo VARCHAR(30) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    data_lancamento DATE NOT NULL,
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    conta_id INT NOT NULL,
                    igreja_id INT NOT NULL,
                    descricao VARCHAR(255) NOT NULL,
                    tipo VARCHAR(30) NOT NULL,
                    valor DECIMAL(12,2) NOT NULL,
                    data_lancamento DATE NOT NULL,
                    observacao TEXT,
                    created_by INT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS banco_lancamentos (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    conta_id INTEGER NOT NULL,
                    igreja_id INTEGER NOT NULL,
                    descricao TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    valor REAL NOT NULL,
                    data_lancamento TEXT NOT NULL,
                    observacao TEXT,
                    created_by INTEGER,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )`
            ], [
                'CREATE INDEX IF NOT EXISTS idx_banco_lancamentos_igreja_conta ON banco_lancamentos (igreja_id, conta_id)'
            ]);
        })();
    }

    await bancoTablesReadyPromise;
    // Lote 5: centro de custo / fornecedor no lançamento bancário
    await cadastrosTesouraria.ensureTabelas();
    await cadastrosTesouraria.ensureColunas('banco_lancamentos');
    await ensureColunasExtras();
}

async function listContas(igrejaId) {
    await ensureBancoTables();

    const [rows] = await pool.query(
        `SELECT * FROM banco_contas WHERE igreja_id = ? ORDER BY nome`,
        [igrejaId]
    );

    return rows;
}

async function getConta(id, igrejaId) {
    await ensureBancoTables();

    const [[row]] = await pool.query(
        `SELECT * FROM banco_contas WHERE id = ? AND igreja_id = ?`,
        [id, igrejaId]
    );

    return row || null;
}

async function createConta(payload) {
    await ensureBancoTables();

    const { igrejaId, nome, banco, agencia, conta, tipo, saldoInicial, observacao, createdBy } = payload;
    const [result] = await pool.query(
        `INSERT INTO banco_contas
            (igreja_id, nome, banco, agencia, conta, tipo, saldo_inicial, observacao, created_by,
             banco_codigo, digito, final_cartao, saldo_data, conta_contabil, compartilhado)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, nome, banco || null, agencia || null, conta || null, tipo || 'corrente', saldoInicial || 0, observacao || null, createdBy || null,
            payload.bancoCodigo || null, payload.digito || null, payload.finalCartao || null, payload.saldoData || null,
            payload.contaContabil || null, payload.compartilhado ? 1 : 0]
    );

    return result.insertId;
}

async function updateConta(id, igrejaId, payload) {
    await ensureBancoTables();

    const { nome, banco, agencia, conta, tipo, saldoInicial, observacao, ativo } = payload;
    // campos do cadastro novo: só mudam quando vierem (telas antigas não os enviam)
    const extras = [];
    const valores = [];
    const opcional = (col, chave, conv = (v) => v || null) => {
        if (payload[chave] !== undefined) { extras.push(`${col}=?`); valores.push(conv(payload[chave])); }
    };
    opcional('banco_codigo', 'bancoCodigo');
    opcional('digito', 'digito');
    opcional('final_cartao', 'finalCartao');
    opcional('saldo_data', 'saldoData');
    opcional('conta_contabil', 'contaContabil');
    opcional('compartilhado', 'compartilhado', (v) => (v ? 1 : 0));
    const [info] = await pool.query(
        `UPDATE banco_contas SET nome=?, banco=?, agencia=?, conta=?, tipo=?, saldo_inicial=?, observacao=?, ativo=?,
            ${extras.length ? extras.join(', ') + ',' : ''} updated_at=CURRENT_TIMESTAMP
         WHERE id=? AND igreja_id=?`,
        [nome, banco || null, agencia || null, conta || null, tipo || 'corrente', saldoInicial || 0, observacao || null,
            ativo !== undefined ? (ativo ? 1 : 0) : 1, ...valores, id, igrejaId]
    );
    return info.affectedRows;
}

async function deleteConta(id, igrejaId) {
    await ensureBancoTables();

    const [info] = await pool.query(`DELETE FROM banco_contas WHERE id=? AND igreja_id=?`, [id, igrejaId]);
    return info.affectedRows;
}

// ─── Lançamentos ─────────────────────────────────────────────────────────────

async function listLancamentos(contaId, igrejaId) {
    await ensureBancoTables();

    const [rows] = await pool.query(
        `SELECT bl.*, bc.nome AS conta_nome, cc.nome AS centro_custo_nome
         FROM banco_lancamentos bl
         JOIN banco_contas bc ON bc.id = bl.conta_id AND bc.igreja_id = bl.igreja_id
         LEFT JOIN centros_custo cc ON cc.id = bl.centro_custo_id AND cc.igreja_id = bl.igreja_id
         WHERE bl.conta_id = ? AND bl.igreja_id = ?
         ORDER BY bl.data_lancamento DESC, bl.id DESC`,
        [contaId, igrejaId]
    );
    return rows;
}

async function createLancamento(payload) {
    await ensureBancoTables();

    const { contaId, igrejaId, descricao, tipo, valor, dataLancamento, observacao, createdBy, centroCustoId, fornecedorId } = payload;
    const [result] = await pool.query(
        `INSERT INTO banco_lancamentos (conta_id, igreja_id, descricao, tipo, valor, data_lancamento, observacao, created_by, centro_custo_id, fornecedor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [contaId, igrejaId, descricao, tipo, valor, dataLancamento, observacao || null, createdBy || null, centroCustoId || null, fornecedorId || null]
    );
    return result.insertId;
}

async function deleteLancamento(id, igrejaId) {
    await ensureBancoTables();

    const [info] = await pool.query(`DELETE FROM banco_lancamentos WHERE id = ? AND igreja_id = ?`, [id, igrejaId]);
    return info.affectedRows;
}

async function getSaldoConta(contaId, igrejaId) {
    await ensureBancoTables();

    const [[conta]] = await pool.query(
        `SELECT saldo_inicial FROM banco_contas WHERE id = ? AND igreja_id = ?`,
        [contaId, igrejaId]
    );
    if (!conta) return null;
    const [[totais]] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo='entrada' THEN valor ELSE 0 END),0) AS total_entrada,
            COALESCE(SUM(CASE WHEN tipo='saida'   THEN valor ELSE 0 END),0) AS total_saida
         FROM banco_lancamentos WHERE conta_id = ? AND igreja_id = ?`,
        [contaId, igrejaId]
    );
    return Number(conta.saldo_inicial) + Number(totais.total_entrada) - Number(totais.total_saida);
}

// O driver MySQL devolve DATE como Date na hora local do servidor: normaliza para 'AAAA-MM-DD'
function isoData(v) {
    if (!v) return null;
    if (v instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
}

const CAMPOS_LANC = `id, conta_id, data_lancamento, doc, descricao, tipo, valor, conta_contabil, origem, origem_id,
    observacao, centro_custo_id, fornecedor_id, created_at`;
const normalizarLanc = (r) => (r ? { ...r, data_lancamento: isoData(r.data_lancamento), valor: Number(r.valor) } : r);

async function somar(contaId, igrejaId, cond, params) {
    const [[t]] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN LOWER(tipo) = 'entrada' THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN LOWER(tipo) = 'saida' THEN valor ELSE 0 END), 0) AS saidas
         FROM banco_lancamentos WHERE conta_id = ? AND igreja_id = ? AND ${cond}`,
        [contaId, igrejaId, ...params]
    );
    return { entradas: Number(t?.entradas || 0), saidas: Number(t?.saidas || 0) };
}

// Saldo anterior ao mês, créditos, débitos e saldo no fim do mês (mes = 'AAAA-MM')
async function resumoMes(contaId, igrejaId, mes) {
    await ensureBancoTables();
    const conta = await getConta(contaId, igrejaId);
    if (!conta) return null;
    const [a, m] = mes.split('-').map(Number);
    const inicio = `${mes}-01`;
    const fim = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
    const antes = await somar(contaId, igrejaId, 'data_lancamento < ?', [inicio]);
    const doMes = await somar(contaId, igrejaId, 'data_lancamento >= ? AND data_lancamento < ?', [inicio, fim]);
    const r2 = (n) => Math.round(n * 100) / 100;
    const saldoAnterior = r2(Number(conta.saldo_inicial || 0) + antes.entradas - antes.saidas);
    return {
        mes, inicio, fim,
        saldoAnterior,
        creditos: r2(doMes.entradas),
        debitos: r2(doMes.saidas),
        saldoAtual: r2(saldoAnterior + doMes.entradas - doMes.saidas)
    };
}

async function listLancamentosPaginado(contaId, igrejaId, { inicio, fim, tipo, busca, page = 1, limit = 20, ordem = 'data', desc = true }) {
    await ensureBancoTables();
    const where = ['conta_id = ?', 'igreja_id = ?'];
    const params = [contaId, igrejaId];
    if (inicio) { where.push('data_lancamento >= ?'); params.push(inicio); }
    if (fim) { where.push('data_lancamento < ?'); params.push(fim); }
    if (tipo) { where.push('LOWER(tipo) = ?'); params.push(String(tipo).toLowerCase()); }
    if (busca) {
        where.push('(descricao LIKE ? OR doc LIKE ? OR conta_contabil LIKE ?)');
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    const w = where.join(' AND ');
    const [[c]] = await pool.query(`SELECT COUNT(*) AS total FROM banco_lancamentos WHERE ${w}`, params);
    const total = Number(c?.total || 0);
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const pag = Math.max(Number(page) || 1, 1);
    const col = ordem === 'valor' ? 'valor' : 'data_lancamento';
    const dir = desc ? 'DESC' : 'ASC';
    const [rows] = await pool.query(
        `SELECT ${CAMPOS_LANC} FROM banco_lancamentos WHERE ${w} ORDER BY ${col} ${dir}, id ${dir} LIMIT ? OFFSET ?`,
        [...params, lim, (pag - 1) * lim]
    );
    return { items: rows.map(normalizarLanc), meta: { page: pag, limit: lim, total, totalPages: Math.max(1, Math.ceil(total / lim)) } };
}

async function getLancamento(id, igrejaId) {
    await ensureBancoTables();
    const [rows] = await pool.query(`SELECT ${CAMPOS_LANC} FROM banco_lancamentos WHERE id = ? AND igreja_id = ? LIMIT 1`, [id, igrejaId]);
    return normalizarLanc(rows[0]) || null;
}

async function inserirLancamento(igrejaId, userId, d) {
    await ensureBancoTables();
    const [r] = await pool.query(
        `INSERT INTO banco_lancamentos
            (conta_id, igreja_id, descricao, tipo, valor, data_lancamento, observacao, created_by,
             centro_custo_id, fornecedor_id, doc, conta_contabil, origem, origem_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [d.contaId, igrejaId, d.descricao, d.tipo, d.valor, d.dataLancamento, d.observacao || null, userId || null,
            d.centroCustoId || null, d.fornecedorId || null, d.doc || null, d.contaContabil || null, d.origem || null, d.origemId || null]
    );
    return r.insertId;
}

async function atualizarLancamento(id, igrejaId, d) {
    await ensureBancoTables();
    const [r] = await pool.query(
        `UPDATE banco_lancamentos
            SET conta_id = ?, descricao = ?, tipo = ?, valor = ?, data_lancamento = ?, observacao = ?, doc = ?,
                conta_contabil = ?, centro_custo_id = ?, fornecedor_id = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ? AND igreja_id = ?`,
        [d.contaId, d.descricao, d.tipo, d.valor, d.dataLancamento, d.observacao || null, d.doc || null,
            d.contaContabil || null, d.centroCustoId || null, d.fornecedorId || null, id, igrejaId]
    );
    return r.affectedRows;
}

// Lançamento automático ligado a outro registro (dízimo, transferência, caixa). dados = null remove.
async function sincronizarOrigem(igrejaId, origem, origemId, dados) {
    await ensureBancoTables();
    const [rows] = await pool.query(
        'SELECT id FROM banco_lancamentos WHERE igreja_id = ? AND origem = ? AND origem_id = ? LIMIT 1',
        [igrejaId, origem, origemId]
    );
    const existente = rows[0];
    if (!dados) {
        if (existente) await deleteLancamento(existente.id, igrejaId);
        return;
    }
    if (existente) await atualizarLancamento(existente.id, igrejaId, dados);
    else await inserirLancamento(igrejaId, dados.userId, { ...dados, origem, origemId });
}

async function contarUsoConta(contaId, igrejaId) {
    await ensureBancoTables();
    const [[l]] = await pool.query('SELECT COUNT(*) AS n FROM banco_lancamentos WHERE conta_id = ? AND igreja_id = ?', [contaId, igrejaId]);
    return Number(l?.n || 0);
}

// Conta bancária da igreja dona desta conta contábil (para transferências e pagamento de fatura)
async function findContaPorContabil(igrejaId, contaContabil) {
    if (!contaContabil) return null;
    await ensureBancoTables();
    const [rows] = await pool.query(
        'SELECT * FROM banco_contas WHERE igreja_id = ? AND conta_contabil = ? LIMIT 1',
        [igrejaId, String(contaContabil).trim()]
    );
    return rows[0] || null;
}

async function listContasContabeis(igrejaId) {
    await ensureBancoTables();
    const [rows] = await pool.query(
        'SELECT conta_contabil FROM banco_contas WHERE igreja_id = ? AND conta_contabil IS NOT NULL',
        [igrejaId]
    );
    return rows.map((r) => r.conta_contabil);
}

module.exports = {
    ensureBancoTables,
    isoData,
    resumoMes,
    listLancamentosPaginado,
    getLancamento,
    inserirLancamento,
    atualizarLancamento,
    sincronizarOrigem,
    contarUsoConta,
    findContaPorContabil,
    listContasContabeis,
    listContas,
    getConta,
    createConta,
    updateConta,
    deleteConta,
    listLancamentos,
    createLancamento,
    deleteLancamento,
    getSaldoConta
};
