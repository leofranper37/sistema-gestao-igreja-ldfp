/**
 * Importação da Bíblia ACF (Almeida Corrigida Fiel) — Domínio Público
 * Fonte: thiagobodruk/biblia (GitHub), licença MIT
 *
 * Executar UMA VEZ via SSH no servidor:
 *   cd /home/ldfp8965/sistema-gestao-igreja-ldfp-main
 *   node importar-biblia.js
 */

'use strict';

const path   = require('path');
const fs     = require('fs');
const mysql2 = require('mysql2/promise');

// Carrega variáveis de ambiente do .env (sem acionar a validação de JWT do app)
require('dotenv').config();

const JSON_PATH = path.join(__dirname, 'biblia-acf.json');
const BATCH     = 500;

// Nomes do JSON que diferem do dropdown do frontend (estudo.html)
const NORMALIZAR = {
    'Lamentações de Jeremias': 'Lamentações',
    'Oséias':                   'Oseias',
    'Miquéias':                 'Miqueias',
};

async function main() {
    if (!fs.existsSync(JSON_PATH)) {
        console.error('ERRO: biblia-acf.json não encontrado em', JSON_PATH);
        process.exit(1);
    }

    const biblia = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    console.log(`JSON carregado — ${biblia.length} livros`);

    const pool = mysql2.createPool({
        host:     process.env.DB_HOST     || 'localhost',
        user:     process.env.DB_USER     || 'ldfp8965_Leo',
        password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
        database: process.env.DB_NAME     || 'ldfp8965_sistema_gestao',
        waitForConnections: true,
        connectionLimit: 3,
    });

    const conn = await pool.getConnection();

    try {
        // 1. Garante que a versão ACF existe
        const [versoes] = await conn.query(
            'SELECT id FROM estudo_versoes WHERE codigo = ?', ['acf']
        );

        let versao_id;
        if (versoes.length) {
            versao_id = versoes[0].id;
            console.log(`Versão ACF já existe (id=${versao_id}). Pulando inserção da versão.`);
        } else {
            const [ins] = await conn.query(
                `INSERT INTO estudo_versoes (codigo, nome, idioma, licenca_nota, ativo)
                 VALUES (?, ?, ?, ?, 1)`,
                ['acf', 'Almeida Corrigida Fiel', 'pt-BR', 'Domínio Público — baseada na tradução de João Ferreira de Almeida (1753)']
            );
            versao_id = ins.insertId;
            console.log(`Versão ACF criada (id=${versao_id})`);
        }

        // 2. Verifica se já há versículos importados
        const [[{ total }]] = await conn.query(
            'SELECT COUNT(*) AS total FROM estudo_passagens WHERE versao_id = ?', [versao_id]
        );
        if (total > 0) {
            console.log(`AVISO: já existem ${total} versículos da ACF no banco. Abortando para evitar duplicata.`);
            console.log('Para reimportar, DELETE FROM estudo_passagens WHERE versao_id = ' + versao_id + ' primeiro.');
            return;
        }

        // 3. Monta todas as linhas
        const rows = [];
        for (let livroIdx = 0; livroIdx < biblia.length; livroIdx++) {
            const livroObj = biblia[livroIdx];
            const nomeBruto = livroObj.name;
            const nome = NORMALIZAR[nomeBruto] || nomeBruto;
            const ordem = livroIdx + 1;

            for (let capIdx = 0; capIdx < livroObj.chapters.length; capIdx++) {
                const versiculos = livroObj.chapters[capIdx];
                for (let vsIdx = 0; vsIdx < versiculos.length; vsIdx++) {
                    rows.push([
                        versao_id,
                        nome,
                        ordem,
                        capIdx + 1,
                        vsIdx + 1,
                        versiculos[vsIdx],
                    ]);
                }
            }
        }

        console.log(`Total de versículos a inserir: ${rows.length}`);

        // 4. Insere em lotes
        let inseridos = 0;
        for (let i = 0; i < rows.length; i += BATCH) {
            const lote = rows.slice(i, i + BATCH);
            await conn.query(
                `INSERT INTO estudo_passagens (versao_id, livro, livro_ordem, capitulo, versiculo, texto)
                 VALUES ?`,
                [lote]
            );
            inseridos += lote.length;
            process.stdout.write(`\r  ${inseridos}/${rows.length} versículos...`);
        }

        console.log(`\nImportação concluída! ${inseridos} versículos inseridos.`);

    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch(err => {
    console.error('ERRO FATAL:', err.message);
    process.exit(1);
});
