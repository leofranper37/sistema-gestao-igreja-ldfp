'use strict';
const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const {
    listCriancas, getCrianca, createCrianca, updateCrianca, deleteCrianca,
} = require('../controllers/criancasController');

const router = express.Router();
const roles  = ['admin', 'secretaria', 'pastor', 'financeiro'];

router.get   ('/api/criancas',     requireAuth, authorize(roles), listCriancas);
router.post  ('/api/criancas',     requireAuth, authorize(roles), createCrianca);
router.get   ('/api/criancas/:id', requireAuth, authorize(roles), getCrianca);
router.put   ('/api/criancas/:id', requireAuth, authorize(roles), updateCrianca);
router.delete('/api/criancas/:id', requireAuth, authorize(roles), deleteCrianca);

module.exports = router;
