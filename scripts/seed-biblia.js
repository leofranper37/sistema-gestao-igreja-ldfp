/**
 * seed-biblia.js
 * 
 * Popula o banco de dados com uma versão da Bíblia e um capítulo de exemplo
 * para testar o MVP do Módulo de Estudos LDFP.
 * 
 * Uso: node scripts/seed-biblia.js
 */

require('dotenv').config();
const { pool } = require('../src/config/db');

const versaoSeed = {
    codigo: 'arc',
    nome: 'Almeida Revista e Corrigida',
    idioma: 'pt',
    licenca_nota: 'Domínio Público'
};

const livroSeed = 'João';
const livroOrdem = 43; // João é o 43º livro da Bíblia
const capituloSeed = 1;

const versiculos = [
    "No princípio era o Verbo, e o Verbo estava com Deus, e o Verbo era Deus.",
    "Ele estava no princípio com Deus.",
    "Todas as coisas foram feitas por ele, e sem ele nada do que foi feito se fez.",
    "Nele estava a vida, e a vida era a luz dos homens.",
    "E a luz resplandece nas trevas, e as trevas não a compreenderam.",
    "Houve um homem enviado de Deus, cujo nome era João.",
    "Este veio para testemunho, para que testificasse da luz, para que todos cressem por ele.",
    "Não era ele a luz, mas para que testificasse da luz.",
    "Ali estava a luz verdadeira, que ilumina a todo o homem que vem ao mundo.",
    "Estava no mundo, e o mundo foi feito por ele, e o mundo não o conheceu.",
    "Veio para o que era seu, e os seus não o receberam.",
    "Mas, a todos quantos o receberam, deu-lhes o poder de serem feitos filhos de Deus, aos que creem no seu nome;",
    "Os quais não nasceram do sangue, nem da vontade da carne, nem da vontade do homem, mas de Deus.",
    "E o Verbo se fez carne, e habitou entre nós, e vimos a sua glória, como a glória do unigênito do Pai, cheio de graça e de verdade."
];

async function runSeed() {
    console.log('🌱 Iniciando Seed da Bíblia (Módulo Estudo LDFP)...');
    
    try {
        // 1. Inserir ou buscar a versão
        let versaoId;
        const [versoes] = await pool.query('SELECT id FROM estudo_versoes WHERE codigo = ?', [versaoSeed.codigo]);

        if (versoes && versoes.length > 0) {
            versaoId = versoes[0].id;
            console.log(`✔️ Versão '${versaoSeed.codigo}' já existe (ID: ${versaoId}).`);
        } else {
            const [result] = await pool.query(
                `INSERT INTO estudo_versoes (codigo, nome, idioma, licenca_nota, ativo) VALUES (?, ?, ?, ?, 1)`,
                [versaoSeed.codigo, versaoSeed.nome, versaoSeed.idioma, versaoSeed.licenca_nota]
            );
            versaoId = result.insertId;
            console.log(`✔️ Versão '${versaoSeed.codigo}' criada (ID: ${versaoId}).`);
        }

        // 2. Limpar passagens existentes para evitar duplicação em múltiplos testes
        await pool.query(
            'DELETE FROM estudo_passagens WHERE versao_id = ? AND livro = ? AND capitulo = ?',
            [versaoId, livroSeed, capituloSeed]
        );

        // 3. Inserir os versículos
        console.log(`📖 Inserindo ${versiculos.length} versículos de ${livroSeed} ${capituloSeed}...`);
        for (let i = 0; i < versiculos.length; i++) {
            await pool.query(
                `INSERT INTO estudo_passagens (versao_id, livro, livro_ordem, capitulo, versiculo, texto) VALUES (?, ?, ?, ?, ?, ?)`,
                [versaoId, livroSeed, livroOrdem, capituloSeed, i + 1, versiculos[i]]
            );
        }

        console.log('✅ Seed finalizado com sucesso!');
    } catch (error) {
        console.error('❌ Erro ao executar seed:', error);
    } finally {
        process.exit(0);
    }
}

runSeed();