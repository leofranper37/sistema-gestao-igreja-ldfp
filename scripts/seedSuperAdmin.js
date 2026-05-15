const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const possiveis = [
    path.resolve(__dirname, '../ldfp_db.sqlite'),
    path.resolve(__dirname, '../.mysql-data/ldfp.db'),
    path.resolve(__dirname, '../database.db'),
    path.resolve(__dirname, '../src/database.db')
];

let dbPath = null;
for (const p of possiveis) {
    if (fs.existsSync(p)) {
        dbPath = p;
        console.log('Banco encontrado em:', p);
        break;
    }
}

if (!dbPath) {
    console.error('Banco SQLite nao encontrado.');
    console.log('Procurados:');
    possiveis.forEach((p) => console.log(' - ' + p));
    process.exit(1);
}

let db;
try {
    const sqlite3 = require('sqlite3').verbose();
    db = new sqlite3.Database(dbPath);
    console.log('Conectado ao SQLite.');
} catch (err) {
    console.error('Erro ao conectar SQLite:', err.message);
    process.exit(1);
}

const email = 'admin@ldfp.com.br';
const senha = '123456';
const nome = 'Super Admin LDFP';
const role = 'super-admin';

const passwordHash = bcrypt.hashSync(senha, 10);

db.serialize(() => {
    let igrejaId = 1;

    console.log('Garantindo tabela igrejas...');
    db.run(
        `CREATE TABLE IF NOT EXISTS igrejas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )`,
        [],
        (errIgrejas) => {
            if (errIgrejas) {
                console.error('Erro ao criar tabela igrejas:', errIgrejas.message);
                db.close();
                process.exit(1);
            }

            db.get(
                `SELECT id FROM igrejas WHERE nome = ? LIMIT 1`,
                ['LDFP Master'],
                (errGetIgreja, rowIgreja) => {
                    if (errGetIgreja) {
                        console.error('Erro ao consultar igreja master:', errGetIgreja.message);
                        db.close();
                        process.exit(1);
                    }

                    const continuarComUsuarios = () => {
                        console.log('Garantindo tabela usuarios...');
                        db.run(
                            `CREATE TABLE IF NOT EXISTS usuarios (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                igreja_id INTEGER,
                                igreja TEXT,
                                role TEXT NOT NULL,
                                nome TEXT NOT NULL,
                                email TEXT NOT NULL UNIQUE,
                                password_hash TEXT NOT NULL,
                                created_at TEXT DEFAULT CURRENT_TIMESTAMP
                            )`,
                            [],
                            (errUsuarios) => {
                                if (errUsuarios) {
                                    console.error('Erro ao criar tabela usuarios:', errUsuarios.message);
                                    db.close();
                                    process.exit(1);
                                }

                                console.log('Removendo usuario antigo com mesmo e-mail (se existir)...');
                                db.run(
                                    `DELETE FROM usuarios WHERE email = ?`,
                                    [email],
                                    (errDelete) => {
                                        if (errDelete) {
                                            console.error('Erro ao remover usuario antigo:', errDelete.message);
                                            db.close();
                                            process.exit(1);
                                        }

                                        console.log('Inserindo novo super admin...');
                                        db.run(
                                            `INSERT INTO usuarios (igreja_id, igreja, role, nome, email, password_hash)
                                             VALUES (?, 'LDFP Master', ?, ?, ?, ?)`,
                                            [igrejaId, role, nome, email, passwordHash],
                                            function onInsert(errInsert) {
                                                if (errInsert) {
                                                    console.error('Erro ao inserir super admin:', errInsert.message);
                                                } else {
                                                    console.log('Super admin criado com sucesso.');
                                                    console.log('');
                                                    console.log('Use estas credenciais para login:');
                                                    console.log('  E-mail:', email);
                                                    console.log('  Senha :', senha);
                                                    console.log('');
                                                }
                                                db.close();
                                            }
                                        );
                                    }
                                );
                            }
                        );
                    };

                    if (rowIgreja && rowIgreja.id) {
                        igrejaId = rowIgreja.id;
                        continuarComUsuarios();
                        return;
                    }

                    db.run(
                        `INSERT INTO igrejas (nome) VALUES (?)`,
                        ['LDFP Master'],
                        function onInsertIgreja(errInsertIgreja) {
                            if (errInsertIgreja) {
                                console.error('Erro ao criar igreja master:', errInsertIgreja.message);
                                db.close();
                                process.exit(1);
                            }

                            igrejaId = this.lastID || 1;
                            continuarComUsuarios();
                        }
                    );
                }
            );
        }
    );
});
