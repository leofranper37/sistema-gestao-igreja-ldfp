const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const {
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
    upsertSaldoInicial
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
router.delete('/dizimos/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), deleteDizimo);

router.get('/tipos-receita', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), validateQuery(tipoReceitaFiltroSchema), listTiposReceita);
router.post('/tipos-receita', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(tipoReceitaSchema), createTipoReceita);
router.put('/tipos-receita/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(tipoReceitaUpdateSchema), updateTipoReceita);
router.delete('/tipos-receita/:id', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), deleteTipoReceita);

module.exports = router;