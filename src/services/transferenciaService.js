/**
 * Transferências entre caixa e contas bancárias.
 * Uma transferência é um lançamento de saída na origem cuja conta contábil é a do destino;
 * a entrada no destino é criada automaticamente (bancoService/caixaService), então os saldos
 * das duas pontas sempre batem e a transferência aparece nos dois extratos.
 */
const { pool } = require('../config/db');
const bancoModel = require('../models/bancoModel');
const caixaModel = require('../models/caixaModel');
const bancoService = require('./bancoService');
const caixaService = require('./caixaService');
const lancamentoAuto = require('./lancamentoAutomaticoService');
const { createHttpError } = require('../utils/httpError');

async function criar(igrejaId, payload, userId) {
    if (payload.origem === payload.destino) throw createHttpError(400, 'A origem e o destino precisam ser diferentes.');
    const valor = Number(payload.valor);
    if (!(valor > 0)) throw createHttpError(400, 'Informe um valor maior que zero.');
    const origem = await lancamentoAuto.validarDestino(igrejaId, payload.origem, payload.data);
    const destino = await lancamentoAuto.validarDestino(igrejaId, payload.destino, payload.data);
    if (origem.tipo === 'banco' && origem.conta.tipo === 'cartao') {
        throw createHttpError(400, 'Cartão de crédito não pode ser a origem de uma transferência. Para pagar a fatura, escolha o cartão como destino.');
    }

    let contaDestino = bancoService.CONTA_CAIXA;
    if (destino.tipo === 'banco') contaDestino = await bancoService.garantirContaContabil(igrejaId, destino.conta, userId);
    if (origem.tipo === 'banco') await bancoService.garantirContaContabil(igrejaId, origem.conta, userId);

    const verbo = destino.tipo === 'banco' && destino.conta.tipo === 'cartao' ? 'Pagamento da fatura' : 'Transferência';
    const descricao = (payload.descricao && payload.descricao.trim()) || `${verbo}: ${origem.nome} → ${destino.nome}`;

    if (origem.tipo === 'banco') {
        const id = await bancoService.createLancamento(igrejaId, {
            contaId: origem.contaId, dataLancamento: payload.data, doc: payload.doc || null,
            descricao, tipo: 'saida', valor, contaContabil: contaDestino
        }, userId);
        return { fonte: 'banco', id, origem: origem.nome, destino: destino.nome };
    }
    const id = await caixaService.createLancamento(igrejaId, userId, {
        data: payload.data, doc: payload.doc || null, historico: descricao, valor, tipo: 'SAIDA', contaContabil: contaDestino
    });
    return { fonte: 'caixa', id, origem: origem.nome, destino: destino.nome };
}

const iso = (v) => bancoModel.isoData(v);

async function listar(igrejaId, { inicio, fim } = {}) {
    await bancoModel.ensureBancoTables();
    await caixaModel.ensure();
    const contas = await bancoModel.listContas(igrejaId);
    const nome = new Map(contas.map((c) => [Number(c.id), c.nome]));
    const tipoDaConta = new Map(contas.map((c) => [Number(c.id), c.tipo]));
    const ponta = (tipo, id) => (tipo === 'caixa'
        ? { tipo: 'caixa', id: null, nome: 'Caixa' }
        : { tipo: 'banco', id: Number(id), nome: nome.get(Number(id)) || 'Conta removida', tipoConta: tipoDaConta.get(Number(id)) || 'corrente' });

    const filtro = (col) => {
        const w = [];
        const p = [];
        if (inicio) { w.push(`${col} >= ?`); p.push(inicio); }
        if (fim) { w.push(`${col} < ?`); p.push(fim); }
        return { sql: w.length ? ` AND ${w.join(' AND ')}` : '', p };
    };

    const fb = filtro('L.data_lancamento');
    const [bancoBanco] = await pool.query(
        `SELECT L.id, L.data_lancamento AS data, L.descricao, L.valor, L.tipo, L.doc, L.conta_id, M.conta_id AS outra
         FROM banco_lancamentos L
         JOIN banco_lancamentos M ON M.igreja_id = L.igreja_id AND M.origem = 'transferencia' AND M.origem_id = L.id
         WHERE L.igreja_id = ? AND L.origem IS NULL${fb.sql}`,
        [igrejaId, ...fb.p]
    );
    const [bancoCaixa] = await pool.query(
        `SELECT L.id, L.data_lancamento AS data, L.descricao, L.valor, L.tipo, L.doc, L.conta_id
         FROM banco_lancamentos L
         JOIN caixa_lancamentos C ON C.igreja_id = L.igreja_id AND C.origem = 'banco' AND C.origem_id = L.id
         WHERE L.igreja_id = ? AND L.origem IS NULL${fb.sql}`,
        [igrejaId, ...fb.p]
    );
    const fc = filtro('C.data');
    const [caixaBanco] = await pool.query(
        `SELECT C.id, C.data, C.historico AS descricao, C.valor, C.tipo, C.doc, M.conta_id AS outra
         FROM caixa_lancamentos C
         JOIN banco_lancamentos M ON M.igreja_id = C.igreja_id AND M.origem = 'caixa' AND M.origem_id = C.id
         WHERE C.igreja_id = ? AND C.origem IS NULL${fc.sql}`,
        [igrejaId, ...fc.p]
    );

    const item = (fonte, r, eu, outro) => {
        const sai = String(r.tipo).toLowerCase() === 'saida';
        return {
            fonte, id: r.id, data: iso(r.data), descricao: r.descricao, valor: Number(r.valor), doc: r.doc || null,
            de: sai ? eu : outro, para: sai ? outro : eu
        };
    };
    const lista = [
        ...bancoBanco.map((r) => item('banco', r, ponta('banco', r.conta_id), ponta('banco', r.outra))),
        ...bancoCaixa.map((r) => item('banco', r, ponta('banco', r.conta_id), ponta('caixa'))),
        ...caixaBanco.map((r) => item('caixa', r, ponta('caixa'), ponta('banco', r.outra)))
    ];
    lista.sort((a, b) => String(b.data).localeCompare(String(a.data)) || b.id - a.id);
    return lista;
}

module.exports = { criar, listar };
