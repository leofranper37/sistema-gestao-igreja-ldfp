const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const { contaPagarSchema, validateBody } = require('../utils/validation');
const { createContaPagar, deleteContaPagar, getTotais, listContasPagar, patchContaPagar } = require('../controllers/contasPagarController');

const router = express.Router();
const rw = ['admin', 'financeiro', 'secretaria'];
const ro = ['admin', 'financeiro', 'secretaria', 'pastor'];

router.get('/contas-pagar', requireAuth, authorize(ro), listContasPagar);
router.get('/contas-pagar/totais', requireAuth, authorize(ro), getTotais);
router.post('/contas-pagar', requireAuth, authorize(rw), validateBody(contaPagarSchema), createContaPagar);
router.patch('/contas-pagar/:id', requireAuth, authorize(rw), patchContaPagar);
router.delete('/contas-pagar/:id', requireAuth, authorize(['admin', 'financeiro']), deleteContaPagar);

module.exports = router;
