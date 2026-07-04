const express = require('express');
const { getIgrejaPublica, registrarVisita } = require('../controllers/visitaPublicaController');
const rateLimit = require('express-rate-limit');

const router = express.Router();

// Limite conservador para o endpoint de cadastro (evita spam)
const visitaLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    message: { error: 'Muitas tentativas. Aguarde alguns minutos.' },
    standardHeaders: 'draft-7',
    legacyHeaders: false
});

router.get('/api/visita/:slug', getIgrejaPublica);
router.post('/api/visita/:slug', visitaLimiter, registrarVisita);

module.exports = router;
