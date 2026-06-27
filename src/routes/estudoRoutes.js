const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middlewares/auth');
const estudoController = require('../controllers/estudoController');

// Versões
router.get('/versoes', estudoController.getVersoes); // Endpoint público ou protegido para listagem

// Passagens e busca
router.get('/passagens', requireAuth, estudoController.getPassagens);
router.get('/busca', requireAuth, estudoController.buscaPassagens);

// Anotações
router.get('/anotacoes', requireAuth, estudoController.getAnotacoes);
router.post('/anotacoes', requireAuth, estudoController.saveAnotacao);
router.delete('/anotacoes/:id', requireAuth, estudoController.deleteAnotacao);

// Favoritos
router.get('/favoritos', requireAuth, estudoController.getFavoritos);
router.post('/favoritos', requireAuth, estudoController.addFavorito);
router.delete('/favoritos/:id', requireAuth, estudoController.deleteFavorito);

// Planos
router.get('/planos', requireAuth, estudoController.getPlanos);
router.get('/planos/:id', requireAuth, estudoController.getPlanoDetalhe);
router.post('/planos/:id/progresso', requireAuth, estudoController.updateProgresso);

// Devocionais
router.get('/devocional/hoje', requireAuth, estudoController.getDevocionalHoje);

const adminAuth = [requireAuth, authorize(['admin', 'secretaria', 'pastor'])];
router.get('/admin/devocionais', ...adminAuth, estudoController.listDevocionais);
router.get('/admin/devocionais/:id', ...adminAuth, estudoController.getDevocional);
router.post('/admin/devocionais', ...adminAuth, estudoController.createDevocional);
router.put('/admin/devocionais/:id', ...adminAuth, estudoController.updateDevocional);
router.delete('/admin/devocionais/:id', ...adminAuth, estudoController.deleteDevocional);

// Planos Admin
router.get('/admin/planos', ...adminAuth, estudoController.listAdminPlanos);
router.get('/admin/planos/:id', ...adminAuth, estudoController.getAdminPlano);
router.post('/admin/planos', ...adminAuth, estudoController.createAdminPlano);
router.put('/admin/planos/:id', ...adminAuth, estudoController.updateAdminPlano);
router.delete('/admin/planos/:id', ...adminAuth, estudoController.deleteAdminPlano);

module.exports = router;