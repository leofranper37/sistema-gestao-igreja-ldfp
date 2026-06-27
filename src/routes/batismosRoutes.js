'use strict';
const express = require('express');
const { requireAuth, authorize } = require('../middlewares/auth');
const {
    listBatismos, getBatismo, createBatismo, updateBatismo, deleteBatismo,
    addCandidato, updateCandidato, deleteCandidato,
} = require('../controllers/batismosController');

const router = express.Router();
const roles  = ['admin', 'secretaria', 'pastor', 'financeiro'];

router.get   ('/api/batismos',                        requireAuth, authorize(roles), listBatismos);
router.post  ('/api/batismos',                        requireAuth, authorize(roles), createBatismo);
router.get   ('/api/batismos/:id',                    requireAuth, authorize(roles), getBatismo);
router.put   ('/api/batismos/:id',                    requireAuth, authorize(roles), updateBatismo);
router.delete('/api/batismos/:id',                    requireAuth, authorize(roles), deleteBatismo);
router.post  ('/api/batismos/:id/candidatos',         requireAuth, authorize(roles), addCandidato);
router.put   ('/api/batismos/:id/candidatos/:cid',    requireAuth, authorize(roles), updateCandidato);
router.delete('/api/batismos/:id/candidatos/:cid',    requireAuth, authorize(roles), deleteCandidato);

module.exports = router;
