/**
 * checkSubscription.js
 * Middleware que bloqueia acesso a rotas da API quando a assinatura expirou.
 * Super-admins e rotas de pagamento/login são sempre liberados.
 */

const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

// Rotas que NÃO devem ser bloqueadas mesmo com assinatura inativa
const ROTAS_LIVRES = [
    '/login',
    '/criar-conta',
    '/api/pagamentos',
    '/api/setup',
    '/super-admin',
    '/realtime',
];

function isRotaLivre(path) {
    return ROTAS_LIVRES.some(prefixo => path.startsWith(prefixo));
}

async function checkSubscription(req, res, next) {
    // Sem autenticação ainda — deixa passar (o requireAuth cuidará)
    if (!req.auth) return next();

    // Super-admin nunca é bloqueado
    if (req.auth.role === 'super-admin') return next();

    // Rotas de pagamento, login e setup nunca bloqueadas
    if (isRotaLivre(req.path)) return next();

    const statusAssinatura = req.auth.statusAssinatura;
    const trialEndsAt = req.auth.trialEndsAt ? new Date(req.auth.trialEndsAt) : null;
    const agora = new Date();

    // Se está em trial e o trial ainda é válido, libera
    if (statusAssinatura === 'trial') {
        if (!trialEndsAt || trialEndsAt > agora) return next();

        // Trial expirado — atualiza no banco (uma única vez)
        try {
            await pool.query(
                `UPDATE igrejas SET status_assinatura = 'cancelado' WHERE id = ? AND status_assinatura = 'trial'`,
                [req.auth.igrejaId]
            );
        } catch (_) { /* não bloqueia a resposta por erro de DB */ }

        return next(createHttpError(402, 'Seu período de teste encerrou. Assine um plano para continuar.'));
    }

    // Assinatura ativa ou status não previsto → libera
    if (statusAssinatura === 'ativa') return next();

    // Cancelado, suspenso ou expirado
    if (['cancelado', 'suspensa', 'inativa', 'expirado'].includes(statusAssinatura)) {
        return next(createHttpError(402, 'Assinatura inativa. Acesse a página de planos para reativar.'));
    }

    next();
}

module.exports = { checkSubscription };
