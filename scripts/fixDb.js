const path = require('path');
const fs = require('fs');

const possiveis = [
    process.env.SQLITE_DB_PATH,
    path.resolve(__dirname, '../.mysql-data/ldfp.db'),
    path.resolve(__dirname, '../ldfp_db.sqlite'),
    path.resolve(__dirname, '../ldfp.db'),
    path.resolve(__dirname, '../database.db'),
    path.resolve(__dirname, '../src/database.db'),
    path.resolve(__dirname, '../data/ldfp.db')
].filter(Boolean);

let dbPath = null;
possiveis.forEach((p) => {
    if (fs.existsSync(p)) {
        dbPath = p;
        console.log('Banco encontrado: ' + p);
    }
});

if (!dbPath) {
    console.log('Banco NAO encontrado. Locais procurados:');
    possiveis.forEach((p) => console.log('  ' + p));
    process.exit(1);
}

let db;
let driver = 'better-sqlite3';
try {
    const Database = require('better-sqlite3');
    db = new Database(dbPath);
    console.log('Conectado com better-sqlite3');
} catch (e) {
    try {
        const sqlite3 = require('sqlite3').verbose();
        db = new sqlite3.Database(dbPath);
        driver = 'sqlite3';
        console.log('Conectado com sqlite3 (fallback)');
    } catch (fallbackError) {
        console.log('Erro ao conectar: ' + e.message);
        console.log('Fallback sqlite3 tambem falhou: ' + fallbackError.message);
        process.exit(1);
    }
}

const colunas = [
    'ALTER TABLE igrejas ADD COLUMN config_personalizada_json TEXT',
    'ALTER TABLE igrejas ADD COLUMN modulo_app_membro INTEGER DEFAULT 0',
    'ALTER TABLE igrejas ADD COLUMN modulo_app_midia INTEGER DEFAULT 0',
    'ALTER TABLE igrejas ADD COLUMN modulo_ebd INTEGER DEFAULT 1',
    'ALTER TABLE igrejas ADD COLUMN modulo_agenda_eventos INTEGER DEFAULT 1',
    'ALTER TABLE igrejas ADD COLUMN modulo_escala_culto INTEGER DEFAULT 0',
    'ALTER TABLE igrejas ADD COLUMN modulo_pedidos_oracao INTEGER DEFAULT 1',
    'ALTER TABLE igrejas ADD COLUMN modulo_mural_oracao INTEGER DEFAULT 1'
];

function processarResultado(sql, err) {
    const col = sql.split('ADD COLUMN')[1].trim().split(' ')[0];
    if (!err) {
        console.log('OK adicionado: ' + col);
        return;
    }

    if (String(err.message || '').includes('duplicate column')) {
        console.log('Ja existe: ' + col);
    } else {
        console.log('ERRO em ' + col + ': ' + err.message);
    }
}

if (driver === 'better-sqlite3') {
    colunas.forEach((sql) => {
        try {
            db.prepare(sql).run();
            processarResultado(sql, null);
        } catch (err) {
            processarResultado(sql, err);
        }
    });

    db.close();
    console.log('Pronto! Banco corrigido.');
} else {
    const executarProxima = (index) => {
        if (index >= colunas.length) {
            db.close((closeErr) => {
                if (closeErr) {
                    console.log('Aviso ao fechar banco: ' + closeErr.message);
                }
                console.log('Pronto! Banco corrigido.');
            });
            return;
        }

        const sql = colunas[index];
        db.run(sql, (err) => {
            processarResultado(sql, err);
            executarProxima(index + 1);
        });
    };

    executarProxima(0);
}
