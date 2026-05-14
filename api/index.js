const { initializeDatabase } = require('../src/config/db');

let databaseReadyPromise;
let appInstance;
const DATABASE_BOOT_TIMEOUT_MS = 12000;

function getApp() {
    if (!appInstance) {
        appInstance = require('../src/app');
    }

    return appInstance;
}

function ensureDatabaseReady() {
    if (!databaseReadyPromise) {
        const bootPromise = initializeDatabase();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error('Database initialization timeout'));
            }, DATABASE_BOOT_TIMEOUT_MS);
        });

        databaseReadyPromise = Promise.race([bootPromise, timeoutPromise]).catch(error => {
            databaseReadyPromise = null;
            throw error;
        });
    }

    return databaseReadyPromise;
}

module.exports = async (req, res) => {
    try {
        await ensureDatabaseReady();
    } catch (error) {
        res.statusCode = 503;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: 'Banco de dados indisponível no momento.',
            detail: error.message
        }));
        return;
    }

    try {
        const app = getApp();
        return app(req, res);
    } catch (error) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
            error: 'Falha ao inicializar aplicação.',
            detail: error?.message || 'Erro desconhecido.'
        }));
    }
};