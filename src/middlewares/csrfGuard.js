const config = require('../config');

// Paths that legitimately receive external POST requests (webhooks from third parties)
const EXTERNAL_WEBHOOK_PREFIXES = [
    '/api/pagamentos/webhook',
    '/webhook',
];

function csrfGuard(req, res, next) {
    const method = req.method.toUpperCase();

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) return next();
    if (!req.originalUrl.startsWith('/api/') && !req.originalUrl.startsWith('/webhook')) return next();

    // External webhooks (Mercado Pago, GitHub deploy) send their own format
    if (EXTERNAL_WEBHOOK_PREFIXES.some(p => req.originalUrl.startsWith(p))) return next();

    // Enforce JSON body — HTML form POSTs from foreign origins use
    // application/x-www-form-urlencoded or multipart/form-data, not JSON.
    // A cross-origin fetch with Content-Type: application/json triggers a
    // CORS preflight, which the server's allowlist already blocks.
    const ct = req.headers['content-type'] || '';
    if (!ct.startsWith('application/json') && !ct.startsWith('multipart/form-data')) {
        return res.status(415).json({ error: 'Content-Type inválido. Use application/json.' });
    }

    // When the Origin header is present and allowedOrigins is configured,
    // double-check it here as defense-in-depth (CORS headers may be bypassed
    // by non-browser clients that still send Origin).
    const origin = req.headers.origin;
    const { allowedOrigins } = config.cors;
    if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
        return res.status(403).json({ error: 'Origem não autorizada.' });
    }

    next();
}

module.exports = csrfGuard;
