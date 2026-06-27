#!/usr/bin/env node

/**
 * VALIDADOR DE PRODUÇÃO - cPanel
 * 
 * Use este script para validar se o projeto está pronto para cPanel.
 * Rode localmente: node scripts/validate-cpanel-ready.js
 */

const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

const log = {
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.cyan}ℹ️  ${msg}${colors.reset}`),
  title: (msg) => console.log(`\n${colors.bold}${colors.cyan}═══════════════════════════════════${colors.reset}\n${colors.bold}${msg}${colors.reset}\n${colors.bold}${colors.cyan}═══════════════════════════════════${colors.reset}\n`)
};

let errors = [];
let warnings = [];

// ============================================================
// 1. Validar Estrutura de Pastas
// ============================================================
log.title('1️⃣  VALIDANDO ESTRUTURA DE PASTAS');

const requiredDirs = [
  'src',
  'public',
  'scripts',
  'node_modules'
];

requiredDirs.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (fs.existsSync(dirPath)) {
    log.success(`Pasta "${dir}" existe`);
  } else {
    if (dir === 'node_modules') {
      log.warn(`Pasta "node_modules" não encontrada. Execute "npm install" antes do deploy`);
      warnings.push('node_modules ausente - será instalado no cPanel');
    } else {
      log.error(`Pasta "${dir}" não encontrada!`);
      errors.push(`Pasta obrigatória "${dir}" está faltando`);
    }
  }
});

// ============================================================
// 2. Validar Arquivo de Inicialização
// ============================================================
log.title('2️⃣  VALIDANDO ARQUIVO DE INICIALIZAÇÃO');

const serverFile = path.join(__dirname, '..', 'src', 'server.js');
if (fs.existsSync(serverFile)) {
  log.success('Arquivo src/server.js existe');
  const content = fs.readFileSync(serverFile, 'utf8');
  if (content.includes('app.listen') || content.includes('server.listen')) {
    log.success('src/server.js contém comando "listen"');
  } else {
    log.error('src/server.js não contém "app.listen" ou "server.listen"');
    errors.push('Arquivo de inicialização não tem comando listen()');
  }
} else {
  log.error('Arquivo src/server.js não encontrado!');
  errors.push('src/server.js está faltando - é o arquivo de inicialização');
}

// ============================================================
// 3. Validar package.json
// ============================================================
log.title('3️⃣  VALIDANDO package.json');

const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    log.success('package.json existe e é válido JSON');

    // Validar main
    if (pkg.main === 'src/server.js') {
      log.success(`"main" aponta para "src/server.js"`);
    } else {
      log.warn(`"main" é "${pkg.main}" - recomendado ser "src/server.js"`);
    }

    // Validar start script
    if (pkg.scripts && pkg.scripts.start === 'node src/server.js') {
      log.success(`"start" script é "node src/server.js"`);
    } else {
      log.error(`"start" script deveria ser "node src/server.js"`);
      errors.push('Script "start" está incorreto no package.json');
    }

    // Validar dependências críticas
    const criticalDeps = ['express', 'dotenv', 'mysql2', 'jsonwebtoken'];
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    criticalDeps.forEach(dep => {
      if (deps[dep]) {
        log.success(`Dependência "${dep}" declarada`);
      } else {
        log.error(`Dependência crítica "${dep}" não encontrada!`);
        errors.push(`Dependência ${dep} está faltando`);
      }
    });
  } catch (err) {
    log.error(`package.json inválido: ${err.message}`);
    errors.push('package.json não é um JSON válido');
  }
} else {
  log.error('package.json não encontrado!');
  errors.push('package.json está faltando');
}

// ============================================================
// 4. Validar Variáveis de Ambiente
// ============================================================
log.title('4️⃣  VALIDANDO VARIÁVEIS DE AMBIENTE');

const envPath = path.join(__dirname, '..', '.env');
const envExamplePath = path.join(__dirname, '..', '.env.example');

if (fs.existsSync(envPath)) {
  log.success('Arquivo .env encontrado localmente');
  const envContent = fs.readFileSync(envPath, 'utf8');

  const requiredEnvVars = [
    'NODE_ENV',
    'APP_BASE_URL',
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME',
    'JWT_SECRET'
  ];

  requiredEnvVars.forEach(varName => {
    if (envContent.includes(`${varName}=`)) {
      log.success(`Variável ${varName} está definida`);
    } else {
      log.warn(`Variável ${varName} não encontrada em .env`);
      warnings.push(`${varName} não está em .env local`);
    }
  });

  // Validar valores perigosos
  if (envContent.includes('NODE_ENV=development')) {
    log.warn('NODE_ENV ainda está como "development" - deve ser "production" em cPanel');
    warnings.push('NODE_ENV deve ser "production" para cPanel');
  }

  if (envContent.includes('JWT_SECRET=') && !envContent.includes('JWT_SECRET=troque-') && envContent.match(/JWT_SECRET=.{0,20}[\r\n]/)) {
    log.warn('JWT_SECRET parece fraco (menos de 20 caracteres)');
    warnings.push('JWT_SECRET é muito fraco');
  }
} else {
  log.warn('Arquivo .env não encontrado localmente');
  log.info('Isso é ok - será criado no cPanel. Mas verifique .env.example como referência.');
}

if (fs.existsSync(envExamplePath)) {
  log.success('Arquivo .env.example encontrado (referência disponível)');
} else {
  log.warn('.env.example não encontrado - mantenha este arquivo como referência');
}

// ============================================================
// 5. Validar Banco de Dados
// ============================================================
log.title('5️⃣  VALIDANDO CONFIGURAÇÃO DE BANCO');

const dbConfigPath = path.join(__dirname, '..', 'src', 'config', 'db.js');
if (fs.existsSync(dbConfigPath)) {
  log.success('Arquivo src/config/db.js existe');
  const dbContent = fs.readFileSync(dbConfigPath, 'utf8');

  if (dbContent.includes('mysql2') || dbContent.includes('pg') || dbContent.includes('sqlite')) {
    log.success('Arquivo de config contém suporte a banco de dados');
  }

  const readsEnvDirectly = dbContent.includes('process.env.DB_HOST') || dbContent.includes('process.env.DATABASE_URL');
  const readsEnvViaHelper = dbContent.includes('readEnv(') || dbContent.includes('parseDbUrl(');

  if (readsEnvDirectly || readsEnvViaHelper) {
    log.success('Config lê variáveis de ambiente para conexão');
  } else {
    log.error('Arquivo db.js não parece ler variáveis de ambiente');
    errors.push('db.js não lê variáveis de ambiente - verificar implementação');
  }
} else {
  log.error('Arquivo src/config/db.js não encontrado!');
  errors.push('Configuração de banco está faltando');
}

// ============================================================
// 6. Validar Middleware de Error Handler
// ============================================================
log.title('6️⃣  VALIDANDO ERROR HANDLING');

const appPath = path.join(__dirname, '..', 'src', 'app.js');
if (fs.existsSync(appPath)) {
  log.success('Arquivo src/app.js existe');
  const appContent = fs.readFileSync(appPath, 'utf8');

  if (appContent.includes('errorHandler') || appContent.includes('app.use((err')) {
    log.success('Error handler middleware está configurado');
  } else {
    log.warn('Possível falta de error handler middleware');
    warnings.push('Verificar se há tratamento de erros centralizado');
  }
} else {
  log.warn('src/app.js não encontrado - verificar localização');
}

// ============================================================
// 7. Validar .gitignore
// ============================================================
log.title('7️⃣  VALIDANDO .gitignore');

const gitignorePath = path.join(__dirname, '..', '.gitignore');
if (fs.existsSync(gitignorePath)) {
  log.success('Arquivo .gitignore existe');
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');

  const essential = ['.env', 'node_modules', '.mysql-data'];
  essential.forEach(pattern => {
    if (gitignoreContent.includes(pattern)) {
      log.success(`".gitignore" contém exclusão para "${pattern}"`);
    } else {
      log.warn(`".gitignore" não exclui "${pattern}" - pode poluir o repositório`);
      warnings.push(`${pattern} não está em .gitignore`);
    }
  });
} else {
  log.warn('.gitignore não encontrado - criar um é recomendado');
}

// ============================================================
// 8. Resumo Final
// ============================================================
log.title('📊 RESUMO FINAL');

if (errors.length === 0 && warnings.length === 0) {
  log.success('✨ PROJETO PRONTO PARA CPANEL! ✨');
  console.log('\nVocê pode fazer:');
  console.log(`  ${colors.cyan}git add .${colors.reset}`);
  console.log(`  ${colors.cyan}git commit -m "Pronto para deploy cPanel"${colors.reset}`);
  console.log(`  ${colors.cyan}git push origin main${colors.reset}\n`);
  process.exit(0);
} else {
  if (errors.length > 0) {
    console.log(`\n${colors.red}${colors.bold}ERROS ENCONTRADOS (${errors.length}):${colors.reset}`);
    errors.forEach((err, i) => {
      console.log(`  ${i + 1}. ${err}`);
    });
  }

  if (warnings.length > 0) {
    console.log(`\n${colors.yellow}${colors.bold}AVISOS (${warnings.length}):${colors.reset}`);
    warnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. ${warn}`);
    });
  }

  if (errors.length > 0) {
    console.log(`\n${colors.red}❌ Projeto NÃO está pronto. Corrija os erros acima.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`\n${colors.yellow}⚠️  Projeto tem avisos, mas pode fazer deploy. Recomenda-se revisar.${colors.reset}\n`);
    process.exit(0);
  }
}
