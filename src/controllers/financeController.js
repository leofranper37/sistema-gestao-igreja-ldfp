const { createHttpError } = require('../utils/httpError');
const parseDecimal = require('../utils/parseDecimal');
const financeService = require('../services/financeService');
const { audit } = require('../services/auditService');

async function getSaldo(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const saldoFinal = await financeService.getSaldo(igrejaId);

    res.json({ saldo: saldoFinal.toFixed(2).replace('.', ',') });
}

async function listTransacoes(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const query = req.validatedQuery || {};

    const hasAdvancedQuery = Boolean(
        query.page || query.limit || query.sortBy || query.sortOrder || query.tipo || query.descricao || query.startDate || query.endDate
    );

    if (!hasAdvancedQuery && !['1', 'true', true].includes(query.meta)) {
        const rows = await financeService.listTransacoes(igrejaId);
        return res.json(rows);
    }

    const result = await financeService.listTransacoesWithFilters({
        igrejaId,
        page: query.page,
        limit: query.limit || 50,
        sortBy: query.sortBy || 'id',
        sortOrder: query.sortOrder || 'desc',
        tipo: query.tipo || null,
        descricao: query.descricao || null,
        startDate: query.startDate || null,
        endDate: query.endDate || null
    });

    return res.json(result);
}

async function createTransacao(req, res) {
    const { descricao, tipo, valor } = req.validatedBody;
    const amount = parseDecimal(valor);

    if (Number.isNaN(amount) || amount < 0) {
        throw createHttpError(400, 'Valor da transação inválido.');
    }

    const igrejaId = Number(req.auth.igrejaId || 1);

    await financeService.createTransacao({ descricao, tipo, amount, igrejaId });
    audit('finance.transacao.create', req, { tipo, amount, descricao });

    res.status(201).json({ message: 'Transação registrada com sucesso.' });
}

async function getSaldoInicial(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const row = await financeService.getSaldoInicial(igrejaId);

    if (!row) {
        return res.json({ competencia: '', saldoInicial: '0,00' });
    }

    return res.json({
        competencia: row.competencia,
        saldoInicial: Number(row.saldo_inicial || 0).toFixed(2).replace('.', ',')
    });
}

async function upsertSaldoInicial(req, res) {
    const { competencia, saldoInicial: saldoRaw } = req.validatedBody;
    const saldoInicial = parseDecimal(saldoRaw);

    if (Number.isNaN(saldoInicial) || saldoInicial < 0) {
        throw createHttpError(400, 'Saldo inicial inválido.');
    }

    const igrejaId = Number(req.auth.igrejaId || 1);

    await financeService.upsertSaldoInicial({ competencia, saldoInicial, igrejaId });
    audit('finance.saldo-inicial.upsert', req, { competencia, saldoInicial });

    res.json({ message: 'Saldo inicial salvo com sucesso.' });
}

// ─── Dízimos ────────────────────────────────────────────────────────────────

async function listDizimos(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const q = req.validatedQuery || {};
    const result = await financeService.listDizimos(igrejaId, {
        competencia: q.competencia || null,
        tipo: q.tipo || null,
        membroNome: q.membroNome || null,
        page: q.page,
        limit: q.limit || 100
    });

    res.json(result);
}

async function getTotaisDizimos(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const competencia = String(req.query.competencia || '').trim() || null;
    const totais = await financeService.getTotaisDizimos(igrejaId, competencia);
    res.json(totais);
}

async function createDizimo(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const { valor } = req.validatedBody;
    const amount = parseDecimal(valor);

    if (Number.isNaN(amount) || amount <= 0) {
        throw createHttpError(400, 'Valor inválido.');
    }

    const id = await financeService.createDizimo(igrejaId, { ...req.validatedBody, valor: amount }, req.auth.id);
    audit('finance.dizimo.create', req, { id, tipo: req.validatedBody.tipo, amount });
    res.status(201).json({ message: 'Lançamento registrado com sucesso.', id });
}

async function deleteDizimo(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = Number(req.params.id);
    await financeService.deleteDizimo(id, igrejaId);
    audit('finance.dizimo.delete', req, { id });
    res.json({ message: 'Lançamento removido.' });
}

async function listTiposReceita(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const query = req.validatedQuery || {};
    const items = await financeService.listTiposReceita(igrejaId, { search: query.search || null });
    res.json({ items });
}

async function createTipoReceita(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = await financeService.createTipoReceita(igrejaId, req.validatedBody, req.auth.id);
    audit('finance.tipo-receita.create', req, { id, descricao: req.validatedBody.descricao });
    res.status(201).json({ message: 'Tipo de receita criado com sucesso.', id });
}

async function updateTipoReceita(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = String(req.params.id || '').trim();

    const current = await financeService.getTipoReceitaById(id, igrejaId);
    if (!current) {
        throw createHttpError(404, 'Tipo de receita não encontrado.');
    }
    if (current.origem === 'base') {
        throw createHttpError(400, 'Tipos padrão do sistema não podem ser editados.');
    }

    await financeService.updateTipoReceita(id, igrejaId, req.validatedBody);
    audit('finance.tipo-receita.update', req, { id, descricao: req.validatedBody.descricao });
    res.json({ message: 'Tipo de receita atualizado com sucesso.' });
}

async function deleteTipoReceita(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = String(req.params.id || '').trim();

    const current = await financeService.getTipoReceitaById(id, igrejaId);
    if (!current) {
        throw createHttpError(404, 'Tipo de receita não encontrado.');
    }
    if (current.origem === 'base') {
        throw createHttpError(400, 'Tipos padrão do sistema não podem ser removidos.');
    }

    await financeService.deleteTipoReceita(id, igrejaId);
    audit('finance.tipo-receita.delete', req, { id });
    res.json({ message: 'Tipo de receita removido com sucesso.' });
}

module.exports = {
    createTransacao,
    getSaldo,
    getSaldoInicial,
    listTransacoes,
    upsertSaldoInicial,
    createDizimo,
    deleteDizimo,
    getTotaisDizimos,
    listDizimos,
    createTipoReceita,
    deleteTipoReceita,
    listTiposReceita,
    updateTipoReceita
};