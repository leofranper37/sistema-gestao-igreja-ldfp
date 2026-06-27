#!/usr/bin/env node
'use strict';

/**
 * Migra CPFs existentes no banco para somente dígitos.
 * Afeta: membros.cpf e congregados.cpf
 *
 * Seguro para rodar múltiplas vezes (idempotente).
 * USO: node scripts/migrar-cpf-somente-digitos.js
 */

require('dotenv').config();
const { pool, initializeDatabase } = require('../src/config/db');

const TABELAS = ['membros', 'congregados'];

async function migrarTabela(tabela) {
    const [rows] = await pool.query(
        `SELECT id, cpf FROM ${tabela} WHERE cpf IS NOT NULL AND cpf != ''`
    );

    let atualizados = 0;
    let ignorados = 0;

    for (const row of rows) {
        const original = String(row.cpf);
        const limpo = original.replace(/\D/g, '');

        if (limpo === original) {
            ignorados++;
            continue;
        }

        await pool.query(
            `UPDATE ${tabela} SET cpf = ? WHERE id = ?`,
            [limpo || null, row.id]
        );
        atualizados++;
        console.log(`  [${tabela} id=${row.id}] "${original}" → "${limpo}"`);
    }

    console.log(`  ✓ ${tabela}: ${atualizados} atualizado(s), ${ignorados} já correto(s), ${rows.length} total`);
    return atualizados;
}

async function main() {
    console.log('\n🔧 Migração: CPF → somente dígitos\n');
    await initializeDatabase();

    let totalAtualizados = 0;

    for (const tabela of TABELAS) {
        try {
            totalAtualizados += await migrarTabela(tabela);
        } catch (err) {
            console.error(`  ✗ ${tabela}: ${err.message}`);
        }
    }

    await pool.end();
    console.log(`\n✅ Concluído. Total de CPFs normalizados: ${totalAtualizados}\n`);
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
});
