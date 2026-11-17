const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const {
    caixaLancamentoSchema,
    caixaMesSchema,
    caixaSaldoInicialSchema,
    dizimoFiltroSchema,
    dizimoSchema,
    saldoInicialSchema,
    tipoReceitaFiltroSchema,
    tipoReceitaSchema,
    tipoReceitaUpdateSchema,
    transacaoFiltroSchema,
    transacaoSchema,
    validateBody,
    validateQuery
} = require('../utils/validation');

const {
    createDizimo,
    getResumoDizimos,
    getDizimo,
    updateDizimo,
    buscarMembrosDizimo,
    listDestinosDizimo,
    createTipoReceita,
    createTransacao,
    deleteDizimo,
    deleteTipoReceita,
    getSaldo,
    getSaldoInicial,
    getTotaisDizimos,
    listDizimos,
    listTiposReceita,
    listTransacoes,
    updateTipoReceita,
    upsertSaldoInicial,
    getCaixaResumo,
    listCaixaLancamentos,
    createCaixaLancamento,
    deleteCaixaLancamento,
    upsertCaixaMes
} = require('../controllers/financeController');

const router = express.Router();

router.get('/saldo', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), getSaldo);
router.get('/transacoes', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateQuery(transacaoFiltroSchema), listTransacoes);
router.post('/transacoes', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(transacaoSchema), createTransacao);
router.get('/caixa/saldo-inicial', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), getSaldoInicial);
router.post('/caixa/saldo-inicial', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(saldoInicialSchema), upsertSaldoInicial);

router.get('/dizimos', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), validateQuery(dizimoFiltroSchema), listDizimos);
router.get('/dizimos/totais', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), getTotaisDizimos);
router.post('/dizimos', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(dizimoSchema), createDizimo);
router.get('/dizimos/resumo', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), getResumoDizimos);
router.get('/dizimos/membros', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), buscarMembrosDizimo);
router.get('/dizimos/destinos', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), listDestinosDizimo);
router.get('/dizimos/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), getDizimo);
router.put('/dizimos/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(dizimoSchema), updateDizimo);
router.delete('/dizimos/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), deleteDizimo);

router.get('/tipos-receita', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), validateQuery(tipoReceitaFiltroSchema), listTiposReceita);
router.post('/tipos-receita', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(tipoReceitaSchema), createTipoReceita);
router.put('/tipos-receita/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(tipoReceitaUpdateSchema), updateTipoReceita);
router.delete('/tipos-receita/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), deleteTipoReceita);

// Caixa por competência (telas novas)
const caixa = require('../controllers/caixaController');
const CX_LER = ['admin', 'financeiro', 'secretaria', 'pastor'];
const CX_ESCREVER = ['admin', 'financeiro', 'secretaria'];
router.get('/caixa/competencia', requireAuth, authorize(CX_LER), caixa.getEstado);
router.put('/caixa/competencia/saldo-inicial', requireAuth, authorize(['admin', 'financeiro']), validateBody(caixaSaldoInicialSchema), caixa.definirSaldoInicial);
router.post('/caixa/competencia/ativar', requireAuth, authorize(['admin', 'financeiro']), caixa.ativarProxima);
router.get('/caixa/contas-sugeridas', requireAuth, authorize(CX_LER), caixa.contasSugeridas);
router.get('/caixa/lancamentos/:id', requireAuth, authorize(CX_LER), caixa.getLancamento);
router.put('/caixa/lancamentos/:id', requireAuth, authorize(CX_ESCREVER), validateBody(caixaLancamentoSchema), caixa.updateLancamento);

router.get('/caixa/resumo', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), getCaixaResumo);
router.get('/caixa/lancamentos', requireAuth, authorize(CX_LER), caixa.listLancamentos);
router.post('/caixa/lancamentos', requireAuth, authorize(CX_ESCREVER), validateBody(caixaLancamentoSchema), caixa.createLancamento);
router.delete('/caixa/lancamentos/:id', requireAuth, authorize(CX_ESCREVER), caixa.deleteLancamento);
router.post('/caixa/mes', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(caixaMesSchema), upsertCaixaMes);

module.exports = router;