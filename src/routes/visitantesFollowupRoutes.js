const express = require('express');
const router = express.Router();
const { requireAuth, authorize } = require('../middlewares/auth');
const c = require('../controllers/visitantesFollowupController');

const auth = [requireAuth, authorize(['admin', 'secretaria', 'pastor', 'oficial'])];

// Kanban de Visitantes
router.get('/api/visitantes-followup', ...auth, c.getKanbanData);
router.put('/api/visitantes-followup/:id/status', ...auth, c.updateStatus);
router.get('/api/visitantes-followup/:id/logs', ...auth, c.getFollowups);
router.post('/api/visitantes-followup/:id/logs', ...auth, c.addFollowup);

module.exports = router;