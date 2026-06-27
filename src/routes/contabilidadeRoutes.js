const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const {
    contabilidadeBalanceteSchema,
    contabilidadeEncerramentoSchema,
    contabilidadeLancamentoSchema,
    contabilidadePlanoContaSchema,
    validateBody
} = require('../utils/validation');

const {
    createBalanceteAbertura,
    createEncerramento,
    createLancamentoContabil,
    createPlanoConta,
    listBalanceteAbertura,
    listEncerramentos,
    listLancamentosContabeis,
    listPlanoContas
} = require('../controllers/contabilidadeController');

const router = express.Router();

router.get('/contabilidade/plano-contas', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), listPlanoContas);
router.post('/contabilidade/plano-contas', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(contabilidadePlanoContaSchema), createPlanoConta);

router.get('/contabilidade/balancete-abertura', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), listBalanceteAbertura);
router.post('/contabilidade/balancete-abertura', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(contabilidadeBalanceteSchema), createBalanceteAbertura);

router.get('/contabilidade/lancamentos', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), listLancamentosContabeis);
router.post('/contabilidade/lancamentos', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(contabilidadeLancamentoSchema), createLancamentoContabil);

router.get('/contabilidade/encerramentos', requireAuth, authorize(['admin', 'financeiro', 'secretaria', 'pastor']), listEncerramentos);
router.post('/contabilidade/encerramentos', requireAuth, authorize(['admin', 'financeiro', 'secretaria']), validateBody(contabilidadeEncerramentoSchema), createEncerramento);

module.exports = router;
