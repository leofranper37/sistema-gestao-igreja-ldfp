/**
 * importar-biblia.js
 * 
 * Importa uma Bíblia completa em JSON para o Módulo de Estudos LDFP.
 * O formato esperado é um Array de livros, onde cada livro tem "name" e um Array "chapters",
 * e cada capítulo é um Array de Strings (versículos).
 * 
 * Uso: 
 * 1. Coloque o arquivo JSON baixado na pasta scripts/ com o nome "biblia.json"
 * 2. Configure os dados da versão abaixo.
 * 3. Rode: node scripts/importar-biblia.js
 */

require('dotenv').config();
const { pool } = require('../src/config/db');
const fs = require('fs');
const path = require('path');

// ==========================================
// 1. CONFIGURAÇÕES DA VERSÃO A SER IMPORTADA
// ==========================================
const ARQUIVO_JSON = 'biblia.json'; 
const VERSAO = {
    codigo: 'nvi',
    nome: 'Nova Versão Internacional',
    idioma: 'pt',
    licenca_nota: 'Uso interno'
};
// ==========================================

async function run() {
    const filePath = path.join(__dirname, ARQUIVO_JSON);
    
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Arquivo não encontrado: ${filePath}`);
        console.error('Por favor, baixe o JSON da Bíblia e coloque na pasta scripts/ com o nome biblia.json');
        process.exit(1);
    }

    console.log(`📖 Lendo arquivo ${ARQUIVO_JSON}...`);
    const bibliaData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    try {
        console.log(`⚙️ Verificando versão '${VERSAO.codigo}' no banco...`);
        
        let versaoId;
        const [versoes] = await pool.query('SELECT id FROM estudo_versoes WHERE codigo = ?', [VERSAO.codigo]);
        
        if (versoes && versoes.length > 0) {
            versaoId = versoes[0].id;
            console.log(`✔️ Versão já existe. ID: ${versaoId}. Limpando versículos antigos...`);
            await pool.query('DELETE FROM estudo_passagens WHERE versao_id = ?', [versaoId]);
        } else {
            const [result] = await pool.query(
                'INSERT INTO estudo_versoes (codigo, nome, idioma, licenca_nota, ativo) VALUES (?, ?, ?, ?, 1)',
                [VERSAO.codigo, VERSAO.nome, VERSAO.idioma, VERSAO.licenca_nota]
            );
            versaoId = result.insertId;
            console.log(`✔️ Versão criada. ID: ${versaoId}.`);
        }

        console.log('🚀 Preparando os versículos para inserção em lote...');
        let batch = [];
        
        bibliaData.forEach((livro, livroIndex) => {
            livro.chapters.forEach((capitulo, capIndex) => {
                capitulo.forEach((texto, versIndex) => {
                    batch.push([versaoId, livro.name, livroIndex + 1, capIndex + 1, versIndex + 1, texto]);
                });
            });
        });

        console.log(`⏳ Inserindo ${batch.length} versículos no banco (Isso pode levar alguns segundos)...`);
        
        // Dividindo em lotes de 2000 para não estourar o limite de payload do MySQL
        for (let i = 0; i < batch.length; i += 2000) {
            const chunk = batch.slice(i, i + 2000);
            // ATENÇÃO: A sintaxe de múltiplas inserções usa array de arrays
            await pool.query('INSERT INTO estudo_passagens (versao_id, livro, livro_ordem, capitulo, versiculo, texto) VALUES ?', [chunk]);
        }

        console.log('✅ Bíblia importada com sucesso!');
    } catch (error) {
        console.error('❌ Erro crítico ao importar:', error);
    } finally {
        process.exit(0);
    }
}

run();