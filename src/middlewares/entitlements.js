const { createHttpError } = require('../utils/httpError');

function normalizeModuleValue(value) {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value > 0;
    }

    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        return ['1', 'true', 'sim', 'yes', 'ativo', 'enabled'].includes(v);
    }

    return false;
}

function isModuleEnabled(req, moduleKey) {
    if (!req.auth) {
        return false;
    }

    if (req.auth.role === 'super-admin') {
        return true;
    }

    if (!moduleKey) {
        return true;
    }

    const modules = req.auth.modules || {};
    return normalizeModuleValue(modules[moduleKey]);
}

function requireModuleEnabled(moduleKey, customMessage) {
    return (req, _res, next) => {
        if (!req.auth) {
            return next(createHttpError(401, 'Usuário não autenticado.'));
        }

        if (isModuleEnabled(req, moduleKey)) {
            return next();
        }

        const msg = customMessage || 'Este módulo não está ativo no contrato atual da igreja. Faça upgrade ou solicite ativação no painel administrativo.';
        return next(createHttpError(403, msg));
    };
}

function requireAnyModuleEnabled(moduleKeys = [], customMessage) {
    const keys = Array.isArray(moduleKeys) ? moduleKeys : [moduleKeys];

    return (req, _res, next) => {
        if (!req.auth) {
            return next(createHttpError(401, 'Usuário não autenticado.'));
        }

        if (!keys.length || keys.some((key) => isModuleEnabled(req, key))) {
            return next();
        }

        const msg = customMessage || 'Nenhum módulo contratado para esta funcionalidade está ativo no momento.';
        return next(createHttpError(403, msg));
    };
}

module.exports = {
    requireAnyModuleEnabled,
    requireModuleEnabled
};