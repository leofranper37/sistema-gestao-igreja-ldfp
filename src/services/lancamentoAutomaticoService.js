/**
 * Lançamento automático no caixa ou numa conta bancária, ligado a outro registro
 * (conta a pagar paga, link de pagamento recebido...). Um único lugar para:
 *   - validar o destino (caixa iniciado e data na competência ativa; conta da igreja e data após a abertura)
 *   - criar/atualizar/remover o lançamento (origem + origem_id)
 *   - impedir alterar algo que já está num mês fechado do caixa
 */
const { pool } = require('../config/db');
const caixaModel = require('../models/caixaModel');
const bancoModel = require('../models/bancoModel');
const { createHttpError } = require('../utils/httpError');

// 'caixa' | 'banco:12' → { tipo, contaId }
function lerDestino(destino) {
    const s = String(destino || '').trim();
    if (s === 'caixa') return { tipo: 'caixa' };
    const m = s.match(/^banco:(\d+)$/);
    if (m) return { tipo: 'banco', contaId: Number(m[1]) };
    return null;
}

async function validarDestino(igrejaId, destino, data) {
    const d = lerDestino(destino);
    if (!d) throw createHttpError(400, 'Escolha de onde sai (ou para onde vai) o dinheiro: caixa ou uma conta bancária.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) throw createHttpError(400, 'Informe a data.');
    if (d.tipo === 'caixa') {
        const estado = await caixaModel.getEstado(igrejaId);
        if (!estado.configurado) throw createHttpError(409, 'O caixa ainda não foi iniciado. Informe o saldo inicial do caixa ou escolha uma conta bancária.');
        if (data < estado.inicio || data >= estado.fim) {
            throw createHttpError(400, `Para lançar no caixa, a data precisa estar na competência ativa (${estado.competenciaAtiva}).`);
        }
        return { ...d, nome: 'Caixa' };
    }
    const conta = await bancoModel.getConta(d.contaId, igrejaId);
    if (!conta) throw createHttpError(400, 'Conta bancária não encontrada.');
    if (Number(conta.ativo) === 0) throw createHttpError(400, `A conta "${conta.nome}" está desativada.`);
    const abertura = bancoModel.isoData(conta.saldo_data);
    if (abertura && data < abertura) {
        throw createHttpError(400, `A data é anterior ao saldo de abertura da conta "${conta.nome}" (${abertura.split('-').reverse().join('/')}).`);
    }
    return { ...d, nome: conta.nome, conta };
}

// Onde está hoje o lançamento desta origem (para saber se pode mexer)
async function localizar(igrejaId, origem, origemId) {
    const [cx] = await pool.query(
        'SELECT id, data FROM caixa_lancamentos WHERE igreja_id = ? AND origem = ? AND origem_id = ? LIMIT 1',
        [igrejaId, origem, origemId]
    );
    const [bc] = await pool.query(
        'SELECT id, conta_id FROM banco_lancamentos WHERE igreja_id = ? AND origem = ? AND origem_id = ? LIMIT 1',
        [igrejaId, origem, origemId]
    );
    return { caixa: cx[0] || null, banco: bc[0] || null };
}

async function exigirAlteravel(igrejaId, origem, origemId) {
    await caixaModel.ensure();
    await bancoModel.ensureBancoTables();
    const { caixa } = await localizar(igrejaId, origem, origemId);
    if (!caixa) return;
    const estado = await caixaModel.getEstado(igrejaId);
    const data = bancoModel.isoData(caixa.data);
    if (estado.configurado && data && data < estado.inicio) {
        throw createHttpError(409, `O lançamento no caixa é de uma competência já encerrada (a ativa é ${estado.competenciaAtiva}) e não pode mais ser alterado.`);
    }
}

/**
 * dados: { destino, data, historico, valor, tipo: 'entrada'|'saida', contaContabil, doc, centroCustoId, fornecedorId, userId }
 */
async function registrar(igrejaId, origem, origemId, dados) {
    await exigirAlteravel(igrejaId, origem, origemId);
    const destino = await validarDestino(igrejaId, dados.destino, dados.data);
    const entrada = dados.tipo === 'entrada';
    if (destino.tipo === 'caixa') {
        await bancoModel.sincronizarOrigem(igrejaId, origem, origemId, null);
        await caixaModel.sincronizarOrigem(igrejaId, origem, origemId, {
            data: dados.data,
            doc: dados.doc || null,
            historico: dados.historico,
            valor: Number(dados.valor),
            tipo: entrada ? 'ENTRADA' : 'SAIDA',
            contaContabil: dados.contaContabil || null,
            observacao: null,
            centroCustoId: dados.centroCustoId || null,
            fornecedorId: dados.fornecedorId || null,
            userId: dados.userId
        });
    } else {
        await caixaModel.sincronizarOrigem(igrejaId, origem, origemId, null);
        await bancoModel.sincronizarOrigem(igrejaId, origem, origemId, {
            contaId: destino.contaId,
            dataLancamento: dados.data,
            doc: dados.doc || null,
            descricao: dados.historico,
            tipo: entrada ? 'entrada' : 'saida',
            valor: Number(dados.valor),
            contaContabil: dados.contaContabil || null,
            centroCustoId: dados.centroCustoId || null,
            fornecedorId: dados.fornecedorId || null,
            userId: dados.userId
        });
    }
    return destino;
}

async function remover(igrejaId, origem, origemId) {
    await exigirAlteravel(igrejaId, origem, origemId);
    await caixaModel.sincronizarOrigem(igrejaId, origem, origemId, null);
    await bancoModel.sincronizarOrigem(igrejaId, origem, origemId, null);
}

// Opções de "de onde sai / para onde vai" para as telas
async function opcoesDestino(igrejaId) {
    const estado = await caixaModel.getEstado(igrejaId);
    const contas = await bancoModel.listContas(igrejaId);
    const out = [{
        valor: 'caixa',
        rotulo: 'Caixa',
        detalhe: estado.configurado ? `Competência ativa ${estado.competenciaAtiva}` : 'Caixa ainda não iniciado',
        disponivel: !!estado.configurado,
        inicio: estado.configurado ? estado.inicio : null,
        fim: estado.configurado ? estado.fim : null
    }];
    for (const c of contas.filter((x) => Number(x.ativo) !== 0)) {
        out.push({
            valor: `banco:${c.id}`,
            rotulo: c.nome,
            detalhe: c.tipo === 'cartao' ? `Cartão final ${c.final_cartao || '----'}` : [c.banco, c.agencia && `Ag. ${c.agencia}`].filter(Boolean).join(' · '),
            tipoConta: c.tipo,
            disponivel: true,
            inicio: bancoModel.isoData(c.saldo_data)
        });
    }
    return out;
}

module.exports = { lerDestino, validarDestino, localizar, exigirAlteravel, registrar, remover, opcoesDestino };
