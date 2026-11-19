const contasPagarModel = require('../models/contasPagarModel');
const lancamentoAuto = require('./lancamentoAutomaticoService');
const { createHttpError } = require('../utils/httpError');

const iso = (v) => {
    if (!v) return null;
    if (v instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
};
const normalizar = (c) => (c ? { ...c, valor: Number(c.valor), vencimento: iso(c.vencimento), data_pagamento: iso(c.data_pagamento) } : c);

async function getContaPagar(id, igrejaId) {
    await contasPagarModel.markVencidas(igrejaId);
    return normalizar(await contasPagarModel.getContaPagar(id, igrejaId));
}

async function exigirConta(id, igrejaId) {
    const c = await getContaPagar(id, igrejaId);
    if (!c) throw createHttpError(404, 'Conta não encontrada.');
    return c;
}

async function updateContaPagar(id, igrejaId, payload) {
    const c = await exigirConta(id, igrejaId);
    if (c.status === 'pago') throw createHttpError(409, 'Esta conta já foi paga. Estorne o pagamento para poder alterar.');
    await contasPagarModel.updateContaPagar(id, igrejaId, payload);
    await contasPagarModel.markVencidas(igrejaId);
}

// Paga a conta e lança a saída no caixa ou na conta bancária escolhida
async function pagar(id, igrejaId, { dataPagamento, pagoCom }, userId) {
    const c = await exigirConta(id, igrejaId);
    if (c.status === 'pago') throw createHttpError(409, 'Esta conta já está paga.');
    const destino = await lancamentoAuto.registrar(igrejaId, 'conta_pagar', id, {
        destino: pagoCom,
        data: dataPagamento,
        historico: [c.descricao, c.fornecedor].filter(Boolean).join(' - ').slice(0, 255),
        valor: c.valor,
        tipo: 'saida',
        contaContabil: c.categoria || null,
        doc: c.numero_documento || null,
        centroCustoId: c.centro_custo_id || null,
        fornecedorId: c.fornecedor_id || null,
        userId
    });
    await contasPagarModel.marcarPagamento(id, igrejaId, { status: 'pago', dataPagamento, pagoCom });
    return destino;
}

async function estornar(id, igrejaId) {
    const c = await exigirConta(id, igrejaId);
    if (c.status !== 'pago') throw createHttpError(409, 'Esta conta não está paga.');
    await lancamentoAuto.remover(igrejaId, 'conta_pagar', id);
    await contasPagarModel.marcarPagamento(id, igrejaId, { status: 'pendente', dataPagamento: null, pagoCom: null });
    await contasPagarModel.markVencidas(igrejaId);
}

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
        fornecedorId: payload.fornecedorId || null,
        centroCustoId: payload.centroCustoId || null,
        tipoDocumentoId: payload.tipoDocumentoId || null,
        numeroDocumento: payload.numeroDocumento || null,
        createdBy: userId
    });

    return id;
}

async function patchContaPagar(id, igrejaId, fields) {
    await contasPagarModel.patchContaPagar(id, igrejaId, fields);
}

async function deleteContaPagar(id, igrejaId) {
    const c = await getContaPagar(id, igrejaId);
    if (c && c.status === 'pago' && c.pago_com) {
        throw createHttpError(409, 'Esta conta já foi paga e lançada no caixa/banco. Estorne o pagamento antes de excluir.');
    }
    return contasPagarModel.deleteContaPagar(id, igrejaId);
}

module.exports = {
    getContaPagar,
    updateContaPagar,
    pagar,
    estornar,
    listContasPagar,
    getTotais,
    createContaPagar,
    patchContaPagar,
    deleteContaPagar
};
