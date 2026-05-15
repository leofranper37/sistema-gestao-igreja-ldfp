const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const possiveis = [
  path.resolve(__dirname, '../ldfp_db.sqlite'),
  path.resolve(__dirname, '../.mysql-data/ldfp.db')
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
  console.error('Banco nao encontrado.');
  process.exit(1);
}

const db = new sqlite3.Database(dbPath);
const igrejaNome = 'Igreja Exemplo LDFP';

db.serialize(() => {
  console.log('Inserindo igreja de demonstracao...');

  db.run(
    `CREATE TABLE IF NOT EXISTS igrejas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      plano TEXT DEFAULT 'eden',
      status_assinatura TEXT DEFAULT 'ativa',
      trial_starts_at TEXT,
      trial_ends_at TEXT,
      max_cadastros INTEGER DEFAULT 50,
      max_congregacoes INTEGER DEFAULT 1,
      config_personalizada_json TEXT,
      modulo_app_membro INTEGER DEFAULT 0,
      modulo_app_midia INTEGER DEFAULT 0,
      modulo_ebd INTEGER DEFAULT 1,
      modulo_agenda_eventos INTEGER DEFAULT 1,
      modulo_escala_culto INTEGER DEFAULT 0,
      modulo_pedidos_oracao INTEGER DEFAULT 1,
      modulo_mural_oracao INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    [],
    (err) => {
      if (err) {
        console.error('Erro ao garantir tabela igrejas:', err.message);
        db.close();
        return;
      }

      db.get(
        `SELECT id FROM igrejas WHERE LOWER(nome) = LOWER(?) LIMIT 1`,
        [igrejaNome],
        (findErr, row) => {
          if (findErr) {
            console.error('Erro ao buscar igreja demo existente:', findErr.message);
            db.close();
            return;
          }

          if (row?.id) {
            console.log('Igreja demo ja existe com id:', row.id);
            db.close();
            return;
          }

          db.run(
            `INSERT INTO igrejas (nome, plano, status_assinatura, max_cadastros, max_congregacoes)
             VALUES (?, ?, ?, ?, ?)`,
            [igrejaNome, 'eden', 'ativa', 50, 1],
            function (insertErr) {
              if (insertErr) {
                console.error('Erro ao inserir igreja demo:', insertErr.message);
              } else {
                console.log('Igreja demo criada com id:', this.lastID);
              }
              db.close();
            }
          );
        }
      );
    }
  );
});
