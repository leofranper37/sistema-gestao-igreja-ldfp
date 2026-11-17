const caixaModel = require('../models/caixaModel');
const financeModel = require('../models/financeModel');
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

const TIPO_ROTULO = { dizimo: 'Dízimo', oferta: 'Oferta', missoes: 'Oferta Missionária', outros: 'Outras receitas' };

// Contas de despesa mais usadas por igrejas (sugestões; o usuário pode digitar outra)
const CONTAS_DESPESA = [
    ['3.01.01', 'Aluguel'],
    ['3.01.02', 'Água e esgoto'],
    ['3.01.03', 'Energia elétrica'],
    ['3.01.04', 'Telefone e internet'],
    ['3.01.05', 'Material de limpeza'],
    ['3.01.06', 'Material de escritório'],
    ['3.01.07', 'Manutenção e reparos'],
    ['3.02.01', 'Prebenda pastoral'],
    ['3.02.02', 'Salários e encargos'],
    ['3.03.01', 'Ação social / ajuda a necessitados'],
    ['3.03.02', 'Repasse missionário'],
    ['3.04.01', 'Eventos e congressos'],
    ['3.04.02', 'Transporte e combustível'],
    ['3.04.03', 'Alimentação'],
    ['3.05.01', 'Tarifas bancárias'],
    ['3.06.01', 'Repasse à sede / convenção'],
    ['3.09.99', 'Outras despesas']
];
const CONTAS_RECEITA_EXTRA = [
    ['4.02.01', 'Receitas de eventos'],
    ['4.02.02', 'Cantina e vendas'],
    ['4.09.99', 'Outras receitas']
];

function exigirConfigurado(estado) {
    if (!estado.configurado) {
        throw createHttpError(409, 'Informe o saldo inicial do caixa antes de fazer lançamentos.');
    }
}

function exigirNaCompetencia(estado, data) {
    if (!data || data < estado.inicio || data >= estado.fim) {
        throw createHttpError(400, `A data precisa estar dentro da competência ativa (${estado.competenciaAtiva}).`);
    }
}

async function getEstado(igrejaId) {
    return caixaModel.getEstado(igrejaId);
}

async function definirSaldoInicial(igrejaId, competencia, valor) {
    const [mm, aaaa] = competencia.split('/');
    const r = await caixaModel.definirSaldoInicial(igrejaId, `${aaaa}-${mm}`, valor);
    if (r.conflito) {
        throw createHttpError(409, `A competência do saldo inicial já foi definida (${caixaModel.paraCompetencia(r.conflito)}) e não pode ser alterada. Só o valor pode mudar.`);
    }
    return caixaModel.getEstado(igrejaId);
}

async function ativarProxima(igrejaId) {
    const estado = await caixaModel.getEstado(igrejaId);
    exigirConfigurado(estado);
    if (!estado.podeAtivar) {
        throw createHttpError(409, `Não é possível ativar ${estado.proximaCompetencia}: é uma competência futura.`);
    }
    await caixaModel.ativarProxima(igrejaId, estado.proxima);
    return caixaModel.getEstado(igrejaId);
}

function listLancamentos(igrejaId, filtros) {
    return caixaModel.listLancamentos(igrejaId, filtros);
}

function getLancamento(id, igrejaId) {
    return caixaModel.getLancamento(id, igrejaId);
}

function montar(payload) {
    return {
        data: payload.data,
        doc: payload.doc || null,
        historico: String(payload.historico).trim(),
        valor: Number(payload.valor),
        tipo: payload.tipo,
        contaContabil: payload.contaContabil ? String(payload.contaContabil).trim() : null,
        observacao: payload.observacao || null,
        centroCustoId: payload.centroCustoId || null,
        fornecedorId: payload.fornecedorId || null
    };
}

async function createLancamento(igrejaId, userId, payload) {
    const estado = await caixaModel.getEstado(igrejaId);
    exigirConfigurado(estado);
    exigirNaCompetencia(estado, payload.data);
    return caixaModel.createLancamento(igrejaId, userId, montar(payload));
}

async function updateLancamento(id, igrejaId, payload) {
    const atual = await caixaModel.getLancamento(id, igrejaId);
    if (!atual) throw createHttpError(404, 'Lançamento não encontrado.');
    if (atual.origem) throw createHttpError(409, 'Este lançamento veio de um dízimo. Altere pelo lançamento de dízimo.');
    const estado = await caixaModel.getEstado(igrejaId);
    exigirConfigurado(estado);
    if (atual.data && atual.data < estado.inicio) {
        throw createHttpError(409, `Este lançamento é de uma competência já encerrada (a ativa é ${estado.competenciaAtiva}).`);
    }
    exigirNaCompetencia(estado, payload.data);
    await caixaModel.updateLancamento(id, igrejaId, montar(payload));
}

async function deleteLancamento(id, igrejaId) {
    const atual = await caixaModel.getLancamento(id, igrejaId);
    if (!atual) return 0;
    if (atual.origem) throw createHttpError(409, 'Este lançamento veio de um dízimo. Exclua pelo lançamento de dízimo.');
    const estado = await caixaModel.getEstado(igrejaId);
    if (estado.configurado && atual.data && atual.data < estado.inicio) {
        throw createHttpError(409, `Este lançamento é de uma competência já encerrada (a ativa é ${estado.competenciaAtiva}).`);
    }
    return caixaModel.deleteLancamento(id, igrejaId);
}

// Sugestões para o campo "Conta Contábil": plano de contas da igreja (se houver),
// contas dos tipos de receita e contas de despesa comuns.
async function contasSugeridas(igrejaId) {
    const vistos = new Set();
    const out = [];
    const add = (codigo, nome, natureza) => {
        const rotulo = codigo ? `${codigo} - ${nome}` : nome;
        const k = rotulo.toLowerCase();
        if (vistos.has(k)) return;
        vistos.add(k);
        out.push({ rotulo, natureza });
    };

    try {
        const [plano] = await pool.query(
            'SELECT codigo, nome, natureza FROM contabilidade_plano_contas WHERE igreja_id = ? AND ativo = 1 ORDER BY codigo',
            [igrejaId]
        );
        plano.forEach((p) => {
            const n = String(p.natureza || '').toLowerCase();
            add(p.codigo, p.nome, /receita|credor/.test(n) || String(p.codigo).startsWith('4') ? 'receita' : 'despesa');
        });
    } catch (_) { /* módulo de contabilidade ainda não usado */ }

    const tipos = await financeModel.listTiposReceita({ igrejaId }).catch(() => []);
    tipos.forEach((t) => {
        const m = String(t.plano_conta || '').match(/^\s*([\d.]+)\s*-\s*(.+)$/);
        if (m) add(m[1], m[2].trim(), 'receita');
        else if (t.plano_conta) add('', t.plano_conta, 'receita');
    });
    CONTAS_RECEITA_EXTRA.forEach(([c, n]) => add(c, n, 'receita'));
    CONTAS_DESPESA.forEach(([c, n]) => add(c, n, 'despesa'));
    return out;
}

// Dízimo com destino "Caixa" vira uma entrada no caixa (e sai dele se o destino mudar ou for excluído)
async function sincronizarDizimo(igrejaId, dizimoId, userId) {
    const d = dizimoId ? await financeModel.getDizimoById(dizimoId, igrejaId) : null;
    if (!d || d.destino !== 'caixa') {
        await caixaModel.sincronizarOrigem(igrejaId, 'dizimo', dizimoId, null);
        return;
    }
    let conta = null;
    if (d.tipo_receita_id) {
        const t = await financeModel.findTipoReceitaById(d.tipo_receita_id, igrejaId).catch(() => null);
        conta = t ? t.plano_conta : null;
    }
    const dataRaw = d.data_lancamento || d.created_at;
    let data = null;
    if (dataRaw instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        data = `${dataRaw.getFullYear()}-${p(dataRaw.getMonth() + 1)}-${p(dataRaw.getDate())}`;
    } else if (dataRaw) {
        data = String(dataRaw).slice(0, 10);
    }
    await caixaModel.sincronizarOrigem(igrejaId, 'dizimo', dizimoId, {
        data,
        doc: null,
        historico: `${TIPO_ROTULO[d.tipo] || 'Receita'} - ${d.membro_nome}`,
        valor: Number(d.valor),
        tipo: 'ENTRADA',
        contaContabil: conta,
        observacao: null,
        userId
    });
}

module.exports = {
    getEstado,
    definirSaldoInicial,
    ativarProxima,
    listLancamentos,
    getLancamento,
    createLancamento,
    updateLancamento,
    deleteLancamento,
    contasSugeridas,
    sincronizarDizimo
};
