const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const { bancoContaSchema, bancoLancamentoSchema, validateBody } = require('../utils/validation');
const c = require('../controllers/bancoController');

const router = express.Router();
const rw = ['admin', 'financeiro', 'secretaria'];
const ro = ['admin', 'financeiro', 'secretaria', 'pastor'];
const del = ['admin', 'financeiro'];

router.get('/banco/contas', requireAuth, authorize(ro), c.listContas);
router.get('/banco/contas/:id', requireAuth, authorize(ro), c.getConta);
router.post('/banco/contas', requireAuth, authorize(rw), validateBody(bancoContaSchema), c.createConta);
router.put('/banco/contas/:id', requireAuth, authorize(rw), validateBody(bancoContaSchema), c.updateConta);
router.delete('/banco/contas/:id', requireAuth, authorize(del), c.deleteConta);

router.get('/banco/contas-sugeridas', requireAuth, authorize(ro), c.contasSugeridas);
router.get('/banco/contas/:contaId/lancamentos', requireAuth, authorize(ro), c.listLancamentos);
router.post('/banco/contas/:contaId/lancamentos', requireAuth, authorize(rw), validateBody(bancoLancamentoSchema), c.createLancamento);
router.get('/banco/lancamentos/:id', requireAuth, authorize(ro), c.getLancamento);
router.put('/banco/lancamentos/:id', requireAuth, authorize(rw), validateBody(bancoLancamentoSchema), c.updateLancamento);
router.delete('/banco/lancamentos/:id', requireAuth, authorize(del), c.deleteLancamento);

module.exports = router;
