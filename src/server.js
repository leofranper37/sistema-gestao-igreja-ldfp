const app = require('./app');
const config = require('./config');
const logger = require('./config/logger');
const { initializeDatabase } = require('./config/db');

function formatStartupError(error) {
    if (!error) {
        return 'Erro desconhecido.';
    }

    if (error.message) {
        return error.message;
    }

    if (error.code && error.sqlMessage) {
        return `${error.code}: ${error.sqlMessage}`;
    }

    if (error.code) {
        return error.code;
    }

    return String(error);
}

async function startServer() {
    try {
        await initializeDatabase();

        app.listen(config.port, () => {
            logger.info('server_started', {
                app: config.app.name,
                port: config.port,
                environment: process.env.NODE_ENV || 'development'
            });
            console.log(`🚀 Servidor ${config.app.name} rodando na porta ${config.port}`);
        });
    } catch (error) {
        logger.error('startup_failed', {
            errorCode: error?.code || null,
            message: formatStartupError(error),
            stack: error?.stack || null,
            dbHost: config.db.host,
            dbPort: config.db.port,
            dbName: config.db.database
        });
        console.error('❌ Erro ao iniciar o servidor:', formatStartupError(error));
        console.log('⚠️ Verifique as variáveis de ambiente e o banco de dados antes de reiniciar.');
        process.exit(1);
    }
}

startServer();

module.exports = {
    startServer
};