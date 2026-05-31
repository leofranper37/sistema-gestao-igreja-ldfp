const express = require('express');
const { listPlanosPublico } = require('../controllers/superAdminController');

const { createConta, login, esqueciSenha, redefinirSenha } = require('../controllers/accountController');
const { createContaSchema, loginSchema, validateBody } = require('../utils/validation');
const { pool } = require('../config/db');

const router = express.Router();

// Rota publica de autocadastro.
router.get('/api/planos', listPlanosPublico);
router.post('/criar-conta', validateBody(createContaSchema), createConta);
router.post('/api/cadastro-igreja', validateBody(createContaSchema), createConta);
router.post('/login', validateBody(loginSchema), login);
router.post('/esqueci-senha', esqueciSenha);
router.post('/redefinir-senha', redefinirSenha);

// Solicitar redefinição de senha via admin (registra pedido)
router.post('/api/reset-request', async (req, res) => {
    try {
        const { email } = req.body || {};
        if (!email) return res.status(400).json({ error: 'E-mail obrigatório.' });
        const emailNorm = email.toLowerCase().trim();
        const [users] = await pool.query(
            `SELECT id, nome FROM usuarios WHERE email = ? LIMIT 1`, [emailNorm]
        );
        if (!users.length) return res.json({ ok: true }); // Não revelar se e-mail existe
        const nome = users[0].nome || '';
        await pool.query(
            `INSERT INTO password_reset_requests (email, nome, status) VALUES (?, ?, 'pendente')`,
            [emailNorm, nome]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;