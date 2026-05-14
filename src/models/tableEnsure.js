const { pool } = require('../config/db');

const ensurePromises = new Map();

async function ensureTable(tableName, createStatements, indexStatements = []) {
    if (ensurePromises.has(tableName)) {
        return ensurePromises.get(tableName);
    }

    const promise = (async () => {
        let created = false;
        let lastError = null;

        for (const statement of createStatements) {
            try {
                await pool.query(statement);
                created = true;
                break;
            } catch (error) {
                lastError = error;
            }
        }

        if (!created) {
            throw lastError || new Error(`Falha ao criar tabela ${tableName}.`);
        }

        for (const statement of indexStatements) {
            try {
                await pool.query(statement);
            } catch (_error) {
                // Índice opcional, segue execução.
            }
        }
    })();

    ensurePromises.set(tableName, promise);

    try {
        await promise;
    } catch (error) {
        ensurePromises.delete(tableName);
        throw error;
    }
}

module.exports = {
    ensureTable
};
