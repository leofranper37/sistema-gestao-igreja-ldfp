const express = require('express');
const { listPlanosPublico } = require('../controllers/superAdminController');

const { createConta, login, esqueciSenha, redefinirSenha } = require('../controllers/accountController');
const { createContaSchema, loginSchema, validateBody } = require('../utils/validation');

const router = express.Router();

// Rota publica de autocadastro.
router.get('/api/planos', listPlanosPublico);
router.post('/criar-conta', validateBody(createContaSchema), createConta);
router.post('/api/cadastro-igreja', validateBody(createContaSchema), createConta);
router.post('/login', validateBody(loginSchema), login);
router.post('/esqueci-senha', esqueciSenha);
router.post('/redefinir-senha', redefinirSenha);

module.exports = router;