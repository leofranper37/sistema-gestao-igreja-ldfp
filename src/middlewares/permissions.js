const { createHttpError } = require('../utils/httpError');
const { hasPermission } = require('../config/roles');

/**
 * Middleware para verificar permissão de feature
 * @param {string|string[]} features - Feature(s) requeridas
 */
function requireFeature(features) {
    const featureList = Array.isArray(features) ? features : [features];

    return (req, res, next) => {
        if (!req.auth) {
            return next(createHttpError(401, 'Usuário não autenticado.'));
        }

        // Verifica se o usuário tem permissão para qualquer uma das features
        const hasAnyPermission = featureList.some(feature => 
            hasPermission(req.auth.role, feature)
        );

        if (!hasAnyPermission) {
            return next(createHttpError(
                403,
                `Acesso negado. Seu perfil (${req.auth.role}) não tem permissão para esta ação.`
            ));
        }

        next();
    };
}

/**
 * Middleware para verificar permissão de múltiplas features (todas requeridas)
 * @param {string[]} features - Features requeridas
 */
function requireAllFeatures(features) {
    const featureList = Array.isArray(features) ? features : [features];

    return (req, res, next) => {
        if (!req.auth) {
            return next(createHttpError(401, 'Usuário não autenticado.'));
        }

        // Verifica se o usuário tem permissão para TODAS as features
        const hasAllPermissions = featureList.every(feature => 
            hasPermission(req.auth.role, feature)
        );

        if (!hasAllPermissions) {
            return next(createHttpError(
                403,
                `Acesso negado. Seu perfil não tem permissão para todas as ações requeridas.`
            ));
        }

        next();
    };
}

module.exports = {
    requireFeature,
    requireAllFeatures
};
