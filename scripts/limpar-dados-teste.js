#!/usr/bin/env node
'use strict';

/**
 * Limpa todos os dados de teste do banco, deixando apenas:
 *  - A igreja "LDFP Master" (do super-admin)
 *  - O usuário super-admin
 *  - Dados de catálogo: saas_planos, saas_modulos, saas_plano_modulos, sistema_config
 *
 * USO: node scripts/limpar-dados-teste.js
 */

const readline = require('readline');
require('dotenv').config();

const { pool, initializeDatabase } = require('../src/config/db');

const SUPER_ADMIN_EMAIL = 'leopereita31@gmail.com';

// Tabelas com dados operacionais a limpar (em ordem segura: dependentes primeiro)
const TABELAS_OPERACIONAIS = [
    'oracao_intercessores',
    'oracoes_pedidos',
    'pedidos_oracao',
    'batismos',
    'escalas_membros',
    'escalas',
    'grupos_membros',
    'grupos',
    'ebd_presencas',
    'ebd_aulas',
    'ebd_classes',
    'ebd_cursos',
    'agenda_eventos_presencas',
    'agenda_eventos',
    'dizimos',
    'financeiro',
    'contas_pagar',
    'banco_lancamentos',
    'banco_categorias',
    'missionarios',
    'outras_igrejas_membros',
    'visitantes_followup',
    'visitantes',
    'congregados',
    'criancas',
    'auditoria',
    'audit_logs',
    'push_subscriptions',
    'payment_links',
    'checkins_portaria',
    'qr_sessoes',
    'autocadastros',
    'whatsapp_logs',
    'whatsapp_templates',
    'app_congregacoes',
    'app_videos',
    'app_audios',
    'app_images',
    'app_documents',
    'app_conexoes',
    'app_midias',
    'midia_visitantes',
    'telao_visitantes',
    'estudos_membros',
    'estudos',
    'membros',
    'password_reset_requests',
];

async function truncar(tabela) {
    try {
        await pool.query(`DELETE FROM ${tabela}`);
        return true;
    } catch (_) {
        return false; // tabela pode não existir — ignorar
    }
}

async function main() {
    await initializeDatabase();

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    // Descobre o que vai ser apagado
    let igrejas = [];
    let totalMembros = 0;
    let totalUsuarios = 0;

    try {
        const [ig] = await pool.query(`SELECT id, nome FROM igrejas WHERE nome != 'LDFP Master' ORDER BY id`);
        igrejas = ig;
    } catch (_) {}

    try {
        const [[row]] = await pool.query(`SELECT COUNT(*) AS total FROM membros`);
        totalMembros = Number(row?.total || 0);
    } catch (_) {}

    try {
        const [[row]] = await pool.query(
            `SELECT COUNT(*) AS total FROM usuarios WHERE email != ? AND role != 'super-admin'`,
            [SUPER_ADMIN_EMAIL]
        );
        totalUsuarios = Number(row?.total || 0);
    } catch (_) {}

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║      LIMPEZA DE DADOS DE TESTE — LDFP       ║');
    console.log('╚══════════════════════════════════════════════╝\n');
    console.log('O que será DELETADO:');
    console.log(`  • ${totalMembros} membro(s) de todas as igrejas`);
    console.log(`  • ${totalUsuarios} usuário(s) não super-admin`);
    if (igrejas.length === 0) {
        console.log('  • Nenhuma igreja de teste encontrada');
    } else {
        console.log(`  • ${igrejas.length} igreja(s) de teste:`);
        igrejas.forEach(i => console.log(`      [${i.id}] ${i.nome}`));
    }
    console.log('\nO que será MANTIDO:');
    console.log(`  • Super-admin: ${SUPER_ADMIN_EMAIL}`);
    console.log('  • Igreja "LDFP Master"');
    console.log('  • Planos, módulos e configuração do sistema');
    console.log('\n⚠️  AÇÃO IRREVERSÍVEL. Faça backup antes.\n');

    const resposta = await ask('Digite CONFIRMAR para prosseguir (qualquer outro texto cancela): ');
    rl.close();

    if (resposta.trim() !== 'CONFIRMAR') {
        console.log('\n❌ Operação cancelada.\n');
        process.exit(0);
    }

    console.log('\n⏳ Limpando banco...\n');

    // 1. Limpar tabelas operacionais
    for (const tabela of TABELAS_OPERACIONAIS) {
        const ok = await truncar(tabela);
        if (ok) console.log(`  ✓ ${tabela}`);
    }

    // 2. Deletar usuários não-super-admin
    try {
        await pool.query(
            `DELETE FROM usuarios WHERE email != ? AND role != 'super-admin'`,
            [SUPER_ADMIN_EMAIL]
        );
        console.log('  ✓ usuarios (exceto super-admin)');
    } catch (err) {
        console.error(`  ✗ usuarios: ${err.message}`);
    }

    // 3. Deletar igrejas de teste
    try {
        await pool.query(`DELETE FROM igrejas WHERE nome != 'LDFP Master'`);
        console.log('  ✓ igrejas de teste');
    } catch (err) {
        console.error(`  ✗ igrejas: ${err.message}`);
    }

    // 4. Recriar "Igreja Padrão" (id=1) — usada como fallback do sistema
    try {
        await pool.query(
            `INSERT IGNORE INTO igrejas (id, nome, plano, status_assinatura, max_cadastros) VALUES (1, 'Igreja Padrão', 'hebrom', 'trial', 40)`
        );
        console.log('  ✓ Igreja Padrão (id=1) garantida');
    } catch (err) {
        console.error(`  ✗ Igreja Padrão: ${err.message}`);
    }

    console.log('\n✅ Banco limpo e pronto para clientes reais.\n');
    process.exit(0);
}

main().catch(err => {
    console.error('\n❌ Erro fatal:', err.message);
    process.exit(1);
});
