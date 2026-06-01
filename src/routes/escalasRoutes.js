const router = require('express').Router();
const { requireAuth, authorize } = require('../middlewares/auth');
const c = require('../controllers/escalasController');

const roles = ['admin', 'secretaria', 'pastor', 'financeiro'];
const auth  = [requireAuth, authorize(roles)];

// Dashboard
router.get('/api/escalas/dashboard',     ...auth, c.getDashboard);

// Eventos
router.get('/api/escalas/eventos',       ...auth, c.listEventos);
router.post('/api/escalas/eventos',      ...auth, c.createEvento);
router.get('/api/escalas/eventos/:id',   ...auth, c.getEvento);
router.put('/api/escalas/eventos/:id',   ...auth, c.updateEvento);
router.delete('/api/escalas/eventos/:id',...auth, c.deleteEvento);

// Instâncias
router.get('/api/escalas/eventos/:id/instancias', ...auth, c.listInstancias);
router.put('/api/escalas/instancias/:id',          ...auth, c.updateInstancia);

// Grupos
router.get('/api/escalas/grupos',        ...auth, c.listGrupos);
router.post('/api/escalas/grupos',       ...auth, c.createGrupo);
router.put('/api/escalas/grupos/:id',    ...auth, c.updateGrupo);
router.delete('/api/escalas/grupos/:id', ...auth, c.deleteGrupo);

// Funções
router.get('/api/escalas/funcoes',        ...auth, c.listFuncoes);
router.post('/api/escalas/funcoes',       ...auth, c.createFuncao);
router.put('/api/escalas/funcoes/:id',    ...auth, c.updateFuncao);
router.delete('/api/escalas/funcoes/:id', ...auth, c.deleteFuncao);

// Matriz
router.get('/api/escalas/matriz',        ...auth, c.getMatriz);

// Atribuições
router.post('/api/escalas/atribuicoes',        ...auth, c.createAtribuicao);
router.delete('/api/escalas/atribuicoes/:id',  ...auth, c.deleteAtribuicao);

// Conflitos
router.get('/api/escalas/conflitos',     ...auth, c.listConflitos);

// Membros (lista simples para modal de atribuição)
router.get('/api/escalas/membros',       ...auth, c.listMembros);

module.exports = router;
