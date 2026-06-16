/**
 * Cria ou promove um super-admin passando credenciais como argumentos.
 * Uso: node scripts/setup-super-admin.js "Nome Completo" "email@dominio.com" "SenhaSegura"
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, initializeDatabase } = require('../src/config/db');

async function main() {
    const [,, nome, email, senha] = process.argv;

    if (!nome || !email || !senha) {
        console.error('\nUso: node scripts/setup-super-admin.js "Nome" "email@dominio.com" "Senha"\n');
        process.exit(1);
    }

    const emailNorm = email.toLowerCase().trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
        console.error('[ERRO] E-mail inválido.');
        process.exit(1);
    }

    if (senha.length < 8) {
        console.error('[ERRO] A senha deve ter pelo menos 8 caracteres.');
        process.exit(1);
    }

    await initializeDatabase();

    const hash = await bcrypt.hash(senha, 12);

    // Se já existe usuário com esse e-mail, promove para super-admin
    const [existing] = await pool.query('SELECT id, role FROM usuarios WHERE email = ? LIMIT 1', [emailNorm]);

    if (existing && existing.length > 0) {
        const user = existing[0];
        await pool.query(
            "UPDATE usuarios SET role = 'super-admin', password_hash = ?, nome = ? WHERE id = ?",
            [hash, nome.trim(), user.id]
        );
        console.log(`\n[OK] Usuário existente (id=${user.id}) promovido a super-admin.`);
        console.log(`     E-mail: ${emailNorm}\n`);
        process.exit(0);
    }

    // Cria ou reutiliza a "LDFP Master"
    const [igRows] = await pool.query("SELECT id FROM igrejas WHERE nome = 'LDFP Master' LIMIT 1");
    let igrejaId;
    if (igRows && igRows.length > 0) {
        igrejaId = igRows[0].id;
    } else {
        const [igRes] = await pool.query(
            "INSERT INTO igrejas (nome, plano, status_assinatura, max_cadastros, max_congregacoes) VALUES ('LDFP Master', 'siao', 'ativa', 999999, 999)"
        );
        igrejaId = igRes.insertId;
    }

    const [res] = await pool.query(
        'INSERT INTO usuarios (igreja, igreja_id, nome, email, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)',
        ['LDFP Master', igrejaId, nome.trim(), emailNorm, hash, 'super-admin']
    );

    console.log(`\n[OK] Super-admin criado com sucesso!`);
    console.log(`     ID: ${res.insertId}`);
    console.log(`     E-mail: ${emailNorm}`);
    console.log(`     Role: super-admin\n`);
    process.exit(0);
}

main().catch(err => {
    console.error('\n[ERRO]', err.message, '\n');
    process.exit(1);
});
