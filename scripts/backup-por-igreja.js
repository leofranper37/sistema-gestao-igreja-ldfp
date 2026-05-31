/**
 * backup-por-igreja.js
 * Exporta todos os dados de cada igreja para JSON, salvos em /backups/{data}/
 * 
 * Uso:
 *   node scripts/backup-por-igreja.js                  → faz backup de TODAS as igrejas
 *   node scripts/backup-por-igreja.js --igreja_id=3    → backup de uma igreja específica
 * 
 * Cron diário no cPanel (03:00):
 *   0 3 * * * cd /home/ldfp8965/ldfp.com.br && node scripts/backup-por-igreja.js >> /home/ldfp8965/backups/backup.log 2>&1
 */

'use strict';
require('dotenv').config();

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');

// Tabelas que pertencem a uma igreja (filtradas por igreja_id)
const TABELAS_IGREJA = [
    'membros',
    'usuarios',
    'visitantes',
    'congregados',
    'criancas',
    'cargos',
    'pedidos_oracao',
    'oracoes_pedidos',
    'banco_contas',
    'banco_lancamentos',
    'contas_pagar',
    'payment_links',
    'contabilidade_plano_contas',
    'contabilidade_balancete_abertura',
    'contabilidade_lancamentos',
    'contabilidade_encerramentos',
    'escalas',
    'dizimos',
    'missionarios',
    'congregacoes',
    'agenda_eventos',
    'batismos',
    'ebd_turmas',
    'ebd_alunos',
    'ebd_grades',
];

function getArg(nome) {
    const found = process.argv.find(a => a.startsWith(`--${nome}=`));
    return found ? found.split('=').slice(1).join('=') : null;
}

function sanitizarNome(nome) {
    return String(nome || 'sem_nome')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 40);
}

async function exportarTabela(conn, tabela, igrejaId) {
    try {
        const [rows] = await conn.query(
            `SELECT * FROM \`${tabela}\` WHERE igreja_id = ?`,
            [igrejaId]
        );
        return rows;
    } catch (_) {
        return []; // tabela pode não existir neste ambiente
    }
}

async function backupIgreja(conn, igreja, dirBase) {
    const nomeSeguro = sanitizarNome(igreja.nome);
    const dirIgreja  = path.join(dirBase, `${igreja.id}_${nomeSeguro}`);
    fs.mkdirSync(dirIgreja, { recursive: true });

    const dados = { igreja: { ...igreja }, tabelas: {} };

    // Não salvar hash de senha — segurança
    if (dados.igreja.config_personalizada_json) {
        try { dados.igreja.config_personalizada_json = JSON.parse(dados.igreja.config_personalizada_json); }
        catch (_) {}
    }

    for (const tabela of TABELAS_IGREJA) {
        const linhas = await exportarTabela(conn, tabela, igreja.id);
        if (tabela === 'usuarios') {
            // Remover hashes de senha do backup
            dados.tabelas[tabela] = linhas.map(u => {
                const { password_hash, ...resto } = u;
                return resto;
            });
        } else {
            dados.tabelas[tabela] = linhas;
        }
    }

    const arquivoSaida = path.join(dirIgreja, 'dados.json');
    fs.writeFileSync(arquivoSaida, JSON.stringify(dados, null, 2), 'utf8');

    const totalMembros = (dados.tabelas.membros || []).length;
    console.log(`  ✓ ${igreja.nome} — ${totalMembros} membro(s) — ${arquivoSaida}`);

    return {
        id: igreja.id,
        nome: igreja.nome,
        plano: igreja.plano,
        status: igreja.status_assinatura,
        total_membros: totalMembros,
        arquivo_relativo: path.relative(
            path.resolve(__dirname, '..', 'backups'),
            arquivoSaida
        ).replace(/\\/g, '/')
    };
}

async function main() {
    const igrejaIdArg = getArg('igreja_id');

    // Pasta raiz de backups — dentro do projeto para cPanel poder acessar
    const backupRoot = process.env.BACKUP_DIR
        || path.resolve(__dirname, '..', 'backups');
    const hoje = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dirHoje = path.join(backupRoot, hoje);
    fs.mkdirSync(dirHoje, { recursive: true });

    // Conexão MySQL
    const conn = await mysql.createConnection({
        host:     process.env.DB_HOST     || process.env.MYSQL_HOST     || 'localhost',
        port:     Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
        user:     process.env.DB_USER     || process.env.MYSQL_USER,
        password: process.env.DB_PASSWORD || process.env.MYSQL_PASSWORD || '',
        database: process.env.DB_NAME     || process.env.MYSQL_DATABASE,
    });

    let igrejas;
    if (igrejaIdArg) {
        const [rows] = await conn.query('SELECT * FROM igrejas WHERE id = ? LIMIT 1', [igrejaIdArg]);
        igrejas = rows;
        if (!igrejas.length) {
            console.error(`Igreja id=${igrejaIdArg} não encontrada.`);
            await conn.end();
            process.exit(1);
        }
    } else {
        const [rows] = await conn.query('SELECT * FROM igrejas ORDER BY id ASC');
        igrejas = rows;
    }

    console.log(`\n=== Backup LDFP — ${hoje} === (${igrejas.length} igreja(s))\n`);

    const manifest = {
        gerado_em: new Date().toISOString(),
        data: hoje,
        igrejas: []
    };

    for (const igreja of igrejas) {
        const info = await backupIgreja(conn, igreja, dirHoje);
        manifest.igrejas.push(info);
    }

    // Salvar manifesto do dia
    const manifestPath = path.join(dirHoje, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Atualizar índice global de backups
    const indiceGlobal = path.join(backupRoot, 'indice.json');
    let indice = [];
    if (fs.existsSync(indiceGlobal)) {
        try { indice = JSON.parse(fs.readFileSync(indiceGlobal, 'utf8')); } catch (_) {}
    }
    // Remover entrada antiga do mesmo dia e adicionar nova
    indice = indice.filter(e => e.data !== hoje);
    indice.unshift({ data: hoje, igrejas: manifest.igrejas.length, gerado_em: manifest.gerado_em });
    indice = indice.slice(0, 90); // manter histórico de 90 dias
    fs.writeFileSync(indiceGlobal, JSON.stringify(indice, null, 2), 'utf8');

    console.log(`\n✅ Backup concluído: ${dirHoje}`);
    console.log(`   Manifesto: ${manifestPath}\n`);

    await conn.end();
}

main().catch(err => {
    console.error('\n❌ Erro no backup:', err.message);
    process.exit(1);
});
