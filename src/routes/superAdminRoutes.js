const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const {
    getSuperAdminOverview,
    getSaasFaturamento,
    getSaasIgrejas,
    getSaasIgrejaContrato,
    patchIgrejaStatus,
    updateSaasIgrejaContrato,
    listPlanos,
    getPlano,
    updatePlano,
    listSaasAssinaturas,
    markSaasAssinaturaPaga,
    listSaasModulos,
    createSaasModulo,
    updateSaasModulo,
    getPlanoModulos,
    putPlanoModulos,
    getIgrejaModulos,
    putIgrejaModulos,
    getMyEffectiveModules,
    getMinhaConta,
    getSistemaConfig,
    putSistemaConfig,
    getSistemaDiagnostico,
    getRetomada,
    putRetomada,
    postRetomadaCheckpoint,
    postFactoryAiSuggest
} = require('../controllers/superAdminController');

const router = express.Router();
const isSuperAdmin = [requireAuth, authorize(['super-admin', 'admin'])];

// Dashboard
router.get('/super-admin/overview', ...isSuperAdmin, getSuperAdminOverview);

// Faturamento MRR
router.get('/api/saas/faturamento', ...isSuperAdmin, getSaasFaturamento);

// Igrejas / Clientes
router.get('/api/saas/igrejas', ...isSuperAdmin, getSaasIgrejas);
router.get('/api/saas/igrejas/:id', ...isSuperAdmin, getSaasIgrejaContrato);
router.patch('/api/saas/igrejas/:id/status', ...isSuperAdmin, patchIgrejaStatus);
router.patch('/api/saas/igrejas/:id/contrato', ...isSuperAdmin, updateSaasIgrejaContrato);

// Planos
router.get('/api/saas/planos', ...isSuperAdmin, listPlanos);
router.get('/api/saas/planos/:slug', ...isSuperAdmin, getPlano);
router.put('/api/saas/planos/:slug', ...isSuperAdmin, updatePlano);

// Assinaturas & Faturas
router.get('/api/saas/assinaturas', ...isSuperAdmin, listSaasAssinaturas);
router.put('/api/saas/assinaturas/:id/pago', ...isSuperAdmin, markSaasAssinaturaPaga);

// Catálogo de Módulos
router.get('/api/saas/modulos', ...isSuperAdmin, listSaasModulos);
router.post('/api/saas/modulos', ...isSuperAdmin, createSaasModulo);
router.patch('/api/saas/modulos/:slug', ...isSuperAdmin, updateSaasModulo);

// Módulos por Plano
router.get('/api/saas/planos/:slug/modulos', ...isSuperAdmin, getPlanoModulos);
router.put('/api/saas/planos/:slug/modulos', ...isSuperAdmin, putPlanoModulos);

// Módulos por Igreja
router.get('/api/saas/igrejas/:id/modulos', ...isSuperAdmin, getIgrejaModulos);
router.put('/api/saas/igrejas/:id/modulos', ...isSuperAdmin, putIgrejaModulos);

// Sistema: Configuração Global e Diagnóstico
router.get('/api/saas/sistema/config', ...isSuperAdmin, getSistemaConfig);
router.put('/api/saas/sistema/config', ...isSuperAdmin, putSistemaConfig);
router.get('/api/saas/sistema/diagnostico', ...isSuperAdmin, getSistemaDiagnostico);

// Retomada Inteligente
router.get('/api/saas/retomada', ...isSuperAdmin, getRetomada);
router.put('/api/saas/retomada', ...isSuperAdmin, putRetomada);
router.post('/api/saas/retomada/checkpoint', ...isSuperAdmin, postRetomadaCheckpoint);

// Fábrica de Inovações (AI)
router.post('/api/saas/factory/ai-suggest', ...isSuperAdmin, postFactoryAiSuggest);

// Acesso efetivo do usuário autenticado (menu/telas)
router.get('/api/modulos/me', requireAuth, getMyEffectiveModules);

// Dados do plano do usuário autenticado
router.get('/api/minha-conta', requireAuth, getMinhaConta);

module.exports = router;
