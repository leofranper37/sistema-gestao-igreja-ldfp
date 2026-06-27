/**
 * Script interativo para criar ou promover um usuário super-admin.
 * Execute: node scripts/create-super-admin.js
 */

require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');

const { pool, initializeDatabase } = require('../src/config/db');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));

async function main() {
  console.log('\n========================================');
  console.log('  Criar Super-Admin — LDFP Sistema');
  console.log('========================================\n');

  await initializeDatabase();

  const nome   = (await ask('Nome completo: ')).trim();
  const email  = (await ask('E-mail: ')).trim().toLowerCase();
  const senha  = (await ask('Senha (mín. 8 caracteres): ')).trim();
  const senha2 = (await ask('Confirme a senha: ')).trim();

  if (!nome || !email || !senha) {
    console.error('\n[ERRO] Todos os campos são obrigatórios.\n');
    process.exit(1);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error('\n[ERRO] E-mail inválido.\n');
    process.exit(1);
  }
  if (senha.length < 8) {
    console.error('\n[ERRO] A senha deve ter pelo menos 8 caracteres.\n');
    process.exit(1);
  }
  if (senha !== senha2) {
    console.error('\n[ERRO] As senhas não coincidem.\n');
    process.exit(1);
  }

  rl.close();

  // Verifica se já existe usuário com esse e-mail
  const [existing] = await pool.query('SELECT id, role FROM usuarios WHERE email = ? LIMIT 1', [email]);

  if (existing.length > 0) {
    const user = existing[0];
    if (user.role === 'super-admin') {
      console.log(`\n[INFO] Usuário "${email}" já é super-admin (id=${user.id}). Nenhuma alteração feita.\n`);
      process.exit(0);
    }
    // Promove para super-admin e atualiza senha
    const hash = await bcrypt.hash(senha, 12);
    await pool.query('UPDATE usuarios SET role = ?, password_hash = ? WHERE id = ?', ['super-admin', hash, user.id]);
    console.log(`\n[OK] Usuário existente promovido para super-admin (id=${user.id}).\n`);
    process.exit(0);
  }

  // Cria ou reutiliza a igreja "LDFP Master"
  const [igRows] = await pool.query("SELECT id FROM igrejas WHERE nome = 'LDFP Master' LIMIT 1");
  let igrejaId;
  if (igRows.length > 0) {
    igrejaId = igRows[0].id;
  } else {
    const [igRes] = await pool.query(
      `INSERT INTO igrejas (nome, plano, status_assinatura, max_cadastros, max_congregacoes)
       VALUES ('LDFP Master', 'siao', 'ativa', 999999, 999)`,
      []
    );
    igrejaId = igRes.insertId;
  }

  const hash = await bcrypt.hash(senha, 12);
  const [res] = await pool.query(
    'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
    ['LDFP Master', igrejaId, nome, email, hash, 'super-admin']
  );

  console.log(`\n[OK] Super-admin criado com sucesso!`);
  console.log(`     ID: ${res.insertId}`);
  console.log(`     E-mail: ${email}`);
  console.log(`     Role: super-admin\n`);
  console.log('Agora acesse /super-admin.htm e faça login com esse e-mail e senha.\n');

  process.exit(0);
}

main().catch(err => {
  console.error('\n[ERRO FATAL]', err.message, '\n');
  process.exit(1);
});
