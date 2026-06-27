require('dotenv').config();

const { initializeDatabase } = require('../src/config/db');

async function run() {
    try {
        await initializeDatabase();
        console.log('INIT_DB_OK');
        process.exit(0);
    } catch (error) {
        console.error('INIT_DB_FAIL');
        console.error(error?.message || error);
        process.exit(1);
    }
}

run();