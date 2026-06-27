/**
 * Seed de planos — LDFP SaaS
 * Popula a tabela saas_planos com os planos comerciais do sistema.
 * Execute: npm run seed:planos
 */

require('dotenv').config();

const { pool, initializeDatabase } = require('../src/config/db');

const PLANOS = [
  {
    slug: 'teste-7-dias',
    nome: 'Avaliação Gratuita',
    subtitulo: '7 dias sem compromisso',
    preco_mensal: 0,
    preco_anual: 0,
    max_cadastros: 40,
    max_congregacoes: 1,
    modulo_app_membro: 0,
    features_json: JSON.stringify(['Até 40 membros', '1 congregação', 'Módulos básicos', '7 dias grátis']),
  },
  {
    slug: 'basico',
    nome: 'Básico',
    subtitulo: 'Para igrejas em crescimento',
    preco_mensal: 49.90,
    preco_anual: 479.00,
    max_cadastros: 150,
    max_congregacoes: 1,
    modulo_app_membro: 0,
    features_json: JSON.stringify(['Até 150 membros', '1 congregação', 'Finanças completas', 'Secretaria', 'Suporte por e-mail']),
  },
  {
    slug: 'essencial',
    nome: 'Essencial',
    subtitulo: 'O mais popular',
    preco_mensal: 89.90,
    preco_anual: 859.00,
    max_cadastros: 500,
    max_congregacoes: 3,
    modulo_app_membro: 1,
    features_json: JSON.stringify(['Até 500 membros', '3 congregações', 'App do Membro (PWA)', 'EBD', 'Escala de culto', 'Suporte prioritário']),
  },
  {
    slug: 'profissional',
    nome: 'Profissional',
    subtitulo: 'Para igrejas consolidadas',
    preco_mensal: 149.90,
    preco_anual: 1429.00,
    max_cadastros: 2000,
    max_congregacoes: 10,
    modulo_app_membro: 1,
    features_json: JSON.stringify(['Até 2000 membros', '10 congregações', 'Todos os módulos', 'Relatórios avançados', 'Suporte WhatsApp']),
  },
  {
    slug: 'siao',
    nome: 'Sião',
    subtitulo: 'Para denominações e redes',
    preco_mensal: 299.90,
    preco_anual: 2879.00,
    max_cadastros: 999999,
    max_congregacoes: 999,
    modulo_app_membro: 1,
    features_json: JSON.stringify(['Membros ilimitados', 'Congregações ilimitadas', 'Multi-igrejas', 'API pública', 'Gerente de conta dedicado']),
  },
];

async function run() {
  console.log('\n========================================');
  console.log('  Seed de Planos — LDFP Sistema');
  console.log('========================================\n');

  await initializeDatabase();

  let inseridos = 0;
  let existentes = 0;

  for (const plano of PLANOS) {
    const [rows] = await pool.query('SELECT id FROM saas_planos WHERE slug = ? LIMIT 1', [plano.slug]);
    if (rows.length > 0) {
      console.log(`  ⚠️  Plano "${plano.slug}" já existe (id=${rows[0].id}) — pulando.`);
      existentes++;
      continue;
    }

    await pool.query(
      `INSERT INTO saas_planos
        (slug, nome, subtitulo, preco_mensal, preco_anual, max_cadastros, max_congregacoes, modulo_app_membro, features_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plano.slug,
        plano.nome,
        plano.subtitulo,
        plano.preco_mensal,
        plano.preco_anual,
        plano.max_cadastros,
        plano.max_congregacoes,
        plano.modulo_app_membro,
        plano.features_json,
      ]
    );

    console.log(`  ✅ Plano "${plano.nome}" (${plano.slug}) inserido.`);
    inseridos++;
  }

  console.log(`\n📊 Resultado: ${inseridos} inserido(s), ${existentes} já existia(m).`);
  console.log('🎉 Seed de planos concluído.\n');
  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌ Erro no seed de planos:', err?.message || err);
  process.exit(1);
});
