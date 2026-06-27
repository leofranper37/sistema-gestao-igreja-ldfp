const router = require('express').Router();
const { requireAuth, authorize } = require('../middlewares/auth');
const c = require('../controllers/gruposController');

const roles = ['admin', 'secretaria', 'pastor', 'financeiro'];
const auth  = [requireAuth, authorize(roles)];

// ── Grupos ──────────────────────────────────────
router.get('/api/grupos',           ...auth, c.listGrupos);
router.post('/api/grupos',          ...auth, c.createGrupo);
router.get('/api/grupos/:id',       ...auth, c.getGrupo);
router.put('/api/grupos/:id',       ...auth, c.updateGrupo);
router.delete('/api/grupos/:id',    ...auth, c.deleteGrupo);

// ── Membros do grupo ─────────────────────────────
router.get('/api/grupos/:id/membros',             ...auth, c.listGrupoMembros);
router.post('/api/grupos/:id/membros',            ...auth, c.addGrupoMembro);
router.delete('/api/grupos/:id/membros/:membroId',...auth, c.deleteGrupoMembro);

// ── Reuniões do grupo ────────────────────────────
router.get('/api/grupos/:id/reunioes',  ...auth, c.listGrupoReunioes);
router.post('/api/grupos/:id/reunioes', ...auth, c.createGrupoReuniao);

// ── Congregados ──────────────────────────────────
router.get('/api/congregados',         ...auth, c.listCongregados);
router.post('/api/congregados',        ...auth, c.createCongregado);
router.put('/api/congregados/:id',     ...auth, c.updateCongregado);
router.delete('/api/congregados/:id',  ...auth, c.deleteCongregado);

module.exports = router;
