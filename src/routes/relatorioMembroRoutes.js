'use strict';

const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const { getRelatorioMembro } = require('../controllers/relatorioMembroController');

const router = express.Router();

router.get(
    '/api/membros/:id/relatorio',
    requireAuth,
    authorize(['admin', 'secretaria', 'pastor', 'financeiro']),
    getRelatorioMembro
);

module.exports = router;
