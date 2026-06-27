const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const {
    missionariosQuerySchema,
    missionariosSchema,
    validateBody,
    validateQuery
} = require('../utils/validation');
const {
    createMissionario,
    deleteMissionario,
    listMissionarios,
    updateMissionario
} = require('../controllers/missionariosController');

const router = express.Router();

router.get('/missionarios', requireAuth, authorize(['admin', 'secretaria']), validateQuery(missionariosQuerySchema), listMissionarios);
router.post('/missionarios', requireAuth, authorize(['admin', 'secretaria']), validateBody(missionariosSchema), createMissionario);
router.put('/missionarios/:id', requireAuth, authorize(['admin', 'secretaria']), validateBody(missionariosSchema), updateMissionario);
router.delete('/missionarios/:id', requireAuth, authorize(['admin', 'secretaria']), deleteMissionario);

module.exports = router;
