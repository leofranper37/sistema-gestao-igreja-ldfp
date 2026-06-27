const contasPagarModel = require('../models/contasPagarModel');

async function listContasPagar(igrejaId, filters) {
    await contasPagarModel.markVencidas(igrejaId);
    return contasPagarModel.listContasPagar(igrejaId, filters);
}

async function getTotais(igrejaId) {
    await contasPagarModel.markVencidas(igrejaId);
    const row = await contasPagarModel.getTotaisContasPagar(igrejaId);
    return {
        totalAberto: Number(row.total_aberto).toFixed(2),
        totalPendente: Number(row.total_pendente).toFixed(2),
        totalVencido: Number(row.total_vencido).toFixed(2),
        totalPago: Number(row.total_pago).toFixed(2),
        totalRegistros: Number(row.total_registros)
    };
}

async function createContaPagar(igrejaId, payload, userId) {
    const id = await contasPagarModel.createContaPagar({
        igrejaId,
        descricao: payload.descricao,
        fornecedor: payload.fornecedor || null,
        valor: Number(payload.valor),
        vencimento: payload.vencimento,
        categoria: payload.categoria || null,
        observacao: payload.observacao || null,
        createdBy: userId
    });

    return id;
}

async function patchContaPagar(id, igrejaId, fields) {
    await contasPagarModel.patchContaPagar(id, igrejaId, fields);
}

async function deleteContaPagar(id, igrejaId) {
    await contasPagarModel.deleteContaPagar(id, igrejaId);
}

module.exports = {
    listContasPagar,
    getTotais,
    createContaPagar,
    patchContaPagar,
    deleteContaPagar
};
