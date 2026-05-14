require('dotenv').config();

const mysql = require('mysql2/promise');

const parseInteger = (value, fallback) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
};

const config = {
    host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQL_PASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'ldfp_db',
    port: parseInteger(process.env.DB_PORT || process.env.MYSQL_PORT, 3306)
};

async function checkDatabase() {
    let connection;

    try {
        connection = await mysql.createConnection(config);
        await connection.query('SELECT 1');

        console.log('DB_CHECK_OK');
        console.log(`Host: ${config.host}`);
        console.log(`Porta: ${config.port}`);
        console.log(`Banco: ${config.database}`);
        console.log(`Usuário: ${config.user}`);

        process.exit(0);
    } catch (error) {
        console.error('DB_CHECK_FAIL');
        console.error(`Host: ${config.host}`);
        console.error(`Porta: ${config.port}`);
        console.error(`Banco: ${config.database}`);
        console.error(`Usuário: ${config.user}`);
        console.error(`Erro: ${error.code || error.message}`);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

checkDatabase();