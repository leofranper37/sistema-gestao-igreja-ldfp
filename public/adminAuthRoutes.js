const express = require('express');
const router = express.Router();
const adminLoginController = require('../controllers/adminLoginController');

router.post('/api/admin/login', adminLoginController.adminLogin);

module.exports = router;