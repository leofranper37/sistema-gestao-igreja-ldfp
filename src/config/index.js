require('dotenv').config({ override: true });

const parseInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const pickFirstValue = (...values) => {
    for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            return String(value).trim();
        }
    }

    return undefined;
};

const parseDatabaseUrl = () => {
    const rawUrl = pickFirstValue(
        process.env.DB_URL,
        process.env.DATABASE_URL,
        process.env.MYSQL_URL,
        process.env.MYSQL_PUBLIC_URL,
        process.env.MYSQLPRIVATE_URL
    );

    if (!rawUrl) {
        return null;
    }

    try {
        const url = new URL(rawUrl);

        return {
            host: url.hostname || undefined,
            user: url.username ? decodeURIComponent(url.username) : undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
            database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, '')) : undefined,
            port: url.port || undefined
        };
    } catch (error) {
        return null;
    }
};

const parseAllowedOrigins = () => {
    const rawOrigins = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '';
    return rawOrigins
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
};

const parseJwtExpiresIn = () => {
    const raw = pickFirstValue(process.env.JWT_EXPIRES_IN);

    if (!raw) {
        return '12h';
    }

    const normalized = String(raw).trim().toLowerCase();

    // Valores nulos/zerados com sufixo (ex.: 0, 0s, 0m, 0h) ou negativos geram token
    // imediatamente expirado no jsonwebtoken, então usamos fallback seguro.
    if (/^[-+]?0+(?:\.[0]+)?(?:ms|s|m|h|d)?$/.test(normalized) || /^-/.test(normalized)) {
        return '12h';
    }

    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) {
        return numeric > 0 ? String(numeric) : '12h';
    }

    return normalized;
};

const databaseUrlConfig = parseDatabaseUrl();
const weakSecrets = new Set([
    '',
    'ldfp-dev-secret',
    'troque-esta-chave-em-producao',
    'secret',
    'changeme'
]);

const config = {
    port: parseInteger(process.env.PORT, 3001),
    db: {
        host: pickFirstValue(process.env.DB_HOST, process.env.MYSQL_HOST, process.env.MYSQLHOST, databaseUrlConfig?.host) || '127.0.0.1',
        user: pickFirstValue(process.env.DB_USER, process.env.MYSQL_USER, process.env.MYSQLUSER, databaseUrlConfig?.user) || 'root',
        password: pickFirstValue(process.env.DB_PASSWORD, process.env.DB_PASS, process.env.MYSQL_PASSWORD, process.env.MYSQLPASSWORD, databaseUrlConfig?.password) || '',
        database: pickFirstValue(process.env.DB_NAME, process.env.MYSQL_DATABASE, process.env.MYSQLDATABASE, databaseUrlConfig?.database) || 'ldfp_db',
        port: parseInteger(pickFirstValue(process.env.DB_PORT, process.env.MYSQL_PORT, process.env.MYSQLPORT, databaseUrlConfig?.port), 3306),
        waitForConnections: true,
        connectionLimit: parseInteger(process.env.DB_CONNECTION_LIMIT, 10),
        queueLimit: 0
    },
    cors: {
        allowedOrigins: parseAllowedOrigins()
    },
    security: {
        passwordSaltRounds: parseInteger(process.env.PASSWORD_SALT_ROUNDS, 10),
        jwtSecret: process.env.JWT_SECRET || 'ldfp-dev-secret',
        jwtExpiresIn: parseJwtExpiresIn()
    },
    app: {
        name: 'LDFP'
    }
};

const validateProductionSecurity = () => {
    if (String(process.env.NODE_ENV || '').trim() !== 'production') {
        return;
    }

    const errors = [];
    const jwtSecret = String(config.security.jwtSecret || '').trim();
    const setupRouteEnabled = String(process.env.ENABLE_SETUP_ROUTE || '').trim().toLowerCase() === 'true';

    if (!jwtSecret || weakSecrets.has(jwtSecret.toLowerCase()) || jwtSecret.length < 24) {
        errors.push('JWT_SECRET ausente ou fraco para produção.');
    }

    if (!Array.isArray(config.cors.allowedOrigins) || config.cors.allowedOrigins.length === 0) {
        errors.push('CORS_ORIGIN/CORS_ORIGINS deve ser definido em produção.');
    }

    if (setupRouteEnabled) {
        errors.push('ENABLE_SETUP_ROUTE=true não é permitido em produção.');
    }

    if (errors.length > 0) {
        throw new Error(`Configuração inválida para produção: ${errors.join(' ')}`);
    }
};

validateProductionSecurity();

module.exports = config;