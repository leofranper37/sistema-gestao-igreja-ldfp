const bancoModel = require('../models/bancoModel');
const financeModel = require('../models/financeModel');
const contabilidadeModel = require('../models/contabilidadeModel');
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

// Conta contábil do caixa: escolhê-la num lançamento bancário = saque/depósito (move o caixa junto)
const CONTA_CAIXA = '1.01.01 - Caixa';
const PREFIXO_CONTABIL = { corrente: '1.01.02', aplicacao: '1.01.03', cartao: '2.01.05' };
const TIPO_ROTULO = { dizimo: 'Dízimo', oferta: 'Oferta', missoes: 'Oferta Missionária', outros: 'Outras receitas' };

const caixa = () => require('./caixaService'); // evita dependência circular

// ── Contas ──────────────────────────────────────────────────────────────────

async function listContas(igrejaId) {
    return bancoModel.listContas(igrejaId);
}

async function getConta(id, igrejaId) {
    return bancoModel.getConta(id, igrejaId);
}

// Lista com o saldo atual de cada conta (para a tela de contas e a escolha do banco)
async function listContasComSaldo(igrejaId) {
    const contas = await bancoModel.listContas(igrejaId);
    const out = [];
    for (const c of contas) {
        out.push({ ...c, saldo_data: bancoModel.isoData(c.saldo_data), saldo_atual: await bancoModel.getSaldoConta(c.id, igrejaId) });
    }
    return out;
}

// "Criar automaticamente": próximo código livre do grupo (ex.: 1.01.02.03) + registro no plano de contas
async function gerarContaContabil(igrejaId, tipo, nome, userId) {
    const prefixo = PREFIXO_CONTABIL[tipo] || PREFIXO_CONTABIL.corrente;
    const usados = new Set();
    (await bancoModel.listContasContabeis(igrejaId)).forEach((c) => {
        const m = String(c).match(/^\s*([\d.]+)/);
        if (m) usados.add(m[1]);
    });
    try {
        const [plano] = await pool.query('SELECT codigo FROM contabilidade_plano_contas WHERE igreja_id = ?', [igrejaId]);
        plano.forEach((p) => usados.add(String(p.codigo).trim()));
    } catch (_) { /* plano de contas ainda não criado */ }
    let n = 1;
    while (usados.has(`${prefixo}.${String(n).padStart(2, '0')}`)) n += 1;
    const codigo = `${prefixo}.${String(n).padStart(2, '0')}`;
    try {
        await contabilidadeModel.createPlanoConta({
            igrejaId, codigo, nome, natureza: tipo === 'cartao' ? 'passivo' : 'ativo', createdBy: userId
        });
    } catch (_) { /* o rótulo na conta bancária já basta */ }
    return `${codigo} - ${nome}`;
}

// Saldo de abertura com sinal: crédito (+), débito (−); fatura do cartão é dívida (−)
function saldoComSinal(payload) {
    const v = Number(payload.saldoInicial) || 0;
    if (payload.tipo === 'cartao') return -Math.abs(v);
    if (payload.saldoTipo === 'debito') return -Math.abs(v);
    if (payload.saldoTipo === 'credito') return Math.abs(v);
    return v;
}

async function validarContaContabilLivre(igrejaId, contaContabil, ignorarId) {
    if (!contaContabil) return;
    if (contaContabil === CONTA_CAIXA) throw createHttpError(400, 'Essa conta contábil é do caixa. Escolha outra ou deixe "Criar automaticamente".');
    const dona = await bancoModel.findContaPorContabil(igrejaId, contaContabil);
    if (dona && Number(dona.id) !== Number(ignorarId)) {
        throw createHttpError(409, `A conta contábil "${contaContabil}" já é usada pela conta "${dona.nome}".`);
    }
}

async function createConta(igrejaId, payload, userId) {
    const dados = { ...payload, saldoInicial: saldoComSinal(payload) };
    if (payload.saldoTipo !== undefined || payload.tipo === 'aplicacao' || payload.tipo === 'cartao') {
        // cadastro novo: conta contábil própria
        if (dados.contaContabil) await validarContaContabilLivre(igrejaId, dados.contaContabil, null);
        else dados.contaContabil = await gerarContaContabil(igrejaId, dados.tipo || 'corrente', dados.nome, userId);
    }
    return bancoModel.createConta({ igrejaId, ...dados, createdBy: userId });
}

async function updateConta(id, igrejaId, payload) {
    const atual = await bancoModel.getConta(id, igrejaId);
    if (!atual) return 0;
    const dados = { ...payload, saldoInicial: saldoComSinal(payload) };
    // Saldo de abertura faz parte de exercícios já encerrados na Contabilidade: não pode mudar
    const mudouSaldo = payload.saldoInicial !== undefined && Math.abs(Number(atual.saldo_inicial || 0) - Number(dados.saldoInicial || 0)) > 0.004;
    const mudouData = payload.saldoData !== undefined && bancoModel.isoData(atual.saldo_data) !== (payload.saldoData || null);
    if (mudouSaldo || mudouData) {
        const fechado = await require('../models/exercicioContabilModel').ultimoFechado(igrejaId);
        if (fechado) {
            throw createHttpError(409, `O exercício de ${fechado} já foi encerrado na Contabilidade: o saldo de abertura desta conta não pode mais ser alterado.`);
        }
    }
    if (dados.contaContabil !== undefined) {
        if (!dados.contaContabil) dados.contaContabil = atual.conta_contabil || await gerarContaContabil(igrejaId, dados.tipo || atual.tipo, dados.nome, null);
        else await validarContaContabilLivre(igrejaId, dados.contaContabil, id);
    }
    return bancoModel.updateConta(id, igrejaId, dados);
}

// Contas antigas (cadastradas antes do plano de contas automático) ganham a conta contábil na hora em que precisam
async function garantirContaContabil(igrejaId, conta, userId) {
    if (conta.conta_contabil) return conta.conta_contabil;
    const tipo = PREFIXO_CONTABIL[conta.tipo] ? conta.tipo : (conta.tipo === 'poupanca' || conta.tipo === 'investimento' ? 'aplicacao' : 'corrente');
    const rotulo = await gerarContaContabil(igrejaId, tipo, conta.nome, userId);
    await pool.query('UPDATE banco_contas SET conta_contabil = ? WHERE id = ? AND igreja_id = ?', [rotulo, conta.id, igrejaId]);
    conta.conta_contabil = rotulo;
    return rotulo;
}

async function deleteConta(id, igrejaId) {
    const atual = await bancoModel.getConta(id, igrejaId);
    if (!atual) return 0;
    const uso = await bancoModel.contarUsoConta(id, igrejaId);
    if (uso > 0) {
        throw createHttpError(409, `Esta conta tem ${uso} lançamento(s) e não pode ser excluída. Desative-a na edição para que não apareça mais nas listas.`);
    }
    return bancoModel.deleteConta(id, igrejaId);
}

// ── Lançamentos ─────────────────────────────────────────────────────────────

async function listLancamentos(contaId, igrejaId) {
    return bancoModel.listLancamentos(contaId, igrejaId);
}

async function getSaldoConta(contaId, igrejaId) {
    return bancoModel.getSaldoConta(contaId, igrejaId);
}

function listLancamentosPaginado(contaId, igrejaId, filtros) {
    return bancoModel.listLancamentosPaginado(contaId, igrejaId, filtros);
}

async function resumoMes(contaId, igrejaId, mes) {
    return bancoModel.resumoMes(contaId, igrejaId, mes);
}

function getLancamento(id, igrejaId) {
    return bancoModel.getLancamento(id, igrejaId);
}

const ORIGEM_MSG = {
    dizimo: 'Este lançamento veio de um dízimo. Altere pelo lançamento de dízimo.',
    transferencia: 'Este lançamento é a outra ponta de uma transferência. Altere pelo lançamento de origem.',
    caixa: 'Este lançamento veio do caixa. Altere pelo lançamento de caixa.',
    conta_pagar: 'Este lançamento é o pagamento de uma conta a pagar. Para desfazer, estorne o pagamento em Contas a Pagar.',
    link_pagamento: 'Este lançamento é o recebimento de um link de pagamento. Altere pela tela de Links de Pagamento.'
};

function exigirManual(l) {
    if (l.origem) throw createHttpError(409, ORIGEM_MSG[l.origem] || 'Este lançamento foi gerado automaticamente.');
}

function exigirDataValida(conta, data) {
    const abertura = bancoModel.isoData(conta.saldo_data);
    if (abertura && data < abertura) {
        throw createHttpError(400, `A data não pode ser anterior ao saldo de abertura da conta (${abertura.split('-').reverse().join('/')}).`);
    }
}

// Descobre a "outra ponta": outra conta bancária ou o caixa, pela conta contábil escolhida
async function contraparte(igrejaId, contaId, contaContabil) {
    if (!contaContabil) return null;
    if (contaContabil.trim() === CONTA_CAIXA) return { tipo: 'caixa' };
    const outra = await bancoModel.findContaPorContabil(igrejaId, contaContabil);
    if (outra && Number(outra.id) !== Number(contaId)) return { tipo: 'banco', conta: outra };
    return null;
}

// Cria/atualiza/remove o espelho do lançamento na outra ponta (tipo invertido)
async function sincronizarEspelho(igrejaId, lancId, userId) {
    const l = lancId ? await bancoModel.getLancamento(lancId, igrejaId) : null;
    const contaOrigem = l ? await bancoModel.getConta(l.conta_id, igrejaId) : null;
    const ponta = l && !l.origem ? await contraparte(igrejaId, l.conta_id, l.conta_contabil) : null;

    // espelho em outra conta bancária
    if (ponta && ponta.tipo === 'banco') {
        await bancoModel.sincronizarOrigem(igrejaId, 'transferencia', lancId, {
            contaId: ponta.conta.id,
            dataLancamento: l.data_lancamento,
            doc: l.doc,
            descricao: l.descricao,
            tipo: l.tipo === 'entrada' ? 'saida' : 'entrada',
            valor: l.valor,
            contaContabil: contaOrigem ? contaOrigem.conta_contabil : null,
            userId
        });
    } else {
        await bancoModel.sincronizarOrigem(igrejaId, 'transferencia', lancId, null);
    }

    // espelho no caixa (saque / depósito)
    if (ponta && ponta.tipo === 'caixa') {
        await caixa().espelharDoBanco(igrejaId, lancId, {
            data: l.data_lancamento,
            doc: l.doc,
            historico: l.descricao,
            valor: l.valor,
            tipo: l.tipo === 'entrada' ? 'SAIDA' : 'ENTRADA',
            contaContabil: contaOrigem ? contaOrigem.conta_contabil : null,
            userId
        });
    } else {
        await caixa().espelharDoBanco(igrejaId, lancId, null);
    }
}

async function prepararLancamento(igrejaId, contaId, payload) {
    const conta = await bancoModel.getConta(contaId, igrejaId);
    if (!conta) throw createHttpError(404, 'Conta não encontrada.');
    exigirDataValida(conta, payload.dataLancamento);
    const ponta = await contraparte(igrejaId, contaId, payload.contaContabil);
    if (ponta && ponta.tipo === 'caixa') await caixa().validarDataEspelho(igrejaId, payload.dataLancamento);
    return {
        contaId: Number(contaId),
        dataLancamento: payload.dataLancamento,
        doc: payload.doc || null,
        descricao: String(payload.descricao).trim(),
        tipo: payload.tipo,
        valor: Number(payload.valor),
        contaContabil: payload.contaContabil ? String(payload.contaContabil).trim() : null,
        observacao: payload.observacao || null,
        centroCustoId: payload.centroCustoId || null,
        fornecedorId: payload.fornecedorId || null
    };
}

async function createLancamento(igrejaId, payload, userId) {
    const dados = await prepararLancamento(igrejaId, payload.contaId, payload);
    const id = await bancoModel.inserirLancamento(igrejaId, userId, dados);
    await sincronizarEspelho(igrejaId, id, userId);
    return id;
}

async function updateLancamento(id, igrejaId, payload) {
    const atual = await bancoModel.getLancamento(id, igrejaId);
    if (!atual) throw createHttpError(404, 'Lançamento não encontrado.');
    exigirManual(atual);
    await caixa().exigirEspelhoAberto(igrejaId, id);
    const dados = await prepararLancamento(igrejaId, atual.conta_id, payload);
    await bancoModel.atualizarLancamento(id, igrejaId, dados);
    await sincronizarEspelho(igrejaId, id, null);
}

async function deleteLancamento(id, igrejaId) {
    const atual = await bancoModel.getLancamento(id, igrejaId);
    if (!atual) return 0;
    exigirManual(atual);
    await caixa().exigirEspelhoAberto(igrejaId, id);
    const n = await bancoModel.deleteLancamento(id, igrejaId);
    await sincronizarEspelho(igrejaId, id, null);
    return n;
}

// Sugestões de conta contábil para o lançamento bancário (inclui as transferências possíveis)
async function contasSugeridas(igrejaId, contaId) {
    const base = await caixa().contasSugeridas(igrejaId, { incluirBancos: false });
    const contas = await bancoModel.listContas(igrejaId);
    const transferencias = [{ rotulo: CONTA_CAIXA, natureza: 'transferencia', detalhe: 'Saque / depósito no caixa' }];
    contas
        .filter((c) => c.conta_contabil && Number(c.id) !== Number(contaId) && Number(c.ativo) !== 0)
        .forEach((c) => transferencias.push({
            rotulo: c.conta_contabil,
            natureza: 'transferencia',
            detalhe: c.tipo === 'cartao' ? `Pagamento da fatura: ${c.nome}` : `Transferência: ${c.nome}`
        }));
    // contas bancárias também estão no plano de contas: não repetir (nem sugerir a própria)
    const jaTem = new Set([CONTA_CAIXA, ...contas.map((c) => c.conta_contabil).filter(Boolean)].map((r) => r.toLowerCase()));
    return [...transferencias, ...base.filter((b) => !jaTem.has(String(b.rotulo).toLowerCase()))];
}

// Dízimo com destino "banco:N" vira entrada na conta N
async function sincronizarDizimo(igrejaId, dizimoId, userId) {
    const d = dizimoId ? await financeModel.getDizimoById(dizimoId, igrejaId) : null;
    if (!d || d.destino !== 'banco' || !d.destino_banco_id) {
        await bancoModel.sincronizarOrigem(igrejaId, 'dizimo', dizimoId, null);
        return;
    }
    let conta = null;
    if (d.tipo_receita_id) {
        const t = await financeModel.findTipoReceitaById(d.tipo_receita_id, igrejaId).catch(() => null);
        conta = t ? t.plano_conta : null;
    }
    await bancoModel.sincronizarOrigem(igrejaId, 'dizimo', dizimoId, {
        contaId: d.destino_banco_id,
        dataLancamento: bancoModel.isoData(d.data_lancamento || d.created_at),
        doc: null,
        descricao: `${TIPO_ROTULO[d.tipo] || 'Receita'} - ${d.membro_nome}`,
        tipo: 'entrada',
        valor: Number(d.valor),
        contaContabil: conta,
        userId
    });
}

module.exports = {
    CONTA_CAIXA,
    garantirContaContabil,
    listContas,
    listContasComSaldo,
    getConta,
    createConta,
    updateConta,
    deleteConta,
    listLancamentos,
    listLancamentosPaginado,
    resumoMes,
    getLancamento,
    createLancamento,
    updateLancamento,
    deleteLancamento,
    getSaldoConta,
    contasSugeridas,
    sincronizarDizimo
};
