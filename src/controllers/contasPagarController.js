const parseDecimal = require('../utils/parseDecimal');
const contasPagarService = require('../services/contasPagarService');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');
const cadastrosTesouraria = require('../models/cadastrosTesourariaModel');
const lancamentoAuto = require('../services/lancamentoAutomaticoService');

async function listContasPagar(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const q = req.query;
    const result = await contasPagarService.listContasPagar(igrejaId, {
        status: q.status || null,
        categoria: q.categoria || null,
        vencimentoDe: q.vencimentoDe || null,
        vencimentoAte: q.vencimentoAte || null,
        descricao: q.descricao || null,
        centroCustoId: /^\d+$/.test(String(q.centroCustoId || '')) ? Number(q.centroCustoId) : null,
        fornecedorId: /^\d+$/.test(String(q.fornecedorId || '')) ? Number(q.fornecedorId) : null,
        page: Number(q.page) || 1,
        limit: Number(q.limit) || 50
    });

    res.json(result);
}

async function getTotais(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const totais = await contasPagarService.getTotais(igrejaId);
    res.json(totais);
}

async function createContaPagar(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const { valor: raw, ...rest } = req.validatedBody;
    const valor = parseDecimal(raw);

    if (Number.isNaN(valor) || valor <= 0) {
        throw createHttpError(400, 'Valor inválido.');
    }

    // Lote 5: vínculos precisam ser da mesma igreja (isolamento multi-tenant)
    const vinculos = await cadastrosTesouraria.validarVinculos(igrejaId, {
        fornecedorId: rest.fornecedorId, centroCustoId: rest.centroCustoId, tipoDocumentoId: rest.tipoDocumentoId
    });
    if (vinculos.fornecedor && !rest.fornecedor) rest.fornecedor = vinculos.fornecedor.nome;

    const id = await contasPagarService.createContaPagar(igrejaId, { ...rest, valor }, req.auth.id);
    audit('financeiro.contas_pagar.create', req, { id, descricao: rest.descricao });
    res.status(201).json({ message: 'Conta a pagar criada.', id });
}

async function patchContaPagar(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const { status, dataPagamento } = req.body;

    const fields = {};
    if (status) fields.status = status;
    if (dataPagamento) fields.data_pagamento = dataPagamento;

    const atual = await contasPagarService.getContaPagar(id, igrejaId);
    if (!atual) throw createHttpError(404, 'Conta não encontrada.');
    if (atual.pago_com && fields.status && fields.status !== 'pago') {
        await contasPagarService.estornar(id, igrejaId);
        return res.json({ message: 'Pagamento estornado.' });
    }
    await contasPagarService.patchContaPagar(id, igrejaId, fields);
    audit('financeiro.contas_pagar.patch', req, { id, ...fields });
    res.json({ message: 'Conta atualizada.' });
}

async function getContaPagar(req, res) {
    const conta = await contasPagarService.getContaPagar(Number(req.params.id), getIgrejaId(req.auth));
    if (!conta) throw createHttpError(404, 'Conta não encontrada.');
    res.json(conta);
}

async function lerCorpo(req) {
    const igrejaId = getIgrejaId(req.auth);
    const { valor: raw, ...rest } = req.validatedBody;
    const valor = parseDecimal(raw);
    if (Number.isNaN(valor) || valor <= 0) throw createHttpError(400, 'Informe um valor maior que zero.');
    const vinculos = await cadastrosTesouraria.validarVinculos(igrejaId, {
        fornecedorId: rest.fornecedorId, centroCustoId: rest.centroCustoId, tipoDocumentoId: rest.tipoDocumentoId
    });
    if (vinculos.fornecedor && !rest.fornecedor) rest.fornecedor = vinculos.fornecedor.nome;
    return { igrejaId, dados: { ...rest, valor } };
}

async function updateContaPagar(req, res) {
    const id = Number(req.params.id);
    const { igrejaId, dados } = await lerCorpo(req);
    await contasPagarService.updateContaPagar(id, igrejaId, dados);
    audit('financeiro.contas_pagar.update', req, { id });
    res.json({ message: 'Conta atualizada.' });
}

async function pagar(req, res) {
    const id = Number(req.params.id);
    const destino = await contasPagarService.pagar(id, getIgrejaId(req.auth), req.validatedBody, req.auth.id);
    audit('financeiro.contas_pagar.pagar', req, { id, pagoCom: req.validatedBody.pagoCom });
    res.json({ message: `Conta paga. A saída foi lançada em: ${destino.nome}.` });
}

async function estornar(req, res) {
    const id = Number(req.params.id);
    await contasPagarService.estornar(id, getIgrejaId(req.auth));
    audit('financeiro.contas_pagar.estornar', req, { id });
    res.json({ message: 'Pagamento estornado. A saída foi retirada do caixa/banco.' });
}

async function destinos(req, res) {
    res.json({ items: await lancamentoAuto.opcoesDestino(getIgrejaId(req.auth)) });
}

async function deleteContaPagar(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const removidas = await contasPagarService.deleteContaPagar(id, igrejaId);
    // Conta de outra igreja ou inexistente: nada foi apagado → 404 (antes respondia "removida")
    if (!removidas) throw createHttpError(404, 'Conta não encontrada.');
    audit('financeiro.contas_pagar.delete', req, { id });
    res.json({ message: 'Conta removida.' });
}

module.exports = {
    getContaPagar,
    updateContaPagar,
    pagar,
    estornar,
    destinos,
    listContasPagar,
    getTotais,
    createContaPagar,
    patchContaPagar,
    deleteContaPagar
};
