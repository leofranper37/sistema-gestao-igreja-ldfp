const cors = require('cors');
const express = require('express');
const fs = require('fs');
const helmet = require('helmet');
const path = require('path');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const config = require('./config');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/errorHandler');
const csrfGuard = require('./middlewares/csrfGuard');
const churchGuard = require('./middlewares/churchGuard');
const { createHttpError } = require('./utils/httpError');
const { requireAuth, authorize } = require('./middlewares/auth');
const accountRoutes = require('./routes/accountRoutes');
const agendaRoutes = require('./routes/agendaRoutes');
const appMembroRoutes = require('./routes/appMembroRoutes');
const bancoRoutes = require('./routes/bancoRoutes');
const cargoRoutes = require('./routes/cargoRoutes');
const contasPagarRoutes = require('./routes/contasPagarRoutes');
const financeRoutes = require('./routes/financeRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const missionariosRoutes = require('./routes/missionariosRoutes');
const outrasIgrejasRoutes = require('./routes/outrasIgrejasRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const systemRoutes = require('./routes/systemRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const pushRoutes = require('./routes/pushRoutes');
const relatorioMembroRoutes = require('./routes/relatorioMembroRoutes');
const batismosRoutes  = require('./routes/batismosRoutes');
const escalasRoutes   = require('./routes/escalasRoutes');
const gruposRoutes    = require('./routes/gruposRoutes');
const ebdRoutes       = require('./routes/ebdRoutes');
const criancasRoutes   = require('./routes/criancasRoutes');
const dashboardRoutes  = require('./routes/dashboardRoutes');
const auditRoutes      = require('./routes/auditRoutes');
const estudoRoutes     = require('./routes/estudoRoutes');
const webhookRoutes    = require('./routes/webhookRoutes');
const pixRoutes        = require('./routes/pixRoutes');
const visitantesFollowupRoutes = require('./routes/visitantesFollowupRoutes');

const app = express();

// Permite que o Express identifique o IP real do usuário através de múltiplos proxies (Cloudflare + cPanel Nginx) evitando falsos Erros 429
app.set('trust proxy', true);

// Aggregator em memória para auditoria de endpoints
const endpointStats = new Map();

// Limite em milissegundos para considerar uma requisição lenta e disparar alerta
const SLOW_RESPONSE_THRESHOLD_MS = 2000;

const maintenanceModeEnabled = process.env.MAINTENANCE_MODE === 'true' || false;
const setupRouteEnabled = process.env.ENABLE_SETUP_ROUTE === 'true'
    || (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SETUP_ROUTE !== 'false');
const shouldUseDistPublic = String(process.env.USE_DIST_PUBLIC || '').trim().toLowerCase() === 'true';
const distPublicPath = path.join(__dirname, '..', '..', 'dist', 'public');
const publicPath = path.join(__dirname, '..', 'public');
const staticAssetsPath = shouldUseDistPublic && fs.existsSync(distPublicPath)
    ? distPublicPath
    : publicPath;

const allowedOrigins = config.cors.allowedOrigins;

const loginRateLimitWindowMs = Number.parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000;
const loginRateLimitMax = Number.parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '', 10) || 10;

const apiRateLimitWindowMs = Number.parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '', 10) || 15 * 60 * 1000;
const apiRateLimitMax = Number.parseInt(process.env.API_RATE_LIMIT_MAX || '', 10) || 600; // Incrementado

const apiRateLimiter = rateLimit({
    windowMs: apiRateLimitWindowMs,
    limit: apiRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1];
                const decoded = jwt.decode(token); // Leitura ultra-rápida sem validar hash aqui
                if (decoded && decoded.sub) {
                    return `user_${decoded.sub}`; // Limita POR USUÁRIO em vez de IP
                }
            } catch (e) {}
        }
        return req.ip; // Fallback para IP caso visitante
    },
    handler: (req, res, next, options) => {
        res.status(options.statusCode).setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
        res.status(options.statusCode).json(options.message);
    },
    message: {
        error: 'Muitas requisições. Aguarde alguns minutos e tente novamente.'
    }
});

const loginRateLimiter = rateLimit({
    windowMs: loginRateLimitWindowMs,
    limit: loginRateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
        error: 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.'
    }
});

app.use(cors(allowedOrigins.length ? {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(createHttpError(403, 'Origem não permitida por CORS.'));
    }
} : undefined));

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

app.use(express.json({
    limit: '1mb',
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(csrfGuard);
app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.setHeader('Surrogate-Control', 'no-store');
    }

    next();
});

app.get(['/index.htm', '/INDEX.HTM'], (req, res) => {
    res.redirect(301, '/index.html');
});

app.get(['/super_admin', '/super-admin', '/superadmin'], (req, res) => {
    res.sendFile(path.join(staticAssetsPath, 'admin-master.html'));
});

app.get(['/super_admin_login', '/super-admin-login'], (req, res) => {
    res.sendFile(path.join(staticAssetsPath, 'super_admin_login.html'));
});

app.use((req, res, next) => {
    if (!maintenanceModeEnabled) {
        return next();
    }

    if (req.path === '/maintenance.html') {
        return next();
    }

    if (req.path.startsWith('/api/')) {
        return res.status(503).json({
            erro: 'Sistema em manutenção. Voltaremos em breve.',
            contato: 'contato@ldfp.com.br'
        });
    }

    return res.status(503).sendFile(path.join(__dirname, '..', 'public', 'maintenance.html'));
});

app.use(express.static(staticAssetsPath));

app.use('/login', loginRateLimiter);
app.use('/esqueci-senha', loginRateLimiter);
app.use('/redefinir-senha', loginRateLimiter);
app.use('/api/', apiRateLimiter);

app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
        const durationMs = Date.now() - startedAt;

        // Alerta automático de lentidão
        if (durationMs > SLOW_RESPONSE_THRESHOLD_MS) {
            logger.warn('ALERTA_LENTIDAO', {
                method: req.method,
                path: req.originalUrl,
                durationMs,
                limiteMs: SLOW_RESPONSE_THRESHOLD_MS,
                ip: req.ip
            });
        }

        logger.info('http_request', {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs,
            userId: req.auth?.id || null,
            igrejaId: req.auth?.igrejaId || null,
            ip: req.ip
        });

        // Rastreamento em memória para auditoria de endpoints (apenas rotas da API)
        if (req.originalUrl.startsWith('/api/')) {
            // Remove querystring e normaliza IDs numéricos (ex: /api/membros/123 -> /api/membros/:id)
            const routePath = req.originalUrl.split('?')[0].replace(/\/\d+/g, '/:id');
            const key = `${req.method} ${routePath}`;
            
            // Proteção contra estouro de memória (evita DDoS em rotas 404 com URLs aleatórias)
            if (endpointStats.size > 2000 && !endpointStats.has(key)) endpointStats.clear();

            const stat = endpointStats.get(key) || { 
                method: req.method, path: routePath, hits: 0, slowHits: 0,
                totalDuration: 0, minDuration: durationMs, maxDuration: durationMs 
            };

            stat.hits += 1;
            if (durationMs > SLOW_RESPONSE_THRESHOLD_MS) stat.slowHits += 1;
            stat.totalDuration += durationMs;
            if (durationMs < stat.minDuration) stat.minDuration = durationMs;
            if (durationMs > stat.maxDuration) stat.maxDuration = durationMs;

            endpointStats.set(key, stat);
        }
    });

    next();
});

app.use(churchGuard);

app.use(financeRoutes);
app.use(bancoRoutes);
app.use(appMembroRoutes);
app.use(contasPagarRoutes);
app.use(engagementRoutes);
app.use(cargoRoutes);
app.use(accountRoutes);
app.use(agendaRoutes);
app.use(missionariosRoutes);
app.use(outrasIgrejasRoutes);
app.use(realtimeRoutes);
app.use(systemRoutes);
app.use(superAdminRoutes);
app.use(paymentRoutes);
app.use(pushRoutes);
app.use(relatorioMembroRoutes);
app.use(batismosRoutes);
app.use(escalasRoutes);
app.use(gruposRoutes);
app.use(ebdRoutes);
app.use(criancasRoutes);
app.use(dashboardRoutes);
app.use(auditRoutes);
app.use('/api/estudo', estudoRoutes);
app.use('/webhook', webhookRoutes);
app.use('/api/pix', pixRoutes);
app.use(visitantesFollowupRoutes);

/* ------------------------------------------------------------------ */
/*  ROTA DE BOOTSTRAP — cria o primeiro super-admin se não existir     */
/*  Desativada por padrão em produção (ENABLE_SETUP_ROUTE=true)        */
/* ------------------------------------------------------------------ */
if (setupRouteEnabled) {
    app.post('/api/setup/super-admin', express.json(), async (req, res) => {
        try {
            const bcrypt = require('bcryptjs');
            const { pool } = require('./config/db');

            // Verificar se já existe algum super-admin
            const [existing] = await pool.query(
                "SELECT id FROM usuarios WHERE role = 'super-admin' LIMIT 1"
            );
            if (existing && existing.length > 0) {
                return res.status(403).json({ error: 'Setup já realizado. Rota desativada.' });
            }

            const { nome, email, senha, setup_key } = req.body || {};
            const expectedKey = process.env.SETUP_KEY;

            if (!expectedKey) {
                return res.status(503).json({ error: 'SETUP_KEY não configurada no ambiente.' });
            }

            if (!setup_key || setup_key !== expectedKey) {
                return res.status(401).json({ error: 'setup_key inválida.' });
            }

            if (!nome || !email || !senha || senha.length < 8) {
                return res.status(400).json({ error: 'Campos obrigatórios: nome, email, senha (min 8 chars), setup_key.' });
            }

            // Garantir que a "LDFP Master" existe
            let igrejaId;
            const [igRows] = await pool.query("SELECT id FROM igrejas WHERE nome = 'LDFP Master' LIMIT 1");
            if (igRows && igRows.length > 0) {
                igrejaId = igRows[0].id;
            } else {
                const [igRes] = await pool.query(
                    "INSERT INTO igrejas (nome, plano, status_assinatura, max_cadastros, max_congregacoes) VALUES ('LDFP Master', 'siao', 'ativa', 999999, 999)"
                );
                igrejaId = igRes.insertId;
            }

            const hash = await bcrypt.hash(senha, 12);
            const [result] = await pool.query(
                'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
                ['LDFP Master', igrejaId, nome, email.toLowerCase().trim(), hash, 'super-admin']
            );

            return res.status(201).json({
                message: 'Super-admin criado com sucesso! Esta rota está agora desativada.',
                id: result.insertId,
                email: email.toLowerCase().trim()
            });
        } catch (err) {
            return res.status(500).json({ error: 'Erro interno: ' + err.message });
        }
    });
}

/* ------------------------------------------------------------------ */
/*  ROTA DE PRIMEIRO ACESSO — cria super-admin se nenhum existir       */
/*  Auto-desativa assim que o primeiro super-admin for criado          */
/* ------------------------------------------------------------------ */
app.post('/api/firstrun/super-admin', express.json(), async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const { pool } = require('./config/db');

        const [existing] = await pool.query(
            "SELECT id FROM usuarios WHERE role = 'super-admin' LIMIT 1"
        );
        if (existing && existing.length > 0) {
            return res.status(403).json({ error: 'Já existe um super-admin. Rota desativada.' });
        }

        const { nome, email, senha } = req.body || {};
        if (!nome || !email || !senha || senha.length < 8) {
            return res.status(400).json({ error: 'Nome, e-mail e senha (mín. 8 chars) são obrigatórios.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).json({ error: 'E-mail inválido.' });
        }

        const [dupEmail] = await pool.query(
            'SELECT id FROM usuarios WHERE email = ? LIMIT 1', [email.toLowerCase().trim()]
        );
        if (dupEmail && dupEmail.length > 0) {
            // Promove usuário existente para super-admin
            const hash = await bcrypt.hash(senha, 12);
            await pool.query(
                "UPDATE usuarios SET role = 'super-admin', password_hash = ? WHERE email = ?",
                [hash, email.toLowerCase().trim()]
            );
            return res.status(200).json({ message: 'Usuário promovido a super-admin com sucesso!', email: email.toLowerCase().trim() });
        }

        let igrejaId;
        const [igRows] = await pool.query("SELECT id FROM igrejas WHERE nome = 'LDFP Master' LIMIT 1");
        if (igRows && igRows.length > 0) {
            igrejaId = igRows[0].id;
        } else {
            const [igRes] = await pool.query(
                "INSERT INTO igrejas (nome, plano, status_assinatura, max_cadastros, max_congregacoes) VALUES ('LDFP Master', 'siao', 'ativa', 999999, 999)"
            );
            igrejaId = igRes.insertId;
        }

        const hash = await bcrypt.hash(senha, 12);
        const [result] = await pool.query(
            'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
            ['LDFP Master', igrejaId, nome.trim(), email.toLowerCase().trim(), hash, 'super-admin']
        );

        return res.status(201).json({
            message: 'Super-admin criado! Acesse login.html com seu e-mail e senha.',
            id: result.insertId,
            email: email.toLowerCase().trim()
        });
    } catch (err) {
        return res.status(500).json({ error: 'Erro interno: ' + err.message });
    }
});

/* ------------------------------------------------------------------ */
/*  AUDITORIA DE ENDPOINTS — Retorna os endpoints mais acessados       */
/* ------------------------------------------------------------------ */
app.get('/api/saas/metricas/endpoints', requireAuth, authorize(['super-admin', 'super_admin', 'superadmin', 'master', 'owner', 'root']), (req, res) => {
    const stats = Array.from(endpointStats.values())
        .map(s => ({
            method: s.method,
            path: s.path,
            hits: s.hits,
            slowHits: s.slowHits,
            avgDurationMs: Math.round(s.totalDuration / s.hits),
            minDurationMs: s.minDuration,
            maxDurationMs: s.maxDuration
        }))
        .sort((a, b) => b.hits - a.hits); // Ordena de forma decrescente pelos mais acessados

    res.json({
        uptimeServidorHrs: (process.uptime() / 3600).toFixed(2),
        totalEndpointsMonitorados: stats.length,
        stats
    });
});

app.use((req, res, next) => {
    next(createHttpError(404, 'Rota não encontrada.'));
});

app.use(errorHandler);

module.exports = app;