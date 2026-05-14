const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const { requireModuleEnabled } = require('../middlewares/entitlements');
const {
    autocadastroAprovarSchema,
    autocadastroPublicoSchema,
    autocadastroStatusQuerySchema,
    checkinSchema,
    midiaVisitanteQuerySchema,
    midiaVisitanteStatusSchema,
    pagamentoLinkSchema,
    portariaCheckinQuerySchema,
    qrSessionSchema,
    triggerEventoSchema,
    triggerOracaoSchema,
    triggerVisitanteSchema,
    validateBody,
    validateQuery,
    visitanteQrPublicoSchema,
    whatsappDispatchSchema,
    whatsappLogQuerySchema,
    whatsappTemplateSchema
} = require('../utils/validation');
const {
    approveAutocadastro,
    createAutocadastro,
    createPaymentLink,
    createPortariaCheckin,
    createQrSession,
    createWhatsAppTemplate,
    dispatchWhatsApp,
    getAuthMe,
    getMemberPermissions,
    getMemberAppContext,
    getPaymentLinkPublic,
    loginMembroApp,
    primeiroAcessoMembroApp,
    getMeuPerfilApp,
    getQrSessionPublic,
    listAutocadastros,
    listMidiaVisitors,
    listPaymentLinks,
    listPortariaCheckins,
    listTelaoVisitors,
    listWhatsAppLogs,
    listWhatsAppTemplates,
    markPaymentAsPaid,
    reportPaymentAsPaidByClient,
    rejectAutocadastro,
    submitPublicVisitorByToken,
    triggerEventoLembrete,
    triggerOracaoResposta,
    triggerVisitanteBoasVindas,
    updateMidiaVisitorStatus,
    updateWhatsAppTemplate
} = require('../controllers/engagementController');

const router = express.Router();

// Rotas públicas do App de Membros (autenticação por CPF)
router.post('/app-membro/login', loginMembroApp);
router.post('/app-membro/primeiro-acesso', primeiroAcessoMembroApp);
router.get('/app-membro/meu-perfil', getMeuPerfilApp);

router.get('/auth/me', requireAuth, getAuthMe);
router.get('/app-membro/context', requireAuth, requireModuleEnabled('appMembro'), getMemberAppContext);
router.get('/app-membro/permissions', requireAuth, requireModuleEnabled('appMembro'), getMemberPermissions);

router.post('/autocadastro', validateBody(autocadastroPublicoSchema), createAutocadastro);
router.get('/autocadastro', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateQuery(autocadastroStatusQuerySchema), listAutocadastros);
router.put('/autocadastro/:id/aprovar', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(autocadastroAprovarSchema), approveAutocadastro);
router.put('/autocadastro/:id/rejeitar', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(autocadastroAprovarSchema), rejectAutocadastro);

router.get('/comunicacao/whatsapp/templates', requireAuth, authorize(['admin', 'secretaria', 'pastor']), listWhatsAppTemplates);
router.post('/comunicacao/whatsapp/templates', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(whatsappTemplateSchema), createWhatsAppTemplate);
router.put('/comunicacao/whatsapp/templates/:id', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(whatsappTemplateSchema), updateWhatsAppTemplate);
router.get('/comunicacao/whatsapp/logs', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial']), validateQuery(whatsappLogQuerySchema), listWhatsAppLogs);
router.post('/comunicacao/whatsapp/disparar', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial']), validateBody(whatsappDispatchSchema), dispatchWhatsApp);

router.post('/comunicacao/whatsapp/gatilhos/visitante-boas-vindas', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial']), validateBody(triggerVisitanteSchema), triggerVisitanteBoasVindas);
router.post('/comunicacao/whatsapp/gatilhos/evento-lembrete', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(triggerEventoSchema), triggerEventoLembrete);
router.post('/comunicacao/whatsapp/gatilhos/oracao-resposta', requireAuth, authorize(['admin', 'secretaria', 'pastor']), validateBody(triggerOracaoSchema), triggerOracaoResposta);

router.get('/portaria/checkins', requireAuth, authorize(['admin', 'secretaria', 'oficial']), validateQuery(portariaCheckinQuerySchema), listPortariaCheckins);
router.post('/portaria/checkins', requireAuth, authorize(['admin', 'secretaria', 'oficial']), validateBody(checkinSchema), createPortariaCheckin);
router.post('/portaria/qr-sessoes', requireAuth, authorize(['admin', 'secretaria', 'oficial']), validateBody(qrSessionSchema), createQrSession);
router.get('/portaria/qr-sessoes/:token/public', getQrSessionPublic);
router.post('/portaria/qr-sessoes/:token/visitantes', validateBody(visitanteQrPublicoSchema), submitPublicVisitorByToken);

router.get('/midia/visitantes', requireAuth, requireModuleEnabled('appMidia'), authorize(['admin', 'secretaria', 'midia', 'pastor']), validateQuery(midiaVisitanteQuerySchema), listMidiaVisitors);
router.put('/midia/visitantes/:id/status', requireAuth, requireModuleEnabled('appMidia'), authorize(['admin', 'secretaria', 'midia']), validateBody(midiaVisitanteStatusSchema), updateMidiaVisitorStatus);
router.get('/midia/telao/visitantes', requireAuth, requireModuleEnabled('appMidia'), authorize(['admin', 'secretaria', 'midia', 'pastor']), listTelaoVisitors);

router.get('/pagamentos/publico/:referenceCode', getPaymentLinkPublic);
router.put('/pagamentos/publico/:referenceCode/cliente-pago', reportPaymentAsPaidByClient);

router.get('/pagamentos/links', requireAuth, authorize(['admin', 'secretaria', 'financeiro']), listPaymentLinks);
router.post('/pagamentos/links', requireAuth, authorize(['admin', 'secretaria', 'financeiro']), validateBody(pagamentoLinkSchema), createPaymentLink);
router.put('/pagamentos/links/:id/pago', requireAuth, authorize(['admin', 'secretaria', 'financeiro']), markPaymentAsPaid);

module.exports = router;
