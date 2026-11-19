const express = require('express');
const Joi = require('joi');

const { authorize, requireAuth } = require('../middlewares/auth');
const { validateBody } = require('../utils/validation');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const sped = require('../services/spedService');

// Tudo em /contabilidade/... → liberado só para planos com o módulo "contabilidade"
const router = express.Router();
const LER = requireAuth;
const ro = authorize(['admin', 'financeiro', 'secretaria', 'pastor']);
const rw = authorize(['admin', 'financeiro']);
const igreja = (req) => getIgrejaId(req.auth);

const DATA = Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/);
const opt = (s) => s.allow('', null).optional();

const configSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(255).required().label('Nome da entidade'),
    cnpj: Joi.string().trim().max(20).required().label('CNPJ'),
    uf: Joi.string().trim().length(2).required().label('UF'),
    municipio: Joi.string().trim().min(2).max(120).required().label('Município'),
    codMun: Joi.string().trim().max(10).required().label('Código do município (IBGE)'),
    ie: opt(Joi.string().trim().max(30)).label('Inscrição estadual'),
    im: opt(Joi.string().trim().max(30)).label('Inscrição municipal'),
    dtArq: DATA.required().label('Data de registro do estatuto'),
    dtArqConv: opt(DATA).label('Data de registro da conversão'),
    codPlanRef: Joi.string().valid(...Object.keys(sped.PLANOS_REFERENCIAIS)).default('5').label('Plano referencial'),
    formaTributacao: Joi.string().valid('imune', 'isenta').default('imune').label('Forma de tributação'),
    naturezaLivro: opt(Joi.string().trim().max(80)).label('Natureza do livro')
});

const dirigenteSchema = Joi.object({
    nome: Joi.string().trim().min(3).max(255).required().label('Nome'),
    cpf: Joi.string().trim().max(14).required().label('CPF'),
    qualificacao: Joi.number().integer().required().label('Qualificação'),
    cargo: opt(Joi.string().trim().max(120)).label('Cargo'),
    email: opt(Joi.string().trim().email().max(255)).label('E-mail'),
    telefone: opt(Joi.string().trim().max(30)).label('Telefone'),
    crc: opt(Joi.string().trim().max(30)).label('CRC'),
    ufCrc: opt(Joi.string().trim().length(2)).label('UF do CRC'),
    crcSeq: opt(Joi.string().trim().max(30)).label('Nº da certidão (DHP)'),
    crcValidade: opt(DATA).label('Validade da certidão'),
    inicioMandato: opt(DATA).label('Início do mandato'),
    fimMandato: opt(DATA).label('Fim do mandato'),
    remuneracao: Joi.number().min(0).default(0).label('Remuneração anual'),
    responsavelLegal: Joi.boolean().default(false),
    assinaEcd: Joi.boolean().default(true),
    ativo: Joi.boolean().default(true)
});

const ecdSchema = Joi.object({
    ano: Joi.number().integer().min(2000).max(2100).required().label('Ano-base'),
    dtIni: opt(DATA).label('Data inicial'),
    dtFin: opt(DATA).label('Data final'),
    numLivro: Joi.number().integer().min(1).max(99999).default(1).label('Nº do livro'),
    natLivro: opt(Joi.string().trim().max(80)).label('Natureza do livro'),
    finalidade: Joi.string().valid('0', '1').default('0').label('Finalidade'),
    hashSubstituida: opt(Joi.string().trim().max(60)).label('Hash da ECD substituída'),
    sitEspecial: Joi.string().valid('', '1', '2', '3', '4', '5').allow(null).default('').label('Situação especial'),
    sitIniPer: Joi.string().valid('0', '1', '2', '3').default('0').label('Situação no início do período'),
    grandePorte: Joi.boolean().default(false),
    mudancaPlano: Joi.boolean().default(false),
    descentralizada: Joi.boolean().default(false)
});

// ── Tabelas de apoio e dados da entidade ─────────────────────────────────────
router.get('/contabilidade/sped/tabelas', LER, ro, (req, res) => {
    res.json({
        qualificacoes: sped.QUALIFICACOES, planosReferenciais: sped.PLANOS_REFERENCIAIS,
        situacoesEspeciais: sped.SITUACOES_ESPECIAIS, situacoesInicio: sped.SITUACOES_INICIO, leiaute: sped.LEIAUTE_ECD
    });
});
router.get('/contabilidade/sped/config', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await sped.getConfig(igreja(req)));
});
router.put('/contabilidade/sped/config', LER, rw, validateBody(configSchema), async (req, res) => {
    const cfg = await sped.salvarConfig(igreja(req), req.validatedBody);
    audit('contabilidade.sped.config', req, {});
    res.json({ ...cfg, message: 'Dados da entidade salvos.' });
});

// ── Dirigentes e conselheiros ────────────────────────────────────────────────
router.get('/contabilidade/dirigentes', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ items: await sped.listarDirigentes(igreja(req)) });
});
router.post('/contabilidade/dirigentes', LER, rw, validateBody(dirigenteSchema), async (req, res) => {
    const id = await sped.criarDirigente(igreja(req), req.validatedBody);
    audit('contabilidade.dirigente.create', req, { id });
    res.status(201).json({ id, message: 'Dirigente cadastrado.' });
});
router.put('/contabilidade/dirigentes/:id', LER, rw, validateBody(dirigenteSchema), async (req, res) => {
    await sped.atualizarDirigente(igreja(req), req.params.id, req.validatedBody);
    audit('contabilidade.dirigente.update', req, { id: req.params.id });
    res.json({ message: 'Dirigente atualizado.' });
});
router.delete('/contabilidade/dirigentes/:id', LER, rw, async (req, res) => {
    await sped.excluirDirigente(igreja(req), req.params.id);
    audit('contabilidade.dirigente.delete', req, { id: req.params.id });
    res.json({ message: 'Dirigente excluído.' });
});

// ── Plano referencial ────────────────────────────────────────────────────────
router.get('/contabilidade/sped/referencial', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ items: await sped.listarReferencial(igreja(req)) });
});
router.put('/contabilidade/sped/referencial', LER, rw, validateBody(Joi.object({
    itens: Joi.array().max(2000).items(Joi.object({
        codigo: Joi.string().trim().max(50).required(),
        referencial: Joi.string().trim().max(60).allow('', null)
    })).required()
})), async (req, res) => {
    await sped.salvarReferencial(igreja(req), req.validatedBody.itens);
    res.json({ message: 'Mapeamento salvo.' });
});
router.get('/contabilidade/sped/validar-plano', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await sped.validarPlano(igreja(req)));
});

// ── ECD ──────────────────────────────────────────────────────────────────────
router.post('/contabilidade/sped/ecd/validar', LER, ro, validateBody(ecdSchema), async (req, res) => {
    res.json(await sped.validarEcd(igreja(req), req.validatedBody));
});
router.post('/contabilidade/sped/ecd/gerar', LER, rw, validateBody(ecdSchema), async (req, res) => {
    const r = await sped.gerarEcd(igreja(req), req.validatedBody, { id: req.auth.id, nome: req.auth.nome || req.auth.email });
    audit('contabilidade.sped.ecd.gerar', req, { id: r.id, ano: req.validatedBody.ano });
    res.status(201).json({ ...r, message: `ECD gerada: ${r.linhas} linhas.` });
});
router.get('/contabilidade/sped/arquivos', LER, ro, async (req, res) => {
    const tipo = ['ECD', 'ECF'].includes(String(req.query.tipo || '').toUpperCase()) ? String(req.query.tipo).toUpperCase() : null;
    res.set('Cache-Control', 'no-store');
    res.json({ items: await sped.listarArquivos(igreja(req), tipo) });
});
router.get('/contabilidade/sped/arquivos/:id/download', LER, ro, async (req, res) => {
    const a = await sped.baixarArquivo(igreja(req), req.params.id);
    res.set('Content-Type', 'text/plain; charset=ISO-8859-1');
    res.set('Content-Disposition', `attachment; filename="${a.nome}"`);
    res.set('Cache-Control', 'no-store');
    res.send(a.buffer);
});
router.delete('/contabilidade/sped/arquivos/:id', LER, rw, async (req, res) => {
    await sped.excluirArquivo(igreja(req), req.params.id);
    audit('contabilidade.sped.arquivo.delete', req, { id: req.params.id });
    res.json({ message: 'Arquivo excluído do histórico.' });
});

// ── ECF ──────────────────────────────────────────────────────────────────────
router.get('/contabilidade/sped/ecf', LER, ro, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(await sped.fichaEcf(igreja(req), req.query.ano));
});

module.exports = router;
