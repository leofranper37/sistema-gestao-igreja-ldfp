const express = require('express');
const Joi = require('joi');

const { authorize, requireAuth } = require('../middlewares/auth');
const { validateBody } = require('../utils/validation');
const parseDecimal = require('../utils/parseDecimal');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');
const cadastrosTesouraria = require('../models/cadastrosTesourariaModel');
const contabil = require('../services/contabilService');

const router = express.Router();
const LER = requireAuth;
const ro = authorize(['admin', 'financeiro', 'secretaria', 'pastor']);
const rw = authorize(['admin', 'financeiro', 'secretaria']);
const adm = authorize(['admin', 'financeiro']);

const DATA = Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/);
const valor = Joi.alternatives().try(Joi.number(), Joi.string().trim().max(30));

const contaSchema = Joi.object({
    pai: Joi.string().trim().pattern(/^\d+(\.\d+)*$/).required().label('Conta superior'),
    codigo: Joi.string().trim().pattern(/^\d+(\.\d+)*$/).allow('', null).optional().label('Código'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    tipo: Joi.string().valid('A', 'S').default('A').label('Tipo')
});
const contaUpdateSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(255).optional().label('Nome'),
    ativo: Joi.boolean().optional().label('Ativa')
});
const lancamentoSchema = Joi.object({
    dataLancamento: DATA.required().label('Data'),
    contaDebito: Joi.string().trim().min(2).max(255).required().label('Conta débito'),
    contaCredito: Joi.string().trim().min(2).max(255).required().label('Conta crédito'),
    historico: Joi.string().trim().min(2).max(500).required().label('Histórico'),
    valor: valor.required().label('Valor'),
    documento: Joi.string().trim().max(50).allow('', null).optional().label('Documento'),
    centroCustoId: Joi.number().integer().positive().allow(null).optional().label('Centro de custo'),
    movimentoCC: Joi.string().valid('R', 'D').allow(null, '').optional().label('Movimento CC')
});
const aberturaSchema = Joi.object({
    conta: Joi.string().trim().min(1).max(255).required().label('Conta'),
    saldo: valor.required().label('Saldo')
});
const encerramentoSchema = Joi.object({
    ano: Joi.number().integer().min(1990).max(2100).required().label('Ano'),
    semMovimento: Joi.boolean().default(false).label('Ano sem movimento')
});

const igreja = (req) => getIgrejaId(req.auth);

// ── Plano de contas ──────────────────────────────────────────────────────────
router.get('/contabilidade/plano-contas', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ items: await contabil.listarPlano(igreja(req)) });
});
router.post('/contabilidade/plano-contas', LER, rw, validateBody(contaSchema), async (req, res) => {
    const r = await contabil.criarConta(igreja(req), req.validatedBody, req.auth.id);
    audit('contabilidade.conta.create', req, r);
    res.status(201).json({ ...r, message: `Conta ${r.codigo} criada.` });
});
router.put('/contabilidade/plano-contas/:id', LER, rw, validateBody(contaUpdateSchema), async (req, res) => {
    await contabil.atualizarConta(igreja(req), req.params.id, req.validatedBody);
    audit('contabilidade.conta.update', req, { id: req.params.id });
    res.json({ message: 'Conta atualizada.' });
});
router.delete('/contabilidade/plano-contas/:id', LER, adm, async (req, res) => {
    await contabil.excluirConta(igreja(req), req.params.id);
    audit('contabilidade.conta.delete', req, { id: req.params.id });
    res.json({ message: 'Conta excluída.' });
});

// ── Lançamentos contábeis ────────────────────────────────────────────────────
async function lerLancamento(req) {
    const d = { ...req.validatedBody };
    d.valor = parseDecimal(d.valor);
    if (d.centroCustoId) await cadastrosTesouraria.validarVinculos(igreja(req), { centroCustoId: d.centroCustoId });
    return d;
}
router.get('/contabilidade/lancamentos', LER, ro, async (req, res) => {
    const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(String(req.query.mes || '')) ? req.query.mes : null;
    res.set('Cache-Control', 'no-store');
    res.json(await contabil.listarLancamentos(igreja(req), { mes, busca: String(req.query.busca || '').slice(0, 100) }));
});
router.get('/contabilidade/lancamentos/:id', LER, ro, async (req, res) => {
    const l = await contabil.getLancamento(igreja(req), req.params.id);
    if (!l) throw createHttpError(404, 'Lançamento não encontrado.');
    res.json(l);
});
router.post('/contabilidade/lancamentos', LER, rw, validateBody(lancamentoSchema), async (req, res) => {
    const id = await contabil.criarLancamento(igreja(req), await lerLancamento(req), req.auth.id);
    audit('contabilidade.lancamento.create', req, { id });
    res.status(201).json({ id, message: 'Lançamento contábil salvo.' });
});
router.put('/contabilidade/lancamentos/:id', LER, rw, validateBody(lancamentoSchema), async (req, res) => {
    await contabil.atualizarLancamento(igreja(req), req.params.id, await lerLancamento(req));
    audit('contabilidade.lancamento.update', req, { id: req.params.id });
    res.json({ message: 'Lançamento contábil atualizado.' });
});
router.delete('/contabilidade/lancamentos/:id', LER, adm, async (req, res) => {
    await contabil.excluirLancamento(igreja(req), req.params.id);
    audit('contabilidade.lancamento.delete', req, { id: req.params.id });
    res.json({ message: 'Lançamento excluído.' });
});

// ── Balancete de abertura ────────────────────────────────────────────────────
router.get('/contabilidade/balancete-abertura', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await contabil.balanceteAbertura(igreja(req)));
});
router.put('/contabilidade/balancete-abertura', LER, rw, validateBody(aberturaSchema), async (req, res) => {
    const saldo = parseDecimal(req.validatedBody.saldo);
    if (Number.isNaN(saldo)) throw createHttpError(400, 'Informe um valor válido.');
    await contabil.salvarSaldoAbertura(igreja(req), { conta: req.validatedBody.conta, saldo }, req.auth.id);
    res.json({ message: 'Saldo salvo.' });
});
router.post('/contabilidade/balancete-abertura/ajustar-resultado', LER, adm, async (req, res) => {
    const r = await contabil.ajustarResultadoAcumulado(igreja(req), req.auth.id);
    audit('contabilidade.abertura.ajustar', req, r);
    res.json({ ...r, message: 'Resultado acumulado ajustado: Ativo e Passivo agora fecham.' });
});

// ── Encerramento do exercício ────────────────────────────────────────────────
router.get('/contabilidade/encerramento', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await contabil.estadoEncerramento(igreja(req)));
});
router.post('/contabilidade/encerramento', LER, adm, validateBody(encerramentoSchema), async (req, res) => {
    const r = await contabil.encerrar(igreja(req), req.validatedBody, { id: req.auth.id, nome: req.auth.nome || req.auth.email });
    audit('contabilidade.exercicio.encerrar', req, r);
    res.status(201).json({ ...r, message: `Exercício de ${r.ano} encerrado.` });
});
router.post('/contabilidade/encerramento/reabrir', LER, authorize(['admin']), validateBody(Joi.object({ ano: Joi.number().integer().required() })), async (req, res) => {
    await contabil.reabrir(igreja(req), req.validatedBody);
    audit('contabilidade.exercicio.reabrir', req, req.validatedBody);
    res.json({ message: `Exercício de ${req.validatedBody.ano} reaberto.` });
});

module.exports = router;
