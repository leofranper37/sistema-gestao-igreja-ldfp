const contabilidadeModel = require('../models/contabilidadeModel');

async function listPlanoContas(igrejaId) {
    return contabilidadeModel.listPlanoContas(igrejaId);
}

async function createPlanoConta(payload) {
    return contabilidadeModel.createPlanoConta(payload);
}

async function listBalanceteAbertura(igrejaId) {
    const rows = await contabilidadeModel.listBalanceteAbertura(igrejaId);
    const totals = rows.reduce((acc, row) => {
        acc.totalDebito += Number(row.debito || 0);
        acc.totalCredito += Number(row.credito || 0);
        return acc;
    }, { totalDebito: 0, totalCredito: 0 });

    return {
        items: rows,
        totals
    };
}

async function createBalanceteAbertura(payload) {
    return contabilidadeModel.createBalanceteAbertura(payload);
}

async function listLancamentosContabeis(igrejaId) {
    return contabilidadeModel.listLancamentosContabeis(igrejaId);
}

async function createLancamentoContabil(payload) {
    return contabilidadeModel.createLancamentoContabil(payload);
}

async function listEncerramentos(igrejaId) {
    return contabilidadeModel.listEncerramentos(igrejaId);
}

async function createEncerramento(payload) {
    return contabilidadeModel.createEncerramento(payload);
}

module.exports = {
    createBalanceteAbertura,
    createEncerramento,
    createLancamentoContabil,
    createPlanoConta,
    listBalanceteAbertura,
    listEncerramentos,
    listLancamentosContabeis,
    listPlanoContas
};
