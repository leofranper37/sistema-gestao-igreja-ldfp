const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const { contaPagarSchema, pagamentoDestinoSchema, validateBody } = require('../utils/validation');
const c = require('../controllers/contasPagarController');

const router = express.Router();
const rw = ['admin', 'financeiro', 'secretaria'];
const ro = ['admin', 'financeiro', 'secretaria', 'pastor'];

router.get('/contas-pagar', requireAuth, authorize(ro), c.listContasPagar);
router.get('/contas-pagar/totais', requireAuth, authorize(ro), c.getTotais);
router.get('/contas-pagar/:id', requireAuth, authorize(ro), c.getContaPagar);
router.post('/contas-pagar', requireAuth, authorize(rw), validateBody(contaPagarSchema), c.createContaPagar);
router.put('/contas-pagar/:id', requireAuth, authorize(rw), validateBody(contaPagarSchema), c.updateContaPagar);
router.post('/contas-pagar/:id/pagar', requireAuth, authorize(rw), validateBody(pagamentoDestinoSchema), c.pagar);
router.post('/contas-pagar/:id/estornar', requireAuth, authorize(['admin', 'financeiro']), c.estornar);
router.patch('/contas-pagar/:id', requireAuth, authorize(rw), c.patchContaPagar);
router.delete('/contas-pagar/:id', requireAuth, authorize(['admin', 'financeiro']), c.deleteContaPagar);

// De onde sai / para onde vai o dinheiro (caixa + contas bancárias ativas)
router.get('/tesouraria/destinos', requireAuth, authorize(ro), c.destinos);

module.exports = router;
