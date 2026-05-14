const financeModel = require('../models/financeModel');

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
    const existing = await financeModel.findSaldoInicialByCompetencia(payload.igrejaId, payload.competencia);

    if (existing) {
        await financeModel.updateSaldoInicialById(existing.id, payload.saldoInicial);
        return;
    }

    await financeModel.createSaldoInicial(payload);
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

async function createDizimo(igrejaId, payload, userId) {
    const id = await financeModel.createDizimo({
        igrejaId,
        membroId: payload.membroId || null,
        membroNome: payload.membroNome,
        valor: Number(payload.valor),
        competencia: payload.competencia,
        tipo: payload.tipo || 'dizimo',
        observacao: payload.observacao || null,
        createdBy: userId
    });

    return id;
}

async function deleteDizimo(id, igrejaId) {
    await financeModel.deleteDizimo(id, igrejaId);
}

async function listTiposReceita(igrejaId, filters) {
    const rows = await financeModel.listTiposReceita({ igrejaId, search: filters.search || null });
    return rows.map(row => ({
        id: row.id,
        igrejaId: row.igreja_id,
        descricao: row.descricao,
        planoConta: row.plano_conta,
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

module.exports = {
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
    updateTipoReceita
};