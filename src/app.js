const cors = require('cors');
const express = require('express');
const path = require('path');

const config = require('./config');
const logger = require('./config/logger');
const errorHandler = require('./middlewares/errorHandler');
const { createHttpError } = require('./utils/httpError');
const accountRoutes = require('./routes/accountRoutes');
const agendaRoutes = require('./routes/agendaRoutes');
const bancoRoutes = require('./routes/bancoRoutes');
const cargoRoutes = require('./routes/cargoRoutes');
const contasPagarRoutes = require('./routes/contasPagarRoutes');
const financeRoutes = require('./routes/financeRoutes');
const engagementRoutes = require('./routes/engagementRoutes');
const missionariosRoutes = require('./routes/missionariosRoutes');
const outrasIgrejasRoutes = require('./routes/outrasIgrejasRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const fabricaRoutes = require('./routes/fabricaRoutes');
const realtimeRoutes = require('./routes/realtimeRoutes');
const systemRoutes = require('./routes/systemRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();

const maintenanceModeEnabled = process.env.MAINTENANCE_MODE === 'true' || false;
const setupRouteEnabled = process.env.ENABLE_SETUP_ROUTE === 'true'
    || (process.env.NODE_ENV !== 'production' && process.env.ENABLE_SETUP_ROUTE !== 'false');

const allowedOrigins = config.cors.allowedOrigins;

app.use(cors(allowedOrigins.length ? {
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(createHttpError(403, 'Origem não permitida por CORS.'));
    }
} : undefined));

app.use(express.json({ limit: '1mb' }));
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

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, res, next) => {
    const startedAt = Date.now();

    res.on('finish', () => {
        logger.info('http_request', {
            method: req.method,
            path: req.originalUrl,
            statusCode: res.statusCode,
            durationMs: Date.now() - startedAt,
            userId: req.auth?.id || null,
            igrejaId: req.auth?.igrejaId || null,
            ip: req.ip
        });
    });

    next();
});

app.use(financeRoutes);
app.use(bancoRoutes);
app.use(contasPagarRoutes);
app.use(engagementRoutes);
app.use(cargoRoutes);
app.use(accountRoutes);
app.use(agendaRoutes);
app.use(missionariosRoutes);
app.use(outrasIgrejasRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/fabrica', fabricaRoutes);
app.use(realtimeRoutes);
app.use(systemRoutes);
app.use(superAdminRoutes);
app.use(paymentRoutes);

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

app.use((req, res, next) => {
    next(createHttpError(404, 'Rota não encontrada.'));
});

app.use(errorHandler);

module.exports = app;