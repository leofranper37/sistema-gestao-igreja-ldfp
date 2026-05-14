const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const { cargoSchema, validateBody } = require('../utils/validation');

const {
    createCargo,
    deleteCargo,
    listCargos,
    updateCargo
} = require('../controllers/cargoController');

const router = express.Router();

router.get('/cargos', requireAuth, authorize(['admin', 'secretaria']), listCargos);
router.post('/cargos', requireAuth, authorize(['admin', 'secretaria']), validateBody(cargoSchema), createCargo);
router.put('/cargos/:id', requireAuth, authorize(['admin', 'secretaria']), validateBody(cargoSchema), updateCargo);
router.delete('/cargos/:id', requireAuth, authorize(['admin', 'secretaria']), deleteCargo);

module.exports = router;