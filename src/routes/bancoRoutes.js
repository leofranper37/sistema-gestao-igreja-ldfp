const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const { bancoContaSchema, bancoLancamentoSchema, validateBody } = require('../utils/validation');
const { createConta, deleteConta, getConta, listContas, updateConta, listLancamentos, createLancamento, deleteLancamento } = require('../controllers/bancoController');

const router = express.Router();
const rw = ['admin', 'financeiro', 'secretaria'];
const ro = ['admin', 'financeiro', 'secretaria', 'pastor'];

router.get('/banco/contas', requireAuth, authorize(ro), listContas);
router.get('/banco/contas/:id', requireAuth, authorize(ro), getConta);
router.post('/banco/contas', requireAuth, authorize(rw), validateBody(bancoContaSchema), createConta);
router.put('/banco/contas/:id', requireAuth, authorize(rw), validateBody(bancoContaSchema), updateConta);
router.delete('/banco/contas/:id', requireAuth, authorize(['admin', 'financeiro']), deleteConta);

router.get('/banco/contas/:contaId/lancamentos', requireAuth, authorize(ro), listLancamentos);
router.post('/banco/contas/:contaId/lancamentos', requireAuth, authorize(rw), validateBody(bancoLancamentoSchema), createLancamento);
router.delete('/banco/lancamentos/:id', requireAuth, authorize(['admin', 'financeiro']), deleteLancamento);

module.exports = router;
