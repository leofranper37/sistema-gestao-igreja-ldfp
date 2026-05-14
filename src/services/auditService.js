const logger = require('../config/logger');

function audit(action, req, details = {}) {
    const actor = req?.auth
        ? { userId: req.auth.id, email: req.auth.email, role: req.auth.role, igrejaId: req.auth.igrejaId }
        : null;

    logger.info('audit_event', {
        action,
        actor,
        method: req?.method,
        path: req?.originalUrl,
        ip: req?.ip,
        details
    });
}

module.exports = {
    audit
};