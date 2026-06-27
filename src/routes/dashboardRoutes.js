'use strict';

const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const { getStats } = require('../controllers/dashboardController');

const router = express.Router();

router.get(
    '/api/dashboard/stats',
    requireAuth,
    authorize(['admin', 'secretaria', 'pastor', 'financeiro', 'oficial', 'ministerio']),
    getStats
);

module.exports = router;
