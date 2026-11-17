const parseDecimal = require('../utils/parseDecimal');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');
const caixaService = require('../services/caixaService');
const cadastrosTesouraria = require('../models/cadastrosTesourariaModel');

const DATA = /^\d{4}-\d{2}-\d{2}$/;

function idValido(v) {
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw createHttpError(400, 'ID inválido.');
    return n;
}

function valorValido(v) {
    const n = parseDecimal(v);
    if (Number.isNaN(n) || n <= 0) throw createHttpError(400, 'Informe um valor maior que zero.');
    return Math.round(n * 100) / 100;
}

async function getEstado(req, res) {
    res.json(await caixaService.getEstado(getIgrejaId(req.auth)));
}

async function definirSaldoInicial(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const { competencia, saldoInicial } = req.validatedBody;
    const valor = parseDecimal(saldoInicial);
    if (Number.isNaN(valor)) throw createHttpError(400, 'Saldo inicial inválido.');
    const estado = await caixaService.definirSaldoInicial(igrejaId, competencia, Math.round(valor * 100) / 100);
    audit('finance.caixa.saldo_inicial', req, { competencia, valor });
    res.json({ message: 'Saldo inicial salvo.', estado });
}

async function ativarProxima(req, res) {
    const estado = await caixaService.ativarProxima(getIgrejaId(req.auth));
    audit('finance.caixa.competencia.ativar', req, { competencia: estado.competenciaAtiva });
    res.json({ message: `Competência ${estado.competenciaAtiva} ativada.`, estado });
}

async function contasSugeridas(req, res) {
    res.json({ items: await caixaService.contasSugeridas(getIgrejaId(req.auth)) });
}

async function listLancamentos(req, res) {
    const q = req.query || {};
    const filtros = {
        inicio: DATA.test(q.inicio || '') ? q.inicio : null,
        fim: DATA.test(q.fim || '') ? q.fim : null,
        tipo: ['ENTRADA', 'SAIDA'].includes(String(q.tipo || '').toUpperCase()) ? q.tipo : null,
        busca: q.busca ? String(q.busca).slice(0, 100) : null,
        page: q.page,
        limit: q.limit,
        ordem: q.ordem === 'valor' ? 'valor' : 'data',
        desc: q.dir !== 'asc'
    };
    res.json(await caixaService.listLancamentos(getIgrejaId(req.auth), filtros));
}

async function getLancamento(req, res) {
    const item = await caixaService.getLancamento(idValido(req.params.id), getIgrejaId(req.auth));
    if (!item) throw createHttpError(404, 'Lançamento não encontrado.');
    res.json(item);
}

async function corpo(req, igrejaId) {
    const b = req.validatedBody;
    await cadastrosTesouraria.validarVinculos(igrejaId, { centroCustoId: b.centroCustoId, fornecedorId: b.fornecedorId });
    return { ...b, valor: valorValido(b.valor) };
}

async function createLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const dados = await corpo(req, igrejaId);
    const id = await caixaService.createLancamento(igrejaId, req.auth.id, dados);
    audit('finance.caixa.lancamento.create', req, { id, tipo: dados.tipo, valor: dados.valor });
    res.status(201).json({ id, message: 'Lançamento registrado com sucesso.' });
}

async function updateLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = idValido(req.params.id);
    const dados = await corpo(req, igrejaId);
    await caixaService.updateLancamento(id, igrejaId, dados);
    audit('finance.caixa.lancamento.update', req, { id, tipo: dados.tipo, valor: dados.valor });
    res.json({ id, message: 'Lançamento atualizado.' });
}

async function deleteLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = idValido(req.params.id);
    const rows = await caixaService.deleteLancamento(id, igrejaId);
    if (!rows) throw createHttpError(404, 'Lançamento não encontrado.');
    audit('finance.caixa.lancamento.delete', req, { id });
    res.json({ message: 'Lançamento removido.' });
}

module.exports = {
    getEstado,
    definirSaldoInicial,
    ativarProxima,
    contasSugeridas,
    listLancamentos,
    getLancamento,
    createLancamento,
    updateLancamento,
    deleteLancamento
};
