const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const { getRecibos, postRecibo, getRecibo, deleteRecibo } = require('../controllers/reciboController');

const router = express.Router();

router.get('/api/recibos', requireAuth, getRecibos);
router.post('/api/recibos', requireAuth, postRecibo);
router.get('/api/recibos/:id', requireAuth, getRecibo);
router.delete('/api/recibos/:id', requireAuth, deleteRecibo);

module.exports = router;
