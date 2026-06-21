const jwt = require('jsonwebtoken');
const config = require('../config');

// Rotas que o super-admin usa diretamente (sem impersonação)
const SUPER_ADMIN_PASS = [
    '/api/saas/',
    '/api/admin/',
    '/super-admin/',
    '/api/modulos/',
    '/api/minha-conta',
    '/api/novidades',
    '/api/push/',
    '/api/pix/',
    '/api/pagamentos/',
    '/api/planos',
    '/api/cadastro-igreja',
    '/api/setup/',
    '/api/reset-request',
    '/webhook',
    '/health',
];

function churchGuard(req, res, next) {
    if (SUPER_ADMIN_PASS.some(p => req.path.startsWith(p))) return next();

    const tok = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!tok) return next();

    let role;
    try {
        ({ role } = jwt.verify(tok, config.security.jwtSecret));
    } catch (_) {
        return next();
    }

    if (role === 'super-admin') {
        return res.status(403).json({
            error: 'Acesso negado. Use o botão "Acessar" em Igrejas & Clientes para entrar no painel de uma igreja.',
            code: 'SUPER_ADMIN_DIRECT_ACCESS',
        });
    }

    next();
}

module.exports = churchGuard;
