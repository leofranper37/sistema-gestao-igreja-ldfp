// Caixa por competência (modelo: saldo inicial → competências em sequência)
//
// - A primeira linha de caixa_meses da igreja é a competência do saldo inicial.
// - A última linha é a competência ATIVA; "ativar" cria o mês seguinte.
// - Saldo anterior = saldo inicial + (entradas − saídas) de tudo antes da competência
//   ativa. É sempre calculado, nunca copiado: corrigir um lançamento antigo não
//   deixa saldo errado em lugar nenhum.
const { pool } = require('../config/db');
const exercicio = require('./exercicioContabilModel');

async function dataDoLancamento(id, igrejaId) {
    const [r] = await pool.query('SELECT data FROM caixa_lancamentos WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    return r[0] ? r[0].data : null;
}
const financeModel = require('./financeModel');

const COLUNAS = [
    ['conta_contabil', 'VARCHAR(255) NULL'],
    ['origem', 'VARCHAR(20) NULL'],
    ['origem_id', 'INT NULL'],
    ['atualizado_em', 'DATETIME NULL']
];
let colunasProntas = false;

async function ensure() {
    await financeModel.ensureCaixaTables();
    if (colunasProntas) return;
    for (const [col, tipo] of COLUNAS) {
        try {
            await pool.query(`ALTER TABLE caixa_lancamentos ADD COLUMN ${col} ${tipo}`);
        } catch (e) {
            if (!/duplicate column|already exists/i.test(String(e && e.message))) throw e;
        }
    }
    colunasProntas = true;
}

// 'AAAA-MM' → 'AAAA-MM' do mês seguinte
function mesSeguinte(mes) {
    const [a, m] = mes.split('-').map(Number);
    return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
}

function paraCompetencia(mes) {
    return mes ? `${mes.slice(5, 7)}/${mes.slice(0, 4)}` : null;
}

function mesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function listMeses(igrejaId) {
    await ensure();
    const [rows] = await pool.query(
        'SELECT id, mes_competencia, saldo_inicial FROM caixa_meses WHERE igreja_id = ? ORDER BY mes_competencia ASC',
        [igrejaId]
    );
    return rows;
}

async function somar(igrejaId, cond, params) {
    const [rows] = await pool.query(
        `SELECT
            COALESCE(SUM(CASE WHEN UPPER(tipo) = 'ENTRADA' THEN valor ELSE 0 END), 0) AS entradas,
            COALESCE(SUM(CASE WHEN UPPER(tipo) = 'SAIDA' THEN valor ELSE 0 END), 0) AS saidas
         FROM caixa_lancamentos WHERE igreja_id = ? AND ${cond}`,
        [igrejaId, ...params]
    );
    return { entradas: Number(rows[0]?.entradas || 0), saidas: Number(rows[0]?.saidas || 0) };
}

const r2 = (n) => Math.round(n * 100) / 100;

// O driver MySQL devolve DATE como Date na hora local do servidor: normaliza para 'AAAA-MM-DD'
function isoData(v) {
    if (!v) return null;
    if (v instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
}
const normalizar = (row) => (row ? { ...row, data: isoData(row.data), valor: Number(row.valor) } : row);

async function getEstado(igrejaId) {
    const meses = await listMeses(igrejaId);
    if (!meses.length) {
        return { configurado: false, mesAtual: mesAtual() };
    }
    const primeira = String(meses[0].mes_competencia);
    const ativa = String(meses[meses.length - 1].mes_competencia);
    const proxima = mesSeguinte(ativa);
    const saldoInicial = Number(meses[0].saldo_inicial || 0);
    const inicio = `${ativa}-01`;
    const fim = `${proxima}-01`;

    const antes = await somar(igrejaId, 'data < ?', [inicio]);
    const doMes = await somar(igrejaId, 'data >= ? AND data < ?', [inicio, fim]);
    const saldoAnterior = r2(saldoInicial + antes.entradas - antes.saidas);

    return {
        configurado: true,
        mesAtual: mesAtual(),
        primeira,
        ativa,
        proxima,
        primeiraCompetencia: paraCompetencia(primeira),
        competenciaAtiva: paraCompetencia(ativa),
        proximaCompetencia: paraCompetencia(proxima),
        inicio,
        fim: `${proxima}-01`,
        saldoInicial: r2(saldoInicial),
        saldoAnterior,
        creditos: r2(doMes.entradas),
        debitos: r2(doMes.saidas),
        saldoAtual: r2(saldoAnterior + doMes.entradas - doMes.saidas),
        podeAtivar: proxima <= mesSeguinte(mesAtual())
    };
}

// Primeira vez: cria a competência inicial. Depois: só o valor pode mudar.
async function definirSaldoInicial(igrejaId, mes, valor) {
    const meses = await listMeses(igrejaId);
    if (!meses.length) {
        await pool.query(
            'INSERT INTO caixa_meses (igreja_id, mes_competencia, saldo_inicial, ativo) VALUES (?, ?, ?, 1)',
            [igrejaId, mes, valor]
        );
        return { criado: true };
    }
    if (String(meses[0].mes_competencia) !== mes) {
        return { conflito: String(meses[0].mes_competencia) };
    }
    await pool.query('UPDATE caixa_meses SET saldo_inicial = ? WHERE id = ? AND igreja_id = ?', [valor, meses[0].id, igrejaId]);
    return { criado: false };
}

async function ativarProxima(igrejaId, proxima) {
    await pool.query(
        'INSERT INTO caixa_meses (igreja_id, mes_competencia, saldo_inicial, ativo) VALUES (?, ?, 0, 1)',
        [igrejaId, proxima]
    );
}

// ── Lançamentos ─────────────────────────────────────────────────────────────

async function listLancamentos(igrejaId, { inicio, fim, tipo, busca, page = 1, limit = 20, ordem = 'data', desc = true }) {
    await ensure();
    const where = ['igreja_id = ?'];
    const params = [igrejaId];
    if (inicio) { where.push('data >= ?'); params.push(inicio); }
    if (fim) { where.push('data < ?'); params.push(fim); }
    if (tipo) { where.push('UPPER(tipo) = ?'); params.push(String(tipo).toUpperCase()); }
    if (busca) {
        where.push('(historico LIKE ? OR doc LIKE ? OR conta_contabil LIKE ?)');
        params.push(`%${busca}%`, `%${busca}%`, `%${busca}%`);
    }
    const w = where.join(' AND ');
    const [[c]] = await pool.query(`SELECT COUNT(*) AS total FROM caixa_lancamentos WHERE ${w}`, params);
    const total = Number(c?.total || 0);
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 200);
    const pag = Math.max(Number(page) || 1, 1);
    const col = ordem === 'valor' ? 'valor' : 'data';
    const dir = desc ? 'DESC' : 'ASC';
    const [items] = await pool.query(
        `SELECT id, data, doc, historico, valor, tipo, conta_contabil, origem, origem_id, observacao, created_at
         FROM caixa_lancamentos WHERE ${w}
         ORDER BY ${col} ${dir}, id ${dir} LIMIT ? OFFSET ?`,
        [...params, lim, (pag - 1) * lim]
    );
    return { items: items.map(normalizar), meta: { page: pag, limit: lim, total, totalPages: Math.max(1, Math.ceil(total / lim)) } };
}

async function getLancamento(id, igrejaId) {
    await ensure();
    const [rows] = await pool.query(
        `SELECT id, data, doc, historico, valor, tipo, conta_contabil, origem, origem_id, observacao, created_at
         FROM caixa_lancamentos WHERE id = ? AND igreja_id = ? LIMIT 1`,
        [id, igrejaId]
    );
    return normalizar(rows[0]) || null;
}

async function createLancamento(igrejaId, userId, d) {
    await ensure();
    await exercicio.exigirAberto(igrejaId, d.data);
    const [r] = await pool.query(
        `INSERT INTO caixa_lancamentos
            (igreja_id, data, doc, historico, valor, tipo, conta_contabil, observacao, origem, origem_id, centro_custo_id, fornecedor_id, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [igrejaId, d.data, d.doc || null, d.historico, d.valor, d.tipo, d.contaContabil || null,
            d.observacao || null, d.origem || null, d.origemId || null, d.centroCustoId || null, d.fornecedorId || null, userId || null]
    );
    return r.insertId;
}

async function updateLancamento(id, igrejaId, d) {
    await ensure();
    await exercicio.exigirAberto(igrejaId, d.data, await dataDoLancamento(id, igrejaId));
    const [r] = await pool.query(
        `UPDATE caixa_lancamentos
            SET data = ?, doc = ?, historico = ?, valor = ?, tipo = ?, conta_contabil = ?, observacao = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ? AND igreja_id = ?`,
        [d.data, d.doc || null, d.historico, d.valor, d.tipo, d.contaContabil || null, d.observacao || null, id, igrejaId]
    );
    return r.affectedRows;
}

async function deleteLancamento(id, igrejaId) {
    await ensure();
    await exercicio.exigirAberto(igrejaId, await dataDoLancamento(id, igrejaId));
    const [r] = await pool.query('DELETE FROM caixa_lancamentos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    return r.affectedRows;
}

// Lançamento automático ligado a outro registro (ex.: dízimo com destino "Caixa").
// dados = null remove o lançamento ligado.
async function sincronizarOrigem(igrejaId, origem, origemId, dados) {
    await ensure();
    const [rows] = await pool.query(
        'SELECT id FROM caixa_lancamentos WHERE igreja_id = ? AND origem = ? AND origem_id = ? LIMIT 1',
        [igrejaId, origem, origemId]
    );
    const existente = rows[0];
    if (!dados) {
        if (existente) await deleteLancamento(existente.id, igrejaId);
        return;
    }
    if (existente) {
        await updateLancamento(existente.id, igrejaId, dados);
    } else {
        await createLancamento(igrejaId, dados.userId, { ...dados, origem, origemId });
    }
}

module.exports = {
    ensure,
    listMeses,
    mesSeguinte,
    paraCompetencia,
    getEstado,
    definirSaldoInicial,
    ativarProxima,
    listLancamentos,
    getLancamento,
    createLancamento,
    updateLancamento,
    deleteLancamento,
    sincronizarOrigem
};
