const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const { requireModuleEnabled } = require('../middlewares/entitlements');
const {
    agendaEventoQuerySchema,
    agendaEventoSchema,
    validateBody,
    validateQuery
} = require('../utils/validation');
const {
    createEvento,
    deleteEvento,
    listEventos,
    updateEvento
} = require('../controllers/agendaController');

const router = express.Router();

router.get('/agenda/eventos', requireAuth, requireModuleEnabled('agendaEventos'), authorize(['admin', 'secretaria', 'pastor', 'oficial', 'membro', 'tesoureiro', 'diacono', 'presbitero', 'ministerio', 'visitante']), validateQuery(agendaEventoQuerySchema), listEventos);
router.post('/agenda/eventos', requireAuth, requireModuleEnabled('agendaEventos'), authorize(['admin', 'secretaria']), validateBody(agendaEventoSchema), createEvento);
router.put('/agenda/eventos/:id', requireAuth, requireModuleEnabled('agendaEventos'), authorize(['admin', 'secretaria']), validateBody(agendaEventoSchema), updateEvento);
router.delete('/agenda/eventos/:id', requireAuth, requireModuleEnabled('agendaEventos'), authorize(['admin', 'secretaria']), deleteEvento);

module.exports = router;
