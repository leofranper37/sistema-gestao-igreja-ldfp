const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const {
    getSuperAdminOverview,
    getSaasMetricas,
    getSaasFaturamento,
    getSaasRelatorioFinanceiro,
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
    postFactoryAiSuggest,
    postFactoryPublish,
    listNovidadesPublic,
    listNovidadesAdmin,
    createNovidade,
    updateNovidade,
    deleteNovidade,
    createIgreja,
    deleteIgreja,
    impersonateChurch,
    listUsuariosAdmin,
    postResetSenha,
    listResetRequests
} = require('../controllers/superAdminController');

const {
    listarBackups,
    detalharBackup,
    executarBackup,
    restaurarIgreja
} = require('../controllers/backupController');

const router = express.Router();
const isSuperAdmin = [requireAuth, authorize(['super-admin'])];

// Dashboard
router.get('/super-admin/overview', ...isSuperAdmin, getSuperAdminOverview);

// Métricas SaaS
router.get('/api/saas/metricas', ...isSuperAdmin, getSaasMetricas);

// Relatório Financeiro exportável
router.get('/api/saas/relatorio-financeiro', ...isSuperAdmin, getSaasRelatorioFinanceiro);

// Faturamento MRR
router.get('/api/saas/faturamento', ...isSuperAdmin, getSaasFaturamento);

// Igrejas / Clientes
router.post('/api/saas/igrejas', ...isSuperAdmin, createIgreja);
router.get('/api/saas/igrejas', ...isSuperAdmin, getSaasIgrejas);
router.get('/api/saas/igrejas/:id', ...isSuperAdmin, getSaasIgrejaContrato);
router.patch('/api/saas/igrejas/:id/status', ...isSuperAdmin, patchIgrejaStatus);
router.patch('/api/saas/igrejas/:id/contrato', ...isSuperAdmin, updateSaasIgrejaContrato);
router.delete('/api/saas/igrejas/:id', ...isSuperAdmin, deleteIgreja);
router.post('/api/saas/igrejas/:id/impersonate', ...isSuperAdmin, impersonateChurch);

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

// Fábrica de Inovações
router.post('/api/saas/factory/ai-suggest', ...isSuperAdmin, postFactoryAiSuggest);
router.post('/api/saas/factory/publish', ...isSuperAdmin, postFactoryPublish);

// Novidades (público: sem auth / admin: com auth)
router.get('/api/novidades', listNovidadesPublic);
router.get('/api/saas/novidades', ...isSuperAdmin, listNovidadesAdmin);
router.post('/api/saas/novidades', ...isSuperAdmin, createNovidade);
router.put('/api/saas/novidades/:id', ...isSuperAdmin, updateNovidade);
router.delete('/api/saas/novidades/:id', ...isSuperAdmin, deleteNovidade);

// Usuários e Reset de Senha
router.get('/api/saas/usuarios', ...isSuperAdmin, listUsuariosAdmin);
router.post('/api/saas/usuarios/reset-senha', ...isSuperAdmin, postResetSenha);
router.get('/api/saas/reset-requests', ...isSuperAdmin, listResetRequests);

// Backup & Recuperação de dados por igreja
router.get('/api/saas/backups',                       ...isSuperAdmin, listarBackups);
router.get('/api/saas/backups/:data',                 ...isSuperAdmin, detalharBackup);
router.post('/api/saas/backups/executar',             ...isSuperAdmin, executarBackup);
router.post('/api/saas/backups/restaurar/:igrejaId',  ...isSuperAdmin, restaurarIgreja);

// Acesso efetivo do usuário autenticado (menu/telas)
router.get('/api/modulos/me', requireAuth, getMyEffectiveModules);

// Dados do plano do usuário autenticado
router.get('/api/minha-conta', requireAuth, getMinhaConta);

module.exports = router;
