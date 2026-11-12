'use strict';

/**
 * Lote 5 — Cadastros auxiliares da Tesouraria:
 * fornecedores, centros_custo, tipos_documento (+ colunas de vínculo).
 *
 * O SQL oficial está em INOVACOES_LOTE5_CADASTROS_TESOURARIA.sql.
 * ensureSchema() é uma rede de segurança: cria as tabelas/colunas se
 * o SQL ainda não tiver sido rodado (ignora "coluna duplicada").
 */

const { pool } = require('../config/db');

// ─── Schema ─────────────────────────────────────────────────────────────────

const TABELAS = {
    fornecedores: [
        `CREATE TABLE IF NOT EXISTS fornecedores (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL, nome VARCHAR(255) NOT NULL,
            cpf_cnpj VARCHAR(30) NULL, telefone VARCHAR(60) NULL, email VARCHAR(255) NULL,
            endereco VARCHAR(255) NULL, cidade VARCHAR(120) NULL, observacao TEXT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1, created_by INT NULL, created_at DATETIME NULL,
            INDEX idx_fornecedores_igreja (igreja_id)
        )`,
        `CREATE TABLE IF NOT EXISTS fornecedores (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, nome TEXT NOT NULL,
            cpf_cnpj TEXT, telefone TEXT, email TEXT, endereco TEXT, cidade TEXT, observacao TEXT,
            ativo INTEGER NOT NULL DEFAULT 1, created_by INTEGER, created_at TEXT
        )`
    ],
    centros_custo: [
        `CREATE TABLE IF NOT EXISTS centros_custo (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL, codigo VARCHAR(30) NULL,
            nome VARCHAR(150) NOT NULL, descricao VARCHAR(255) NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1, created_by INT NULL, created_at DATETIME NULL,
            INDEX idx_centros_custo_igreja (igreja_id)
        )`,
        `CREATE TABLE IF NOT EXISTS centros_custo (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, codigo TEXT, nome TEXT NOT NULL,
            descricao TEXT, ativo INTEGER NOT NULL DEFAULT 1, created_by INTEGER, created_at TEXT
        )`
    ],
    tipos_documento: [
        `CREATE TABLE IF NOT EXISTS tipos_documento (
            id INT AUTO_INCREMENT PRIMARY KEY, igreja_id INT NOT NULL, nome VARCHAR(100) NOT NULL,
            ativo TINYINT(1) NOT NULL DEFAULT 1, created_by INT NULL, created_at DATETIME NULL,
            INDEX idx_tipos_documento_igreja (igreja_id)
        )`,
        `CREATE TABLE IF NOT EXISTS tipos_documento (
            id INTEGER PRIMARY KEY AUTOINCREMENT, igreja_id INTEGER NOT NULL, nome TEXT NOT NULL,
            ativo INTEGER NOT NULL DEFAULT 1, created_by INTEGER, created_at TEXT
        )`
    ]
};

const COLUNAS = [
    ['contas_pagar', 'fornecedor_id', 'INT NULL'],
    ['contas_pagar', 'centro_custo_id', 'INT NULL'],
    ['contas_pagar', 'tipo_documento_id', 'INT NULL'],
    ['contas_pagar', 'numero_documento', 'VARCHAR(60) NULL'],
    ['caixa_lancamentos', 'centro_custo_id', 'INT NULL'],
    ['caixa_lancamentos', 'fornecedor_id', 'INT NULL'],
    ['banco_lancamentos', 'centro_custo_id', 'INT NULL'],
    ['banco_lancamentos', 'fornecedor_id', 'INT NULL']
];

const tabelasProntas = new Set();
const colunasProntas = new Set();
const RE_DUPLICADA = /duplicate column|already exists/i;

async function ensureTabelas() {
    for (const [nome, ddls] of Object.entries(TABELAS)) {
        if (tabelasProntas.has(nome)) continue;
        let ultimoErro = null;
        for (const ddl of ddls) {
            try { await pool.query(ddl); tabelasProntas.add(nome); ultimoErro = null; break; } catch (e) { ultimoErro = e; }
        }
        if (ultimoErro) throw ultimoErro;
    }
}

/** Garante as colunas de vínculo de UMA tabela (chamar depois que a tabela existir). */
async function ensureColunas(tabela) {
    for (const [t, col, tipo] of COLUNAS) {
        if (t !== tabela) continue;
        const k = `${t}.${col}`;
        if (colunasProntas.has(k)) continue;
        try {
            await pool.query(`ALTER TABLE ${t} ADD COLUMN ${col} ${tipo}`);
            colunasProntas.add(k);
        } catch (e) {
            if (RE_DUPLICADA.test(String(e && e.message))) colunasProntas.add(k);
            // outro erro (ex.: tabela ainda não existe): tenta de novo na próxima chamada
        }
    }
}

// ─── CRUD genérico ──────────────────────────────────────────────────────────

const RECURSOS = {
    fornecedores: {
        tabela: 'fornecedores',
        campos: ['nome', 'cpf_cnpj', 'telefone', 'email', 'endereco', 'cidade', 'observacao'],
        ordem: 'nome'
    },
    'centros-custo': {
        tabela: 'centros_custo',
        campos: ['codigo', 'nome', 'descricao'],
        ordem: 'codigo, nome'
    },
    'tipos-documento': {
        tabela: 'tipos_documento',
        campos: ['nome'],
        ordem: 'nome'
    }
};

function recurso(nome) {
    const r = RECURSOS[nome];
    if (!r) throw Object.assign(new Error('Cadastro inválido.'), { status: 404 });
    return r;
}

async function listar(nome, igrejaId, { todos = false } = {}) {
    await ensureTabelas();
    const r = recurso(nome);
    const [rows] = await pool.query(
        `SELECT * FROM ${r.tabela} WHERE igreja_id = ?${todos ? '' : ' AND ativo = 1'} ORDER BY ativo DESC, ${r.ordem}`,
        [igrejaId]
    );
    return rows;
}

async function obter(nome, id, igrejaId) {
    await ensureTabelas();
    const r = recurso(nome);
    const [rows] = await pool.query(`SELECT * FROM ${r.tabela} WHERE id = ? AND igreja_id = ?`, [id, igrejaId]);
    return rows[0] || null;
}

async function criar(nome, igrejaId, dados, userId) {
    await ensureTabelas();
    const r = recurso(nome);
    const cols = r.campos.filter((c) => dados[c] !== undefined);
    const [res] = await pool.query(
        `INSERT INTO ${r.tabela} (igreja_id, ${cols.join(', ')}, ativo, created_by, created_at) VALUES (?, ${cols.map(() => '?').join(', ')}, 1, ?, ?)`,
        [igrejaId, ...cols.map((c) => (dados[c] === '' ? null : dados[c])), userId || null, new Date()]
    );
    return res.insertId;
}

async function atualizar(nome, id, igrejaId, dados) {
    await ensureTabelas();
    const r = recurso(nome);
    const cols = r.campos.filter((c) => dados[c] !== undefined);
    const sets = cols.map((c) => `${c} = ?`);
    const params = cols.map((c) => (dados[c] === '' ? null : dados[c]));
    if (dados.ativo !== undefined) { sets.push('ativo = ?'); params.push(dados.ativo ? 1 : 0); }
    if (!sets.length) return 0;
    const [res] = await pool.query(`UPDATE ${r.tabela} SET ${sets.join(', ')} WHERE id = ? AND igreja_id = ?`, [...params, id, igrejaId]);
    return res.affectedRows;
}

/** Desativa (não apaga) para não quebrar lançamentos antigos que apontam para o registro. */
async function desativar(nome, id, igrejaId) {
    return atualizar(nome, id, igrejaId, { ativo: false });
}

/**
 * Garante que os IDs informados pertencem à igreja (isolamento multi-tenant).
 * Retorna { fornecedor, centroCusto, tipoDocumento } com os registros encontrados.
 */
async function validarVinculos(igrejaId, { fornecedorId, centroCustoId, tipoDocumentoId } = {}) {
    const out = {};
    const checar = async (nomeRecurso, id, rotulo, chave) => {
        if (id === undefined || id === null || id === '') return;
        const reg = await obter(nomeRecurso, Number(id), igrejaId);
        if (!reg) throw Object.assign(new Error(`${rotulo} não encontrado.`), { status: 400 });
        out[chave] = reg;
    };
    await checar('fornecedores', fornecedorId, 'Fornecedor', 'fornecedor');
    await checar('centros-custo', centroCustoId, 'Centro de custo', 'centroCusto');
    await checar('tipos-documento', tipoDocumentoId, 'Tipo de documento', 'tipoDocumento');
    return out;
}

module.exports = {
    RECURSOS,
    ensureTabelas,
    ensureColunas,
    listar,
    obter,
    criar,
    atualizar,
    desativar,
    validarVinculos
};
