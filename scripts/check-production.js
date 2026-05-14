require('dotenv').config();

const DEFAULT_OR_WEAK_SECRETS = new Set([
    '',
    'ldfp-dev-secret',
    'troque-esta-chave-em-producao',
    'troque-esta-chave-de-bootstrap',
    'secret',
    'changeme'
]);

const isTruthy = (value) => String(value || '').trim().toLowerCase() === 'true';

const parseOrigins = (raw) => String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const getHostname = (value) => {
    try {
        return new URL(value).hostname.toLowerCase();
    } catch (_) {
        return '';
    }
};

const hasLocalHost = (value) => {
    const host = getHostname(value);
    return ['localhost', '127.0.0.1', '::1'].includes(host);
};

function printResult(type, message) {
    const icon = type === 'ok' ? 'OK' : type === 'warn' ? 'WARN' : 'FAIL';
    console.log(`[${icon}] ${message}`);
}

function main() {
    const errors = [];
    const warnings = [];
    const infos = [];

    const nodeEnv = String(process.env.NODE_ENV || '').trim() || 'development';
    const appBaseUrl = String(process.env.APP_BASE_URL || '').trim();
    const corsOriginRaw = String(process.env.CORS_ORIGIN || process.env.CORS_ORIGINS || '').trim();
    const corsOrigins = parseOrigins(corsOriginRaw);
    const jwtSecret = String(process.env.JWT_SECRET || '').trim();
    const setupRouteEnabled = isTruthy(process.env.ENABLE_SETUP_ROUTE);
    const setupKey = String(process.env.SETUP_KEY || '').trim();
    const databaseUrl = String(process.env.DATABASE_URL || process.env.DB_URL || '').trim();
    const dbHost = String(process.env.DB_HOST || process.env.MYSQL_HOST || '').trim();
    const saltRounds = Number.parseInt(String(process.env.PASSWORD_SALT_ROUNDS || '10'), 10);
    const whatsappProvider = String(process.env.WHATSAPP_PROVIDER || '').trim();
    const paymentBaseUrl = String(process.env.PAYMENT_BASE_URL || '').trim();

    infos.push(`NODE_ENV=${nodeEnv}`);

    if (nodeEnv !== 'production') {
        warnings.push('NODE_ENV nao esta como production.');
    }

    if (!appBaseUrl) {
        errors.push('APP_BASE_URL nao definida.');
    } else {
        if (!/^https:\/\//i.test(appBaseUrl)) {
            errors.push('APP_BASE_URL deve usar https em producao.');
        }
        if (hasLocalHost(appBaseUrl)) {
            errors.push('APP_BASE_URL nao pode apontar para localhost em producao.');
        }
    }

    if (!corsOrigins.length) {
        errors.push('CORS_ORIGIN/CORS_ORIGINS vazio. Defina ao menos o dominio de producao.');
    } else {
        if (corsOrigins.includes('*')) {
            errors.push('CORS_ORIGIN nao deve usar * em producao.');
        }
        const hasLocal = corsOrigins.some((origin) => hasLocalHost(origin));
        if (hasLocal) {
            warnings.push('CORS_ORIGIN contem origem local (localhost/127.0.0.1).');
        }
        if (appBaseUrl && !corsOrigins.includes(appBaseUrl)) {
            warnings.push('APP_BASE_URL nao esta listado em CORS_ORIGIN.');
        }
    }

    if (!jwtSecret || DEFAULT_OR_WEAK_SECRETS.has(jwtSecret.toLowerCase()) || jwtSecret.length < 24) {
        errors.push('JWT_SECRET ausente/fraco. Use valor forte com 24+ caracteres.');
    }

    if (Number.isNaN(saltRounds) || saltRounds < 10) {
        errors.push('PASSWORD_SALT_ROUNDS deve ser >= 10.');
    }

    if (setupRouteEnabled) {
        warnings.push('ENABLE_SETUP_ROUTE=true (recomendado false em producao).');
        if (!setupKey || DEFAULT_OR_WEAK_SECRETS.has(setupKey.toLowerCase()) || setupKey.length < 16) {
            errors.push('SETUP_KEY ausente/fraca enquanto ENABLE_SETUP_ROUTE=true.');
        }
    }

    if (!databaseUrl && !dbHost) {
        errors.push('Configure DATABASE_URL (recomendado) ou DB_HOST/credenciais de banco.');
    }

    if (databaseUrl) {
        if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl) && !/^mysql:\/\//i.test(databaseUrl)) {
            errors.push('DATABASE_URL invalida. Esperado mysql:// ou postgresql://');
        }
        if (hasLocalHost(databaseUrl)) {
            errors.push('DATABASE_URL nao pode apontar para localhost em producao.');
        }
    }

    if (dbHost && ['localhost', '127.0.0.1', '::1'].includes(dbHost.toLowerCase())) {
        warnings.push('DB_HOST aponta para localhost. Verifique se isso e intencional em producao.');
    }

    if (!whatsappProvider || whatsappProvider === 'mock') {
        warnings.push('WHATSAPP_PROVIDER esta em mock.');
    }

    if (!paymentBaseUrl || /exemplo\.local/i.test(paymentBaseUrl)) {
        warnings.push('PAYMENT_BASE_URL ainda esta em valor de exemplo.');
    }

    console.log('=== CHECK PRODUCAO ===');
    infos.forEach((item) => printResult('ok', item));
    warnings.forEach((item) => printResult('warn', item));
    errors.forEach((item) => printResult('fail', item));

    console.log('');
    console.log(`Resumo: ${errors.length} erro(s), ${warnings.length} alerta(s).`);

    if (errors.length > 0) {
        process.exit(1);
    }

    process.exit(0);
}

main();