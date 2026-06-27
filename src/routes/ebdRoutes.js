const router = require('express').Router();
const { requireAuth, authorize } = require('../middlewares/auth');
const c = require('../controllers/ebdController');

const roles = ['admin', 'secretaria', 'pastor', 'financeiro'];
const auth  = [requireAuth, authorize(roles)];

// ── Turmas ───────────────────────────────────────────────
router.get   ('/api/ebd/turmas',         ...auth, c.listTurmas);
router.post  ('/api/ebd/turmas',         ...auth, c.createTurma);
router.get   ('/api/ebd/turmas/:id',     ...auth, c.getTurma);
router.put   ('/api/ebd/turmas/:id',     ...auth, c.updateTurma);
router.delete('/api/ebd/turmas/:id',     ...auth, c.deleteTurma);

// ── Alunos ───────────────────────────────────────────────
router.get   ('/api/ebd/alunos',         ...auth, c.listAlunos);
router.post  ('/api/ebd/alunos',         ...auth, c.createAluno);
router.get   ('/api/ebd/alunos/:id',     ...auth, c.getAluno);
router.put   ('/api/ebd/alunos/:id',     ...auth, c.updateAluno);
router.delete('/api/ebd/alunos/:id',     ...auth, c.deleteAluno);

// ── Apontamentos ─────────────────────────────────────────
router.get   ('/api/ebd/apontamentos',      ...auth, c.listApontamentos);
router.post  ('/api/ebd/apontamentos',      ...auth, c.createApontamento);
router.get   ('/api/ebd/apontamentos/:id',  ...auth, c.getApontamento);
router.put   ('/api/ebd/apontamentos/:id',  ...auth, c.updateApontamento);
router.delete('/api/ebd/apontamentos/:id',  ...auth, c.deleteApontamento);

module.exports = router;
