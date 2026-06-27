const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const {
    outrasIgrejasQuerySchema,
    outrasIgrejasSchema,
    validateBody,
    validateQuery
} = require('../utils/validation');
const {
    createOutrasIgreja,
    deleteOutrasIgreja,
    getPainelCongregacoes,
    listOutrasIgrejas,
    updateOutrasIgreja
} = require('../controllers/outrasIgrejasController');

const router = express.Router();

router.get('/congregacoes/painel', requireAuth, authorize(['admin', 'secretaria']), getPainelCongregacoes);
router.get('/outras-igrejas', requireAuth, authorize(['admin', 'secretaria']), validateQuery(outrasIgrejasQuerySchema), listOutrasIgrejas);
router.post('/outras-igrejas', requireAuth, authorize(['admin', 'secretaria']), validateBody(outrasIgrejasSchema), createOutrasIgreja);
router.put('/outras-igrejas/:id', requireAuth, authorize(['admin', 'secretaria']), validateBody(outrasIgrejasSchema), updateOutrasIgreja);
router.delete('/outras-igrejas/:id', requireAuth, authorize(['admin', 'secretaria']), deleteOutrasIgreja);

module.exports = router;
