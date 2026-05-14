const express = require('express');

const { authorize, requireAuth } = require('../middlewares/auth');
const { requireModuleEnabled } = require('../middlewares/entitlements');
const {
    congregadoFiltroSchema,
    congregadoSchema,
    criancaFiltroSchema,
    criancaSchema,
    membroFiltroSchema,
    membroSchema,
    oracaoFiltroSchema,
    oracaoRespostaSchema,
    oracaoSchema,
    validateBody,
    validateQuery,
    visitanteFiltroSchema,
    visitanteSchema
} = require('../utils/validation');

const {
    createCrianca,
    createCongregado,
    createMembro,
    createOracao,
    createVisitante,
    deleteCrianca,
    deleteCongregado,
    deleteOracao,
    deleteVisitante,
    getHealth,
    getTotalVisitantes,
    listCriancas,
    listCongregados,
    listMuralOracoes,
    listMembros,
    listMyOracoes,
    listVisitantes,
    updateCrianca,
    updateCongregado,
    updateOracao,
    updateOracaoResposta,
    updateVisitante
} = require('../controllers/systemController');

const router = express.Router();

router.get('/health', getHealth);

router.get('/membros', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial', 'ministerio']), validateQuery(membroFiltroSchema), listMembros);
router.post('/membros', requireAuth, authorize(['admin', 'secretaria']), validateBody(membroSchema), createMembro);
router.get('/visitantes', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial']), validateQuery(visitanteFiltroSchema), listVisitantes);
router.post('/visitantes', requireAuth, authorize(['admin', 'secretaria', 'oficial']), validateBody(visitanteSchema), createVisitante);
router.put('/visitantes/:id', requireAuth, authorize(['admin', 'secretaria', 'oficial']), validateBody(visitanteSchema), updateVisitante);
router.delete('/visitantes/:id', requireAuth, authorize(['admin', 'secretaria']), deleteVisitante);
router.get('/congregados', requireAuth, authorize(['admin', 'secretaria']), validateQuery(congregadoFiltroSchema), listCongregados);
router.post('/congregados', requireAuth, authorize(['admin', 'secretaria']), validateBody(congregadoSchema), createCongregado);
router.put('/congregados/:id', requireAuth, authorize(['admin', 'secretaria']), validateBody(congregadoSchema), updateCongregado);
router.delete('/congregados/:id', requireAuth, authorize(['admin', 'secretaria']), deleteCongregado);
router.get('/criancas', requireAuth, authorize(['admin', 'secretaria']), validateQuery(criancaFiltroSchema), listCriancas);
router.post('/criancas', requireAuth, authorize(['admin', 'secretaria']), validateBody(criancaSchema), createCrianca);
router.put('/criancas/:id', requireAuth, authorize(['admin', 'secretaria']), validateBody(criancaSchema), updateCrianca);
router.delete('/criancas/:id', requireAuth, authorize(['admin', 'secretaria']), deleteCrianca);
router.get('/oracoes/meus', requireAuth, requireModuleEnabled('pedidosOracao'), authorize(['admin', 'secretaria', 'membro', 'financeiro', 'pastor', 'oficial', 'ministerio', 'visitante']), validateQuery(oracaoFiltroSchema), listMyOracoes);
router.get('/oracoes/mural', requireAuth, requireModuleEnabled('muralOracao'), authorize(['admin', 'secretaria', 'membro', 'financeiro', 'pastor', 'oficial', 'ministerio', 'visitante']), listMuralOracoes);
router.post('/oracoes', requireAuth, requireModuleEnabled('pedidosOracao'), authorize(['admin', 'secretaria', 'membro', 'financeiro', 'pastor', 'oficial', 'ministerio', 'visitante']), validateBody(oracaoSchema), createOracao);
router.put('/oracoes/:id', requireAuth, requireModuleEnabled('pedidosOracao'), authorize(['admin', 'secretaria', 'membro', 'financeiro', 'pastor', 'oficial', 'ministerio', 'visitante']), validateBody(oracaoSchema), updateOracao);
router.put('/oracoes/:id/resposta', requireAuth, requireModuleEnabled('pedidosOracao'), authorize(['admin', 'secretaria', 'pastor']), validateBody(oracaoRespostaSchema), updateOracaoResposta);
router.delete('/oracoes/:id', requireAuth, requireModuleEnabled('pedidosOracao'), authorize(['admin', 'secretaria', 'membro', 'financeiro', 'pastor', 'oficial', 'ministerio', 'visitante']), deleteOracao);
router.get('/total-visitantes', requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial']), getTotalVisitantes);

module.exports = router;