const financeModel = require('../models/financeModel');
const bancoModel = require('../models/bancoModel');
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

async function getSaldo(igrejaId) {
    const saldoInicialRow = await financeModel.getLatestSaldoInicial(igrejaId);
    const totais = await financeModel.getTotais(igrejaId);

    const saldoInicial = Number(saldoInicialRow?.saldo_inicial || 0);
    const saldoFinal = saldoInicial + Number(totais.total_entradas || 0) - Number(totais.total_saidas || 0);

    return saldoFinal;
}

async function listTransacoes(igrejaId) {
    return financeModel.listTransacoes(igrejaId);
}

async function listTransacoesWithFilters(filters) {
    return financeModel.listTransacoesWithFilters(filters);
}

async function createTransacao(payload) {
    await financeModel.createTransacao(payload);
}

async function getSaldoInicial(igrejaId) {
    return financeModel.getLatestSaldoInicial(igrejaId);
}

async function upsertSaldoInicial(payload) {
    await financeModel.upsertSaldoInicial(payload);
}

// ─── Dízimos ────────────────────────────────────────────────────────────────

async function listDizimos(igrejaId, filters) {
    return financeModel.listDizimos({ igrejaId, ...filters });
}

async function getTotaisDizimos(igrejaId, competencia) {
    const row = await financeModel.getTotaisDizimos(igrejaId, competencia || null);
    return {
        totalGeral: Number(row.total_geral).toFixed(2),
        totalDizimos: Number(row.total_dizimos).toFixed(2),
        totalOfertas: Number(row.total_ofertas).toFixed(2),
        totalMissoes: Number(row.total_missoes).toFixed(2),
        totalOutros: Number(row.total_outros).toFixed(2),
        totalLancamentos: Number(row.total_lancamentos)
    };
}

// Confere que membro, conta bancária e tipo de receita são DESTA igreja e
// escolhe o tipo de receita automaticamente quando não vier (natureza + público).
async function prepararDizimo(igrejaId, payload) {
    const membroId = payload.membroId ? Number(payload.membroId) : null;
    if (membroId) {
        const [m] = await pool.query('SELECT id FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1', [membroId, igrejaId]);
        if (!m.length) throw createHttpError(400, 'Membro não encontrado nesta igreja.');
    }

    let destino = null;
    let destinoBancoId = null;
    if (payload.destino === 'caixa') {
        destino = 'caixa';
    } else if (payload.destino && payload.destino.startsWith('banco:')) {
        destinoBancoId = Number(payload.destino.slice(6));
        const conta = await bancoModel.getConta(destinoBancoId, igrejaId);
        if (!conta) throw createHttpError(400, 'Conta bancária de destino não encontrada.');
        destino = 'banco';
    }

    const tipo = payload.tipo || 'dizimo';
    let tipoReceitaId = payload.tipoReceitaId || null;
    if (tipoReceitaId) {
        const t = await financeModel.findTipoReceitaById(tipoReceitaId, igrejaId);
        if (!t) throw createHttpError(400, 'Tipo de receita não encontrado.');
    } else if (tipo !== 'outros') {
        const tipos = await financeModel.listTiposReceita({ igrejaId });
        const publico = membroId ? 'membro' : 'visitante';
        const achado = tipos.find((t) => t.natureza === tipo && t.publico === publico);
        tipoReceitaId = achado ? achado.id : null;
    }

    return {
        igrejaId,
        membroId,
        membroNome: payload.membroNome,
        valor: Number(payload.valor),
        competencia: payload.competencia,
        tipo,
        observacao: payload.observacao || null,
        dataLancamento: payload.dataLancamento || null,
        tipoReceitaId,
        destino,
        destinoBancoId
    };
}

async function createDizimo(igrejaId, payload, userId) {
    const dados = await prepararDizimo(igrejaId, payload);
    return financeModel.createDizimo({ ...dados, createdBy: userId });
}

async function updateDizimo(id, igrejaId, payload) {
    const dados = await prepararDizimo(igrejaId, payload);
    return financeModel.updateDizimo(id, igrejaId, dados);
}

async function getDizimo(id, igrejaId) {
    return financeModel.getDizimoById(id, igrejaId);
}

async function getResumoDizimos(igrejaId, competencia) {
    return financeModel.getResumoDizimos(igrejaId, competencia);
}

// Busca de membro para o lançamento: por nome ou pelo nº da ficha
// (o nº da ficha é o número do cadastro — o mesmo da carteirinha, ex.: #000123)
async function buscarMembrosDizimo(igrejaId, termo) {
    const q = String(termo || '').trim().replace(/^#/, '');
    if (!q) return [];
    const numerico = /^\d+$/.test(q);
    const [rows] = await pool.query(
        numerico
            ? 'SELECT id, nome, situacao FROM membros WHERE igreja_id = ? AND id = ? LIMIT 1'
            : 'SELECT id, nome, situacao FROM membros WHERE igreja_id = ? AND nome LIKE ? ORDER BY nome LIMIT 15',
        numerico ? [igrejaId, Number(q)] : [igrejaId, '%' + q + '%']
    );
    return rows.map((m) => ({ ...m, ficha: '#' + String(m.id).padStart(6, '0') }));
}

// Destinos possíveis do dinheiro: o caixa + as contas bancárias ativas da igreja
async function listDestinosDizimo(igrejaId) {
    const contas = await bancoModel.listContas(igrejaId).catch(() => []);
    return [
        { valor: 'caixa', rotulo: 'Caixa (dinheiro em espécie)' },
        ...(contas || [])
            .filter((c) => Number(c.ativo) !== 0)
            .map((c) => ({ valor: `banco:${c.id}`, rotulo: [c.nome, c.banco].filter(Boolean).join(' · ') }))
    ];
}

async function deleteDizimo(id, igrejaId) {
    return financeModel.deleteDizimo(id, igrejaId);
}

async function listTiposReceita(igrejaId, filters) {
    const rows = await financeModel.listTiposReceita({ igrejaId, search: filters.search || null });
    return rows.map(row => ({
        id: row.id,
        igrejaId: row.igreja_id,
        descricao: row.descricao,
        planoConta: row.plano_conta,
        natureza: row.natureza || null,
        publico: row.publico || null,
        origem: row.origem,
        ativo: Number(row.ativo) === 1,
        createdBy: row.created_by,
        createdAt: row.created_at
    }));
}

async function createTipoReceita(igrejaId, payload, userId) {
    return financeModel.createTipoReceita({
        igrejaId,
        descricao: payload.descricao,
        planoConta: payload.planoConta,
        natureza: payload.natureza || null,
        publico: payload.publico || null,
        createdBy: userId
    });
}

async function updateTipoReceita(id, igrejaId, payload) {
    return financeModel.updateTipoReceita(id, igrejaId, payload);
}

async function deleteTipoReceita(id, igrejaId) {
    return financeModel.deleteTipoReceita(id, igrejaId);
}

async function getTipoReceitaById(id, igrejaId) {
    const row = await financeModel.findTipoReceitaById(id, igrejaId);
    if (!row) {
        return null;
    }

    return {
        id: row.id,
        igrejaId: row.igreja_id,
        descricao: row.descricao,
        planoConta: row.plano_conta,
        origem: row.origem,
        ativo: Number(row.ativo) === 1,
        createdBy: row.created_by,
        createdAt: row.created_at
    };
}

// ─── Caixa ────────────────────────────────────────────────────────────────────

async function getCaixaResumo(igrejaId, mes) {
    return financeModel.getCaixaResumo(igrejaId, mes);
}

async function listCaixaLancamentos(igrejaId, filters) {
    return financeModel.listCaixaLancamentos(igrejaId, filters);
}

async function createCaixaLancamento(igrejaId, userId, payload) {
    return financeModel.createCaixaLancamento(igrejaId, userId, payload);
}

async function deleteCaixaLancamento(id, igrejaId) {
    return financeModel.deleteCaixaLancamento(id, igrejaId);
}

async function upsertCaixaMes(igrejaId, payload) {
    return financeModel.upsertCaixaMes(igrejaId, payload);
}

module.exports = {
    updateDizimo,
    getDizimo,
    getResumoDizimos,
    buscarMembrosDizimo,
    listDestinosDizimo,
    createTransacao,
    getSaldo,
    getSaldoInicial,
    listTransacoesWithFilters,
    listTransacoes,
    upsertSaldoInicial,
    createDizimo,
    deleteDizimo,
    getTotaisDizimos,
    listDizimos,
    createTipoReceita,
    deleteTipoReceita,
    getTipoReceitaById,
    listTiposReceita,
    updateTipoReceita,
    getCaixaResumo,
    listCaixaLancamentos,
    createCaixaLancamento,
    deleteCaixaLancamento,
    upsertCaixaMes
};