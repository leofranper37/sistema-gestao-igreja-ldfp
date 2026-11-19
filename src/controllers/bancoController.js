const parseDecimal = require('../utils/parseDecimal');
const bancoService = require('../services/bancoService');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');
const cadastrosTesouraria = require('../models/cadastrosTesourariaModel');

const ROTULO_TIPO = { corrente: 'Conta corrente', aplicacao: 'Aplicação', cartao: 'Cartão de crédito' };

// ── Contas ──────────────────────────────────────────────────────────────────

async function listContas(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    // ?saldo=1 → inclui saldo atual de cada conta (telas novas)
    if (req.query.saldo) return res.json(await bancoService.listContasComSaldo(igrejaId));
    res.json(await bancoService.listContas(igrejaId));
}

async function getConta(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const conta = await bancoService.getConta(Number(req.params.id), igrejaId);
    if (!conta) throw createHttpError(404, 'Conta não encontrada.');
    res.json(conta);
}

// Formulário novo (traz saldoData): exige os campos de cada tipo, como no cadastro
function exigirCamposDoTipo(b) {
    if (!b.saldoData) return;
    const falta = [];
    if (!b.banco) falta.push(b.tipo === 'cartao' ? 'banco emissor' : 'banco');
    if (b.tipo === 'cartao') {
        if (!b.finalCartao) falta.push('final do cartão');
    } else {
        if (!b.agencia) falta.push('agência');
        if (!b.conta) falta.push('conta');
        if (!b.digito) falta.push('dígito');
    }
    if (falta.length) throw createHttpError(400, `Preencha: ${falta.join(', ')}.`);
}

function lerSaldo(raw) {
    const v = parseDecimal(raw);
    if (Number.isNaN(v) || v < 0) throw createHttpError(400, 'Saldo inválido. Informe um valor positivo e escolha Crédito ou Débito.');
    return v;
}

async function createConta(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const { saldoInicial: raw, ...rest } = req.validatedBody;
    exigirCamposDoTipo(rest);
    const saldoInicial = lerSaldo(raw);
    const id = await bancoService.createConta(igrejaId, { ...rest, saldoInicial }, req.auth.id);
    audit('banco.conta.create', req, { id, nome: rest.nome, tipo: rest.tipo });
    res.status(201).json({ message: `${ROTULO_TIPO[rest.tipo] || 'Conta'} cadastrada com sucesso.`, id });
}

async function updateConta(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const { saldoInicial: raw, ...rest } = req.validatedBody;
    exigirCamposDoTipo(rest);
    const saldoInicial = rest.saldoTipo ? lerSaldo(raw) : parseDecimal(raw);
    const rows = await bancoService.updateConta(id, igrejaId, { ...rest, saldoInicial });
    if (!rows) throw createHttpError(404, 'Conta não encontrada.');
    audit('banco.conta.update', req, { id });
    res.json({ message: 'Conta atualizada.' });
}

async function deleteConta(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const rows = await bancoService.deleteConta(id, igrejaId);
    if (!rows) throw createHttpError(404, 'Conta não encontrada.');
    audit('banco.conta.delete', req, { id });
    res.json({ message: 'Conta removida.' });
}

// ── Lançamentos ─────────────────────────────────────────────────────────────

const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
function mesAtual() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function listLancamentos(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const contaId = Number(req.params.contaId);
    const conta = await bancoService.getConta(contaId, igrejaId);
    if (!conta) throw createHttpError(404, 'Conta não encontrada.');

    // Formato antigo (telas legadas): sem ?mes / ?periodo
    if (!req.query.mes && !req.query.periodo) {
        const rows = await bancoService.listLancamentos(contaId, igrejaId);
        const saldo = await bancoService.getSaldoConta(contaId, igrejaId);
        return res.json({ lancamentos: rows, saldo: saldo ?? 0 });
    }

    const q = req.query;
    const mes = MES_RE.test(String(q.mes || '')) ? String(q.mes) : mesAtual();
    const resumo = await bancoService.resumoMes(contaId, igrejaId, mes);
    const todo = q.periodo === 'todos';
    const dados = await bancoService.listLancamentosPaginado(contaId, igrejaId, {
        inicio: todo ? null : resumo.inicio,
        fim: todo ? null : resumo.fim,
        tipo: ['entrada', 'saida'].includes(q.tipo) ? q.tipo : null,
        busca: q.busca ? String(q.busca).slice(0, 100) : null,
        page: q.page,
        limit: q.limit,
        ordem: q.ordem === 'valor' ? 'valor' : 'data',
        desc: q.dir !== 'asc'
    });
    res.json({
        conta: { id: conta.id, nome: conta.nome, banco: conta.banco, tipo: conta.tipo, conta_contabil: conta.conta_contabil },
        resumo,
        saldo: await bancoService.getSaldoConta(contaId, igrejaId),
        ...dados
    });
}

function montarLancamento(body) {
    const valor = parseDecimal(body.valor);
    if (Number.isNaN(valor) || valor <= 0) throw createHttpError(400, 'Informe um valor maior que zero.');
    return { ...body, valor };
}

async function getLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const l = await bancoService.getLancamento(Number(req.params.id), igrejaId);
    if (!l) throw createHttpError(404, 'Lançamento não encontrado.');
    res.json(l);
}

async function createLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const contaId = Number(req.params.contaId);
    const body = montarLancamento(req.validatedBody);
    await cadastrosTesouraria.validarVinculos(igrejaId, { centroCustoId: body.centroCustoId, fornecedorId: body.fornecedorId });
    const id = await bancoService.createLancamento(igrejaId, { ...body, contaId }, req.auth.id);
    audit('banco.lancamento.create', req, { id, contaId });
    res.status(201).json({ message: 'Lançamento registrado.', id });
}

async function updateLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const body = montarLancamento(req.validatedBody);
    await cadastrosTesouraria.validarVinculos(igrejaId, { centroCustoId: body.centroCustoId, fornecedorId: body.fornecedorId });
    await bancoService.updateLancamento(id, igrejaId, body);
    audit('banco.lancamento.update', req, { id });
    res.json({ message: 'Lançamento atualizado.' });
}

async function deleteLancamento(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const rows = await bancoService.deleteLancamento(id, igrejaId);
    if (!rows) throw createHttpError(404, 'Lançamento não encontrado.');
    audit('banco.lancamento.delete', req, { id });
    res.json({ message: 'Lançamento removido.' });
}

async function contasSugeridas(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    res.json({ items: await bancoService.contasSugeridas(igrejaId, Number(req.query.conta) || null) });
}

module.exports = {
    listContas,
    getConta,
    createConta,
    updateConta,
    deleteConta,
    listLancamentos,
    getLancamento,
    createLancamento,
    updateLancamento,
    deleteLancamento,
    contasSugeridas
};
