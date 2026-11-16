/**
 * acessoIgreja.js
 * Regras de acesso da igreja cliente aplicadas no servidor (chamadas pelo requireAuth):
 *   1) Assinatura: trial vencido, cancelado ou suspenso → 402 (só pagamento/planos/conta liberados)
 *   2) Plano: módulo que o plano da igreja não inclui → 403
 *
 * A regra de módulos espelha o menu (public/enterprise-shell.js): se o plano não tem
 * nenhum módulo configurado, não há restrição; trial válido libera tudo.
 * Super-admin e o acesso de suporte ("Acessar" no painel SaaS) nunca são bloqueados.
 */

const { createHttpError } = require('../utils/httpError');

// Rotas autenticadas que continuam funcionando com a assinatura vencida
const ROTAS_LIVRES_ASSINATURA = [
    '/auth/me',
    '/api/modulos/me',
    '/api/pagamentos',
    '/api/pix',
    '/api/planos',
    '/api/minha-conta',
    '/api/2fa',
    '/api/push',
    '/api/church/config',
    '/realtime',
    '/super-admin',
    '/api/saas',
    '/api/admin',
    '/logout',
];

const STATUS_BLOQUEADOS = ['cancelado', 'cancelada', 'suspensa', 'suspenso', 'inativa', 'inativo', 'expirado'];

// Mesmos apelidos do menu: chaves antigas do catálogo → chave atual
const APELIDOS_MODULO = {
    igrejas: 'outras_igrejas',
    congregacoes: 'outras_igrejas',
    ebd_dominical: 'ebd',
    'criancas-ebd': 'ebd',
    criancas_ebd: 'ebd',
    grupos_celulas: 'grupos',
};

// Módulos da tesouraria: o plano libera se tiver o módulo específico OU o "financeiro" geral
const TESOURARIA = (chave) => [chave, 'financeiro', 'dizimos'];

// Prefixo da API → chaves de módulo que liberam o acesso (basta uma)
const MODULOS_POR_ROTA = [
    ['/banco/', TESOURARIA('bancos')],
    ['/caixa/', TESOURARIA('caixa')],
    ['/dizimos', TESOURARIA('dizimos')],
    ['/tipos-receita', TESOURARIA('dizimos')],
    ['/contas-pagar', TESOURARIA('contas_pagar')],
    ['/api/tesouraria/', TESOURARIA('contas_pagar')],
    ['/contabilidade/', TESOURARIA('contabilidade')],
    ['/api/recibos', TESOURARIA('recibos')],
    ['/api/escalas', ['escalas']],
    ['/api/ebd', ['ebd']],
    ['/api/batismos', ['batismos']],
    ['/api/grupos', ['grupos']],
    ['/api/criancas', ['criancas']],
    ['/missionarios', ['missionarios']],
    ['/outras-igrejas', ['outras_igrejas']],
    ['/api/visitantes-followup', ['visitantes']],
    ['/api/estudo', ['estudo']],
];

function caminhoDa(req) {
    return String(req.originalUrl || req.url || '').split('?')[0];
}

function comecaCom(caminho, prefixo) {
    if (prefixo.endsWith('/')) return caminho.startsWith(prefixo);
    return caminho === prefixo || caminho.startsWith(`${prefixo}/`);
}

function normalizarChave(valor) {
    const k = String(valor || '').trim().toLowerCase();
    return APELIDOS_MODULO[k] || k;
}

function isTrialValido(auth) {
    if (auth.statusAssinatura !== 'trial') return false;
    const fim = auth.trialEndsAt ? new Date(auth.trialEndsAt) : null;
    return !fim || Number.isNaN(fim.getTime()) || fim > new Date();
}

function isAcessoIrrestrito(auth) {
    return auth.role === 'super-admin' || Boolean(auth.impersonatedBy);
}

function verificarAssinatura(req) {
    const auth = req.auth;
    if (isAcessoIrrestrito(auth)) return null;
    const caminho = caminhoDa(req);
    if (ROTAS_LIVRES_ASSINATURA.some((p) => comecaCom(caminho, p.replace(/\/$/, '')))) return null;

    const status = String(auth.statusAssinatura || 'ativa').toLowerCase();

    if (status === 'trial') {
        if (isTrialValido(auth)) return null;
        // O status no banco não é alterado aqui: o painel SaaS já mostra o trial vencido
        return createHttpError(402, 'Seu período de teste terminou. Escolha um plano para continuar usando o sistema.');
    }

    if (STATUS_BLOQUEADOS.includes(status)) {
        return createHttpError(402, 'A assinatura da sua igreja está inativa. Acesse a página de planos para reativar.');
    }

    return null;
}

function verificarModulo(req) {
    const auth = req.auth;
    if (isAcessoIrrestrito(auth) || isTrialValido(auth)) return null;

    const caminho = caminhoDa(req);
    const regra = MODULOS_POR_ROTA.find(([prefixo]) => comecaCom(caminho, prefixo));
    if (!regra) return null;

    const liberados = (auth.moduleFeatures || []).map(normalizarChave).filter(Boolean);
    // Plano sem módulos configurados = sem restrição (mesma regra do menu)
    if (!liberados.length) return null;

    const aceitas = regra[1].map(normalizarChave);
    if (aceitas.some((k) => liberados.includes(k))) return null;

    return createHttpError(403, 'Este módulo não faz parte do plano da sua igreja. Faça um upgrade para liberar.');
}

module.exports = { verificarAssinatura, verificarModulo, MODULOS_POR_ROTA };
