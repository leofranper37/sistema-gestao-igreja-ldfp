const { createHttpError } = require('../utils/httpError');
const parseDecimal = require('../utils/parseDecimal');
const { audit } = require('../services/auditService');
const contabilidadeService = require('../services/contabilidadeService');

async function listPlanoContas(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const items = await contabilidadeService.listPlanoContas(igrejaId);
    res.json({ items });
}

async function createPlanoConta(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const id = await contabilidadeService.createPlanoConta({
        igrejaId,
        codigo: req.validatedBody.codigo,
        nome: req.validatedBody.nome,
        natureza: req.validatedBody.natureza,
        createdBy: req.auth.id
    });

    if (!id) {
        throw createHttpError(409, 'Já existe uma conta com este código.');
    }

    audit('contabilidade.plano-contas.create', req, { id, codigo: req.validatedBody.codigo });
    res.status(201).json({ id, message: 'Conta criada com sucesso.' });
}

async function listBalanceteAbertura(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const data = await contabilidadeService.listBalanceteAbertura(igrejaId);
    res.json(data);
}

async function createBalanceteAbertura(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const debito = parseDecimal(req.validatedBody.debito);
    const credito = parseDecimal(req.validatedBody.credito);

    if (Number.isNaN(debito) || debito < 0 || Number.isNaN(credito) || credito < 0) {
        throw createHttpError(400, 'Débito/Crédito inválidos.');
    }

    const id = await contabilidadeService.createBalanceteAbertura({
        igrejaId,
        conta: req.validatedBody.conta,
        debito,
        credito,
        createdBy: req.auth.id
    });

    audit('contabilidade.balancete-abertura.create', req, { id, conta: req.validatedBody.conta });
    res.status(201).json({ id, message: 'Saldo de abertura registrado.' });
}

async function listLancamentosContabeis(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const items = await contabilidadeService.listLancamentosContabeis(igrejaId);
    res.json({ items });
}

async function createLancamentoContabil(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const valor = parseDecimal(req.validatedBody.valor);
    if (Number.isNaN(valor) || valor <= 0) {
        throw createHttpError(400, 'Valor inválido.');
    }

    const id = await contabilidadeService.createLancamentoContabil({
        igrejaId,
        dataLancamento: req.validatedBody.dataLancamento,
        historico: req.validatedBody.historico,
        contaDebito: req.validatedBody.contaDebito,
        contaCredito: req.validatedBody.contaCredito,
        valor,
        createdBy: req.auth.id
    });

    audit('contabilidade.lancamento.create', req, { id, valor });
    res.status(201).json({ id, message: 'Lançamento contábil registrado.' });
}

async function listEncerramentos(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const items = await contabilidadeService.listEncerramentos(igrejaId);
    res.json({ items });
}

async function createEncerramento(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const usuarioNome = req.auth.nome || req.auth.email || 'Usuário';
    const id = await contabilidadeService.createEncerramento({
        igrejaId,
        usuarioNome,
        observacao: req.validatedBody.observacao,
        createdBy: req.auth.id
    });

    audit('contabilidade.encerramento.create', req, { id });
    res.status(201).json({ id, message: 'Encerramento registrado com sucesso.' });
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
