const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const audit = require('../services/auditService');
const config = require('../config');

exports.adminLogin = async (req, res) => {
  const { email, password } = req.body;
  console.log('DADOS RECEBIDOS NO BODY:', req.body);

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const [rows] = await pool.query('SELECT id, email, password_hash, role, igreja_id, nome FROM usuarios WHERE email = ?', [email]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      audit('LOGIN_FAIL_ADMIN', req, { email }, { reason: 'Credenciais inválidas' });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const superRoles = ['super-admin', 'super_admin', 'superadmin', 'master', 'owner', 'root'];

    if (!superRoles.includes(String(user.role).toLowerCase())) {
      audit('LOGIN_FAIL_ADMIN', req, { email }, { reason: 'Tentativa de login admin por não-super-admin' });
      return res.status(403).json({ error: 'Acesso não autorizado para administradores.' });
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, igrejaId: user.igreja_id },
      config.security.jwtSecret,
      { expiresIn: '8h' }
    );

    audit('LOGIN_SUCCESS_ADMIN', req, { email, role: user.role });
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role, igrejaId: user.igreja_id } });

  } catch (error) {
    console.error('Erro no login de admin:', error);
    audit('LOGIN_ERROR_ADMIN', req, { email, error: error.message });
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};