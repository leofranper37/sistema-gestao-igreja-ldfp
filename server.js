const { initializeDatabase } = require('./src/config/db');
const app = require('./src/app');

const PORT = process.env.PORT || 3001;

initializeDatabase()
    .then(() => {
        app.listen(PORT, () => {
            console.log(JSON.stringify({
                app: 'LDFP',
                environment: process.env.NODE_ENV || 'production',
                port: PORT,
                timestamp: new Date().toISOString()
            }));
        });
    })
    .catch(err => {
        console.error('Falha ao inicializar banco de dados:', err.message);
        process.exit(1);
    });
