const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { audit } = require('../services/auditService');
const config = require('../config');
const doisFatores = require('../services/doisFatoresService');

const SUPER_ROLES = ['super-admin', 'super_admin', 'superadmin', 'master', 'owner', 'root'];

// Antes: importava `pool`/`audit` como módulo (quebrava em toda chamada) e gravava a
// senha recebida no log. Lote 7: corrigido + verificação em duas etapas
// (com 2FA ativo, a página reenvia e-mail + senha + `codigo`).
exports.adminLogin = async (req, res) => {
  const { email, password, codigo } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const emailNorm = String(email).toLowerCase().trim();
    const [rows] = await pool.query('SELECT id, email, password_hash, role, igreja_id, nome FROM usuarios WHERE email = ?', [emailNorm]);
    const user = rows[0];

    if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
      audit('LOGIN_FAIL_ADMIN', req, { email: emailNorm, reason: 'Credenciais inválidas' });
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    if (!SUPER_ROLES.includes(String(user.role).toLowerCase())) {
      audit('LOGIN_FAIL_ADMIN', req, { email: emailNorm, reason: 'Tentativa de login admin por não-super-admin' });
      return res.status(403).json({ error: 'Acesso não autorizado para administradores.' });
    }

    if (await doisFatores.estaAtivo(user.id)) {
      if (!codigo) {
        return res.json({ requer_2fa: true, message: 'Digite o código do seu aplicativo autenticador.' });
      }
      const u = await doisFatores.lerUsuario(user.id);
      if (!(await doisFatores.conferirCodigo(u, codigo))) {
        audit('LOGIN_FAIL_ADMIN', req, { email: emailNorm, reason: 'Código 2FA incorreto' });
        return res.status(401).json({ error: 'Código incorreto.' });
      }
    }

    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, igrejaId: user.igreja_id },
      config.security.jwtSecret,
      { expiresIn: '8h' }
    );

    audit('LOGIN_SUCCESS_ADMIN', req, { email: emailNorm, role: user.role });
    res.json({ token, user: { id: user.id, nome: user.nome, email: user.email, role: user.role, igrejaId: user.igreja_id } });

  } catch (error) {
    console.error('Erro no login de admin:', error.message);
    res.status(500).json({ error: 'Erro interno do servidor.' });
  }
};
