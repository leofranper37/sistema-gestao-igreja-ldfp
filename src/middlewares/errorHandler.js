const logger = require('../config/logger');

function errorHandler(error, req, res, next) {
    if (res.headersSent) {
        return next(error);
    }

    const status = error.status || 500;
    const response = {
        error: error.message || 'Erro interno do servidor.'
    };

    if (process.env.NODE_ENV !== 'production' && error.details) {
        response.details = error.details;
    }

    if (status >= 500) {
        logger.error('internal_error', {
            message: error.message,
            status,
            stack: error.stack,
            path: req.originalUrl,
            method: req.method,
            userId: req.auth?.id || null,
            igrejaId: req.auth?.igrejaId || null
        });
    }

    res.status(status).json(response);
}

module.exports = errorHandler;