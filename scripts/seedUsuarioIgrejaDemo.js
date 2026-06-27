const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

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

// Se quiser forcar manualmente, troque para um numero. Ex: 1
const igrejaIdOverride = null;
const igrejaNome = 'Igreja Exemplo LDFP';

const email = 'pastor@igreja-demo.com';
const senha = '123456';
const nome = 'Pastor Demo';
const role = 'admin';

const passwordHash = bcrypt.hashSync(senha, 12);

function resolveIgrejaId(callback) {
  if (Number.isInteger(igrejaIdOverride) && igrejaIdOverride > 0) {
    callback(null, igrejaIdOverride);
    return;
  }

  db.get(
    `SELECT id FROM igrejas WHERE LOWER(nome) = LOWER(?) ORDER BY id DESC LIMIT 1`,
    [igrejaNome],
    (err, row) => {
      if (err) {
        callback(err);
        return;
      }

      if (!row?.id) {
        callback(new Error('Igreja demo nao encontrada. Rode primeiro: node scripts/seedIgrejaDemo.js'));
        return;
      }

      callback(null, row.id);
    }
  );
}

db.serialize(() => {
  console.log('Criando usuario de igreja demo...');

  resolveIgrejaId((idErr, igrejaId) => {
    if (idErr) {
      console.error('Erro ao resolver igreja:', idErr.message);
      db.close();
      return;
    }

    db.run(
      `DELETE FROM usuarios WHERE email = ?`,
      [email],
      (deleteErr) => {
        if (deleteErr) {
          console.error('Erro ao limpar usuario antigo:', deleteErr.message);
          db.close();
          return;
        }

        db.run(
          `INSERT INTO usuarios (igreja_id, igreja, role, nome, email, password_hash)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [igrejaId, igrejaNome, role, nome, email, passwordHash],
          function (insertErr) {
            if (insertErr) {
              console.error('Erro ao criar usuario igreja:', insertErr.message);
            } else {
              console.log('Usuario de igreja criado com id:', this.lastID);
              console.log('Igreja vinculada:', igrejaNome, '(id:', igrejaId + ')');
              console.log('');
              console.log('Use estas credenciais para login (PAINEL CLIENTE):');
              console.log('  E-mail:', email);
              console.log('  Senha :', senha);
            }
            db.close();
          }
        );
      }
    );
  });
});
