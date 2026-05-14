const parseDecimal = require('../utils/parseDecimal');
const contasPagarService = require('../services/contasPagarService');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');

async function listContasPagar(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const q = req.query;
    const result = await contasPagarService.listContasPagar(igrejaId, {
        status: q.status || null,
        categoria: q.categoria || null,
        vencimentoDe: q.vencimentoDe || null,
        vencimentoAte: q.vencimentoAte || null,
        descricao: q.descricao || null,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 50
    });

    res.json(result);
}

async function getTotais(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const totais = await contasPagarService.getTotais(igrejaId);
    res.json(totais);
}

async function createContaPagar(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const { valor: raw, ...rest } = req.validatedBody;
    const valor = parseDecimal(raw);

    if (Number.isNaN(valor) || valor <= 0) {
        throw createHttpError(400, 'Valor inválido.');
    }

    const id = await contasPagarService.createContaPagar(igrejaId, { ...rest, valor }, req.auth.id);
    audit('financeiro.contas_pagar.create', req, { id, descricao: rest.descricao });
    res.status(201).json({ message: 'Conta a pagar criada.', id });
}

async function patchContaPagar(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = Number(req.params.id);
    const { status, dataPagamento } = req.body;

    const fields = {};
    if (status) fields.status = status;
    if (dataPagamento) fields.data_pagamento = dataPagamento;

    await contasPagarService.patchContaPagar(id, igrejaId, fields);
    audit('financeiro.contas_pagar.patch', req, { id, ...fields });
    res.json({ message: 'Conta atualizada.' });
}

async function deleteContaPagar(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = Number(req.params.id);
    await contasPagarService.deleteContaPagar(id, igrejaId);
    audit('financeiro.contas_pagar.delete', req, { id });
    res.json({ message: 'Conta removida.' });
}

module.exports = {
    listContasPagar,
    getTotais,
    createContaPagar,
    patchContaPagar,
    deleteContaPagar
};
