const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.ldfp-resume');
const STATE_FILE = path.join(STATE_DIR, 'state.json');
const TRIGGER = 'LDFP_CONTINUAR';

function run(cmd) {
    try {
        return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    } catch (_err) {
        return '';
    }
}

function ensureStateDir() {
    if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
    }
}

function loadState() {
    ensureStateDir();

    if (!fs.existsSync(STATE_FILE)) {
        return {
            trigger: TRIGGER,
            checkpoints: [],
            focus: {
                currentObjective: 'Sem objetivo definido',
                nextSteps: []
            },
            environment: {
                productionUrl: 'https://app.ldfp.com.br',
                cloudIdeUrl: 'https://improved-funicular-5xjvrqxg4q9hpv6r.github.dev/'
            }
        };
    }

    try {
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (_err) {
        return {
            trigger: TRIGGER,
            checkpoints: [],
            focus: {
                currentObjective: 'Arquivo de estado corrompido. Rode "npm run gatilho:save" para recriar.',
                nextSteps: []
            },
            environment: {
                productionUrl: 'https://app.ldfp.com.br',
                cloudIdeUrl: 'https://improved-funicular-5xjvrqxg4q9hpv6r.github.dev/'
            }
        };
    }
}

function saveState(state) {
    ensureStateDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function getGitSnapshot() {
    const branch = run('git rev-parse --abbrev-ref HEAD') || 'desconhecido';
    const head = run('git rev-parse HEAD') || 'desconhecido';
    const shortHead = head !== 'desconhecido' ? head.slice(0, 7) : head;
    const statusRaw = run('git status --short');
    const changedFiles = statusRaw ? statusRaw.split('\n').map((line) => line.trim()).filter(Boolean) : [];

    return {
        branch,
        head,
        shortHead,
        dirty: changedFiles.length > 0,
        changedFiles
    };
}

function cmdSave(note) {
    const state = loadState();
    const git = getGitSnapshot();
    const now = new Date().toISOString();

    const checkpoint = {
        at: now,
        note: note || 'Checkpoint manual',
        git
    };

    const checkpoints = Array.isArray(state.checkpoints) ? state.checkpoints : [];
    checkpoints.unshift(checkpoint);

    state.trigger = TRIGGER;
    state.updatedAt = now;
    state.lastCheckpoint = checkpoint;
    state.checkpoints = checkpoints.slice(0, 30);
    state.git = git;

    if (!state.environment) {
        state.environment = {
            productionUrl: 'https://app.ldfp.com.br',
            cloudIdeUrl: 'https://improved-funicular-5xjvrqxg4q9hpv6r.github.dev/'
        };
    }

    saveState(state);

    console.log('Gatilho salvo com sucesso.');
    console.log(`Trigger: ${TRIGGER}`);
    console.log(`Branch: ${git.branch}`);
    console.log(`Head: ${git.shortHead}`);
    console.log(`Arquivo: ${path.relative(ROOT, STATE_FILE)}`);
}

function list(items = []) {
    if (!Array.isArray(items) || items.length === 0) {
        return '(vazio)';
    }

    return items.map((item, idx) => `${idx + 1}. ${item}`).join('\n');
}

function cmdResume() {
    const state = loadState();
    const git = getGitSnapshot();
    const last = state.lastCheckpoint || null;

    console.log('=== GATILHO DE RETOMADA LDFP ===');
    console.log(`Trigger: ${state.trigger || TRIGGER}`);
    console.log(`Atualizado em: ${state.updatedAt || 'nunca'}`);
    console.log('');

    if (last) {
        console.log('Ultimo checkpoint:');
        console.log(`- Data: ${last.at}`);
        console.log(`- Nota: ${last.note}`);
        console.log(`- Commit: ${last.git?.shortHead || 'desconhecido'}`);
        console.log(`- Branch: ${last.git?.branch || 'desconhecido'}`);
        console.log('');
    }

    console.log('Objetivo atual:');
    console.log(`- ${state.focus?.currentObjective || 'Sem objetivo definido'}`);
    console.log('');

    console.log('Proximos passos:');
    console.log(list(state.focus?.nextSteps));
    console.log('');

    console.log('Ambiente:');
    console.log(`- Producao: ${state.environment?.productionUrl || 'n/d'}`);
    console.log(`- Cloud IDE: ${state.environment?.cloudIdeUrl || 'n/d'}`);
    console.log('');

    console.log('Git agora:');
    console.log(`- Branch: ${git.branch}`);
    console.log(`- Commit: ${git.shortHead}`);
    console.log(`- Alteracoes locais: ${git.dirty ? 'sim' : 'nao'}`);
    if (git.changedFiles.length) {
        console.log('- Arquivos alterados:');
        git.changedFiles.slice(0, 20).forEach((line) => console.log(`  ${line}`));
    }

    console.log('');
    console.log(`Para atualizar o estado: npm run gatilho:save -- "resumo do que foi feito"`);
}

function cmdInitToday() {
    const state = loadState();

    state.trigger = TRIGGER;
    state.updatedAt = new Date().toISOString();
    state.focus = {
        currentObjective: 'Produzir e evoluir o LDFP com controle comercial por plano/modulos e UX premium padrao.',
        nextSteps: [
            'Padronizar telas fora do estilo LDFP (modulos legados/confusos).',
            'Concluir modulo de Contabilidade (plano de contas, balancete real, lancamentos, encerramento).',
            'Expandir admin SaaS com matriz visual de modulos por igreja para venda e upsell.',
            'Validar bloqueios de contrato em producao com contas de teste por plano.'
        ]
    };

    state.environment = {
        productionUrl: 'https://app.ldfp.com.br',
        cloudIdeUrl: 'https://improved-funicular-5xjvrqxg4q9hpv6r.github.dev/'
    };

    saveState(state);
    cmdSave('Baseline de retomada inicial configurada');
}

const action = (process.argv[2] || '').trim().toLowerCase();
const note = process.argv.slice(3).join(' ').trim();

if (!action || action === 'help') {
    console.log('Uso:');
    console.log('  node scripts/gatilho-retomada.js init-today');
    console.log('  node scripts/gatilho-retomada.js save "nota do checkpoint"');
    console.log('  node scripts/gatilho-retomada.js resume');
    process.exit(0);
}

if (action === 'init-today') {
    cmdInitToday();
} else if (action === 'save') {
    cmdSave(note);
} else if (action === 'resume') {
    cmdResume();
} else {
    console.log(`Acao desconhecida: ${action}`);
    process.exit(1);
}
