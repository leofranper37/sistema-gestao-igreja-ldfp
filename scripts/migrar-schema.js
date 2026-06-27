require('dotenv').config();

const { initializeDatabase } = require('../src/config/db');

async function run() {
    try {
        await initializeDatabase();
        console.log('MIGRATE_SCHEMA_OK');
        process.exit(0);
    } catch (error) {
        console.error('MIGRATE_SCHEMA_FAIL');
        console.error(error?.message || error);
        process.exit(1);
    }
}

run();