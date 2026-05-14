const express = require('express');

const { createConta, login, esqueciSenha, redefinirSenha } = require('../controllers/accountController');
const { createContaSchema, loginSchema, validateBody } = require('../utils/validation');

const router = express.Router();

// Rota publica de autocadastro.
router.post('/criar-conta', validateBody(createContaSchema), createConta);
router.post('/login', validateBody(loginSchema), login);
router.post('/esqueci-senha', esqueciSenha);
router.post('/redefinir-senha', redefinirSenha);

module.exports = router;