/**
 * importar-biblia.js
 * 
 * Importa uma Bíblia completa em JSON para o Módulo de Estudos LDFP.
 * O formato esperado é um Array de livros, onde cada livro tem "name" e um Array "chapters",
 * e cada capítulo é um Array de Strings (versículos).
 * 
 * Uso: 
 * 1. Configure a SIGLA da versão abaixo (NVI, ARA, ACF, etc).
 * 2. Rode: node scripts/importar-biblia.js
 */

require('dotenv').config();
const { pool } = require('../src/config/db');

// ==========================================
// 1. CONFIGURAÇÕES DA VERSÃO A SER IMPORTADA
// ==========================================
// Escolha uma das siglas da tabela: ACF, ARA, ARC, AS21, JFAA, KJA, KJF, NAA, NBV, NTLH, NVI, NVT, TB
const SIGLA = 'ACF';
const VERSAO = {
    codigo: SIGLA.toLowerCase(),
    nome: 'Almeida Corrigida Fiel',
    idioma: 'pt',
    licenca_nota: 'Domínio público'
};
// ==========================================

async function run() {
    try {
        const url = `https://raw.githubusercontent.com/damarals/biblias/master/inst/json/${SIGLA}.json`;
        
        console.log(`☁️ Baixando a Bíblia ${SIGLA} diretamente do GitHub...`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Falha ao baixar. Status: ${response.status}`);
        
        const bibliaData = await response.json();
        console.log(`✔️ Arquivo baixado com sucesso!`);

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
        
        // Dividindo em lotes de 1000 para não estourar o limite de payload do MySQL (Packet too large)
        for (let i = 0; i < batch.length; i += 1000) {
            const chunk = batch.slice(i, i + 1000);
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