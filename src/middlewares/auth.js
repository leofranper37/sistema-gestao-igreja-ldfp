const jwt = require('jsonwebtoken');
const config = require('../config');
const { pool } = require('../config/db');
const moduleAccessService = require('../services/moduleAccessService');
const { createHttpError } = require('../utils/httpError');

async function resolveToken(req, allowQueryParam = false) {
    const authorization = req.headers.authorization || '';
    if (authorization.startsWith('Bearer ')) {
        return authorization.slice('Bearer '.length).trim();
    }
    if (allowQueryParam && typeof req.query?.token === 'string') {
        return req.query.token.trim();
    }
    return null;
}

async function requireAuth(req, res, next) {
    const token = await resolveToken(req, false);

    if (!token) {
        return next(createHttpError(401, 'Token de acesso não informado.'));
    }

    try {
        const payload = jwt.verify(token, config.security.jwtSecret);

        // Token do App do Membro (app_mode=true) — busca na tabela membros, não usuarios
        if (payload.app_mode) {
            req.auth = {
                ...payload,
                id: payload.membro_id || payload.id,
                userId: payload.membro_id || payload.id,
                moduleFeatures: []
            };
            return next();
        }

        // Token restrito do App do Membro (senha padrão): só serve para trocar a senha
        if (payload.app_troca_senha) {
            return next(createHttpError(401, 'Crie sua nova senha para entrar no app.'));
        }

        const [rows] = await pool.query(
            `SELECT u.id, u.nome, u.email, u.igreja, u.igreja_id, u.role,
                    i.plano, i.status_assinatura, i.trial_starts_at, i.trial_ends_at,
                    i.max_cadastros, i.max_congregacoes
             FROM usuarios u
             LEFT JOIN igrejas i ON i.id = u.igreja_id
             WHERE u.id = ?
             LIMIT 1`,
            [payload.sub]
        );

        const user = rows[0];

        if (!user) {
            return next(createHttpError(401, 'Usuário do token não encontrado.'));
        }

        req.auth = {
            ...payload,
            id: user.id,
            nome: user.nome,
            email: user.email,
            igreja: user.igreja,
            igrejaId: user.igreja_id,
            role: user.role,
            plano: user.plano || 'hebrom',
            statusAssinatura: user.status_assinatura || 'ativa',
            trialStartsAt: user.trial_starts_at || null,
            trialEndsAt: user.trial_ends_at || null,
            maxCadastros: user.max_cadastros || 40,
            maxCongregacoes: user.max_congregacoes || 1,
            moduleFeatures: []
        };

        try {
            const access = await moduleAccessService.getEffectiveAccessForChurch(
                user.igreja_id,
                user.plano || 'hebrom'
            );
            req.auth.moduleFeatures = access.featureKeys || [];
        } catch (_) {
            req.auth.moduleFeatures = [];
        }

        next();
    } catch (error) {
        next(createHttpError(401, 'Token inválido ou expirado.'));
    }
}

async function requireAuthSSE(req, res, next) {
    const token = await resolveToken(req, true);

    if (!token) {
        return next(createHttpError(401, 'Token de acesso não informado.'));
    }

    // Reutiliza o mesmo fluxo de validação substituindo o token resolvido
    const fakeReq = Object.assign(Object.create(req), req, {
        headers: { ...req.headers, authorization: `Bearer ${token}` },
    });

    return requireAuth(fakeReq, res, (err) => {
        if (!err) req.auth = fakeReq.auth;
        next(err);
    });
}

const PAPEIS_EQUIVALENTES = {
    tesoureiro: ['tesoureiro', 'financeiro'],
    financeiro: ['financeiro', 'tesoureiro']
};

function authorize(allowedRoles = []) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    return (req, res, next) => {
        if (!req.auth) {
            return next(createHttpError(401, 'Usuário não autenticado.'));
        }

        if (!roles.length) {
            return next();
        }

        // "tesoureiro" e "financeiro" sao o mesmo perfil (Tesouraria): quem tem um
        // deles recebe as permissoes dos dois.
        const papel = req.auth.role;
        const equivalentes = PAPEIS_EQUIVALENTES[papel] || [papel];
        if (!equivalentes.some((p) => roles.includes(p))) {
            return next(createHttpError(403, 'Acesso negado para este perfil.'));
        }

        next();
    };
}

module.exports = { authorize, requireAuth, requireAuthSSE };