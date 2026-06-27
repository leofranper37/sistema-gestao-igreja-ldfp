const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/auth');
const pixController = require('../controllers/pixController');

// Rota acessível pelo app do membro para gerar o PIX
router.post('/gerar', requireAuth, pixController.gerarPix);

module.exports = router;