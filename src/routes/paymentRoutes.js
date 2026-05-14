const express = require('express');
const { requireAuth } = require('../middlewares/auth');
const {
	gerarPix,
	gerarCartao,
	listarPlanos,
	statusAssinatura,
	webhookMercadoPago
} = require('../controllers/paymentController');

const router = express.Router();

// Planos públicos (landing/assinatura)
router.get('/api/pagamentos/planos', listarPlanos);

// Pagamentos autenticados
router.post('/api/pagamentos/pix', requireAuth, gerarPix);
router.post('/api/pagamentos/cartao', requireAuth, gerarCartao);
router.get('/api/pagamentos/status', requireAuth, statusAssinatura);

// Webhook de provedor de pagamento
router.post('/api/pagamentos/webhook/mercado-pago', webhookMercadoPago);

module.exports = router;
