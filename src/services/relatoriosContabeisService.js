'use strict';

/**
 * Relatórios contábeis (Lote 4) — somente leitura.
 *
 * Os lançamentos (contabilidade_lancamentos) guardam conta_debito/conta_credito
 * como TEXTO LIVRE. Aqui o texto é casado com o plano de contas:
 *   1) pelo código no início do texto ("1.1.01 - Caixa" → código 1.1.01)
 *   2) pelo nome exato da conta (sem diferenciar maiúsculas)
 * O que não casar vira "conta não cadastrada" e aparece no diagnóstico.
 *
 * Convenções de sinal:
 *   saldo devedor = débitos − créditos
 *   Ativo/Despesa: natureza devedora | Passivo/PL/Receita: natureza credora
 */

const { pool } = require('../config/db');
const relatorios = require('./relatoriosService');

const { toISODate } = relatorios._internals;

async function safeQuery(sql, params = []) {
    try {
        const [rows] = await pool.query(sql, params);
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        if (/doesn't exist|no such table|does not exist|Unknown column|no such column/i.test(String(err && err.message))) return [];
        throw err;
    }
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

function cmpCodigo(a, b) {
    const pa = String(a || '').split('.');
    const pb = String(b || '').split('.');
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        if (pa[i] === undefined) return -1;
        if (pb[i] === undefined) return 1;
        const na = Number(pa[i]);
        const nb = Number(pb[i]);
        if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
        if (pa[i] !== pb[i]) return pa[i].localeCompare(pb[i]);
    }
    return 0;
}

const RE_CODIGO = /^\s*(\d+(?:\.\d+)*)/;
const RE_PL = /patrim[oô]nio|super[aá]vit|d[eé]ficit|resultados?\s+acumulad|reserva/i;
const RE_DISPONIVEL = /caixa|banco|disponib|aplica[cç][aã]o\s+financeira|conta\s+corrente|poupan[cç]a/i;

function inferirNatureza(codigo) {
    const d = String(codigo || '').charAt(0);
    return { 1: 'ativo', 2: 'passivo', 3: 'despesa', 4: 'receita' }[d] || null;
}

const devedora = (nat) => nat === 'ativo' || nat === 'despesa';

// ─── Base: plano, lançamentos, abertura ─────────────────────────────────────

async function carregarBase(igrejaId) {
    const [plano, lancs, abertura] = await Promise.all([
        safeQuery('SELECT id, codigo, nome, natureza, ativo FROM contabilidade_plano_contas WHERE igreja_id = ?', [igrejaId]),
        safeQuery('SELECT id, data_lancamento, historico, conta_debito, conta_credito, valor, created_at FROM contabilidade_lancamentos WHERE igreja_id = ?', [igrejaId]),
        safeQuery('SELECT id, conta, debito, credito FROM contabilidade_balancete_abertura WHERE igreja_id = ?', [igrejaId])
    ]);

    const contas = new Map(); // key → conta
    const porCodigo = new Map();
    const porNome = new Map();
    plano
        .slice()
        .sort((a, b) => num(b.ativo) - num(a.ativo)) // ativas têm prioridade em códigos repetidos
        .forEach((p) => {
            const codigo = String(p.codigo || '').trim();
            const key = `p:${codigo}`;
            if (contas.has(key)) return;
            const c = { key, codigo, nome: String(p.nome || '').trim(), natureza: String(p.natureza || '').toLowerCase() || inferirNatureza(codigo), plano: true };
            contas.set(key, c);
            porCodigo.set(codigo, c);
            if (!porNome.has(c.nome.toLowerCase())) porNome.set(c.nome.toLowerCase(), c);
        });

    // PL / disponível: pelo nome da própria conta ou de alguma conta-mãe
    const ancestrais = (codigo) => {
        const partes = codigo.split('.');
        const lista = [];
        for (let i = partes.length; i >= 1; i -= 1) {
            const c = porCodigo.get(partes.slice(0, i).join('.'));
            if (c) lista.push(c);
        }
        return lista;
    };
    const marcar = (c) => {
        const linhagem = c.plano ? ancestrais(c.codigo) : [c];
        c.pl = c.natureza === 'passivo' && linhagem.some((a) => RE_PL.test(a.nome));
        c.disponivel = c.natureza === 'ativo' && (c.codigo.startsWith('1.1.1') || linhagem.some((a) => RE_DISPONIVEL.test(a.nome)));
    };
    contas.forEach(marcar);

    const naoCadastradas = new Map();
    function resolver(texto) {
        const t = String(texto || '').trim();
        const m = t.match(RE_CODIGO);
        if (m && porCodigo.has(m[1])) return porCodigo.get(m[1]);
        const lower = t.toLowerCase();
        if (porNome.has(lower)) return porNome.get(lower);
        const semCodigo = lower.replace(RE_CODIGO, '').replace(/^\s*[-–—:]\s*/, '').trim();
        if (semCodigo && porNome.has(semCodigo)) return porNome.get(semCodigo);
        const key = `x:${lower}`;
        if (!contas.has(key)) {
            const codigo = m ? m[1] : '';
            const c = { key, codigo, nome: t || '(sem conta)', natureza: inferirNatureza(codigo), plano: false };
            marcar(c);
            contas.set(key, c);
            naoCadastradas.set(key, { conta: c, usos: 0 });
        }
        naoCadastradas.get(key).usos += 1;
        return contas.get(key);
    }

    // Partidas: cada lançamento gera um débito e um crédito
    const lancamentos = lancs
        .map((l) => ({
            id: l.id, data: toISODate(l.data_lancamento), historico: l.historico || '', valor: r2(l.valor),
            debito: resolver(l.conta_debito), credito: resolver(l.conta_credito),
            criado: l.created_at ? new Date(l.created_at).getTime() || 0 : 0
        }))
        .filter((l) => l.data)
        .sort((a, b) => a.data.localeCompare(b.data) || a.criado - b.criado || String(a.id).localeCompare(String(b.id)));

    const partidas = [];
    for (const l of lancamentos) {
        partidas.push({ data: l.data, conta: l.debito, d: l.valor, c: 0, lanc: l, contra: l.credito });
        partidas.push({ data: l.data, conta: l.credito, d: 0, c: l.valor, lanc: l, contra: l.debito });
    }
    // Saldos de abertura: data null = antes de qualquer lançamento
    let aberturaD = 0;
    let aberturaC = 0;
    for (const a of abertura) {
        const conta = resolver(a.conta);
        const d = r2(a.debito);
        const c = r2(a.credito);
        aberturaD += d;
        aberturaC += c;
        partidas.push({ data: null, conta, d, c, lanc: null, contra: null, abertura: true });
    }

    const diagnostico = {
        lancamentos: lancamentos.length,
        contasPlano: porCodigo.size,
        naoCadastradas: [...naoCadastradas.values()]
            .map((x) => ({ nome: x.conta.nome, naturezaInferida: x.conta.natureza, usos: x.usos }))
            .sort((a, b) => b.usos - a.usos),
        semNatureza: [...contas.values()].filter((c) => !c.natureza).map((c) => c.nome),
        aberturaDebito: r2(aberturaD),
        aberturaCredito: r2(aberturaC),
        aberturaDiferenca: r2(aberturaD - aberturaC)
    };

    return { contas, lancamentos, partidas, diagnostico };
}

/** Soma débitos/créditos por conta, das partidas que passam no filtro. */
function somar(partidas, filtro) {
    const m = new Map();
    for (const p of partidas) {
        if (!filtro(p)) continue;
        const s = m.get(p.conta.key) || { d: 0, c: 0 };
        s.d += p.d;
        s.c += p.c;
        m.set(p.conta.key, s);
    }
    return m;
}
const antesDe = (ini) => (p) => p.data === null || (ini && p.data < ini);
const entre = (ini, fim) => (p) => p.data !== null && (!ini || p.data >= ini) && (!fim || p.data <= fim);
const ate = (fim) => (p) => p.data === null || !fim || p.data <= fim;

/**
 * Monta árvore hierárquica a partir dos códigos do plano.
 * valores: Map key → number[] (vetor de colunas)
 * Retorna linhas { codigo, nome, nivel, sintetica, valores[] } para contas com movimento.
 */
function arvore(contasAlvo, valores, ncol, { zeradas = false } = {}) {
    const lista = contasAlvo.slice().sort((a, b) => (a.plano === b.plano ? 0 : a.plano ? -1 : 1) || cmpCodigo(a.codigo, b.codigo) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const doPlano = lista.filter((c) => c.plano);
    const linhas = [];
    for (const c of lista) {
        let vet;
        let sintetica = false;
        if (c.plano) {
            vet = Array(ncol).fill(0);
            for (const o of doPlano) {
                if (o.codigo === c.codigo || o.codigo.startsWith(`${c.codigo}.`)) {
                    if (o.codigo !== c.codigo) sintetica = true;
                    const v = valores.get(o.key);
                    if (v) v.forEach((x, i) => { vet[i] += x; });
                }
            }
            // não cadastradas cujo código começa com o desta conta (ex.: "1.1.01.9 - Caixa extra")
            for (const o of lista) {
                if (!o.plano && o.codigo && o.codigo.startsWith(`${c.codigo}.`)) {
                    const v = valores.get(o.key);
                    if (v) v.forEach((x, i) => { vet[i] += x; });
                }
            }
        } else {
            vet = (valores.get(c.key) || Array(ncol).fill(0)).slice();
        }
        vet = vet.map(r2);
        if (!zeradas && vet.every((x) => x === 0)) continue;
        linhas.push({
            key: c.key, codigo: c.codigo, nome: c.nome, natureza: c.natureza,
            nivel: c.plano ? Math.max(0, c.codigo.split('.').length - 1) : 0,
            sintetica, naoCadastrada: !c.plano, valores: vet
        });
    }
    return linhas;
}

/** Soma só as contas "folha" (evita contar 2x conta-mãe + filhas) — total de uma seção. */
function totalSecao(contasAlvo, valores, ncol) {
    const tot = Array(ncol).fill(0);
    for (const c of contasAlvo) {
        const v = valores.get(c.key);
        if (v) v.forEach((x, i) => { tot[i] += x; });
    }
    return tot.map(r2);
}

const rotulo = (c) => (c.codigo && c.plano ? `${c.codigo} - ${c.nome}` : c.nome);

// ─── Relatórios ─────────────────────────────────────────────────────────────

async function contasDisponiveis(igrejaId) {
    const base = await carregarBase(igrejaId);
    const usadas = new Set(base.partidas.map((p) => p.conta.key));
    const contas = [...base.contas.values()]
        .sort((a, b) => (a.plano === b.plano ? 0 : a.plano ? -1 : 1) || cmpCodigo(a.codigo, b.codigo))
        .map((c) => ({ key: c.key, rotulo: rotulo(c), natureza: c.natureza, plano: c.plano, comMovimento: usadas.has(c.key) }));
    return { contas, diagnostico: base.diagnostico };
}

async function diario(igrejaId, { inicio, fim } = {}) {
    const base = await carregarBase(igrejaId);
    const rows = base.lancamentos
        .filter((l) => (!inicio || l.data >= inicio) && (!fim || l.data <= fim))
        .map((l, i) => ({ n: i + 1, data: l.data, historico: l.historico, debito: rotulo(l.debito), credito: rotulo(l.credito), valor: l.valor }));
    return { rows, total: r2(rows.reduce((s, r) => s + r.valor, 0)), diagnostico: base.diagnostico };
}

async function razao(igrejaId, { inicio, fim, conta } = {}) {
    const base = await carregarBase(igrejaId);
    const anteriores = somar(base.partidas, antesDe(inicio));
    const alvos = conta
        ? [base.contas.get(conta)].filter(Boolean)
        : [...new Set(base.partidas.filter(entre(inicio, fim)).map((p) => p.conta))];
    alvos.sort((a, b) => (a.plano === b.plano ? 0 : a.plano ? -1 : 1) || cmpCodigo(a.codigo, b.codigo));

    const resultado = alvos.map((c) => {
        const ant = anteriores.get(c.key) || { d: 0, c: 0 };
        let saldo = r2(ant.d - ant.c); // devedor positivo
        const movs = base.partidas
            .filter((p) => p.conta.key === c.key && entre(inicio, fim)(p))
            .map((p) => {
                saldo = r2(saldo + p.d - p.c);
                return { data: p.data, historico: p.lanc ? p.lanc.historico : 'Saldo de abertura', contrapartida: p.contra ? rotulo(p.contra) : '', debito: p.d, credito: p.c, saldo };
            });
        const totD = r2(movs.reduce((s, m) => s + m.debito, 0));
        const totC = r2(movs.reduce((s, m) => s + m.credito, 0));
        return { key: c.key, conta: rotulo(c), natureza: c.natureza, naoCadastrada: !c.plano, saldoAnterior: r2(ant.d - ant.c), movimentos: movs, debitos: totD, creditos: totC, saldoFinal: saldo };
    });
    return { contas: resultado, diagnostico: base.diagnostico };
}

async function balancete(igrejaId, { inicio, fim, zeradas } = {}) {
    const base = await carregarBase(igrejaId);
    const ant = somar(base.partidas, antesDe(inicio));
    const per = somar(base.partidas, entre(inicio, fim));
    const valores = new Map();
    for (const c of base.contas.values()) {
        const a = ant.get(c.key) || { d: 0, c: 0 };
        const p = per.get(c.key) || { d: 0, c: 0 };
        const sa = a.d - a.c;
        valores.set(c.key, [sa, p.d, p.c, sa + p.d - p.c]);
    }
    const todas = [...base.contas.values()];
    const linhas = arvore(todas, valores, 4, { zeradas: zeradas === true || zeradas === 'true' });
    const tot = totalSecao(todas, valores, 4);
    return {
        linhas,
        totais: { saldoAnterior: tot[0], debitos: tot[1], creditos: tot[2], saldoAtual: tot[3] },
        fechado: Math.abs(tot[1] - tot[2]) < 0.005 && Math.abs(tot[3]) < 0.005,
        diagnostico: base.diagnostico
    };
}

/** Saldo natural (positivo no lado normal da conta) até uma data / num período. */
function saldosNaturais(base, filtro) {
    const s = somar(base.partidas, filtro);
    const m = new Map();
    for (const c of base.contas.values()) {
        const v = s.get(c.key);
        if (!v) continue;
        m.set(c.key, [devedora(c.natureza) ? v.d - v.c : v.c - v.d]);
    }
    return m;
}

function resultado(base, filtro) {
    const s = somar(base.partidas, filtro);
    let rec = 0;
    let desp = 0;
    for (const c of base.contas.values()) {
        const v = s.get(c.key);
        if (!v) continue;
        if (c.natureza === 'receita') rec += v.c - v.d;
        else if (c.natureza === 'despesa') desp += v.d - v.c;
    }
    return { receitas: r2(rec), despesas: r2(desp), resultado: r2(rec - desp) };
}

async function balanco(igrejaId, { data } = {}) {
    const base = await carregarBase(igrejaId);
    const dt = data || toISODate(new Date());
    const inicioAno = `${dt.slice(0, 4)}-01-01`;
    const vals = saldosNaturais(base, ate(dt));
    const todas = [...base.contas.values()];
    const ativo = todas.filter((c) => c.natureza === 'ativo');
    const passivo = todas.filter((c) => c.natureza === 'passivo' && !c.pl);
    const pl = todas.filter((c) => c.natureza === 'passivo' && c.pl);

    const resAnteriores = resultado(base, antesDe(inicioAno)).resultado;
    const resExercicio = resultado(base, entre(inicioAno, dt)).resultado;

    const totAtivo = totalSecao(ativo, vals, 1)[0];
    const totPassivo = totalSecao(passivo, vals, 1)[0];
    const totPLContas = totalSecao(pl, vals, 1)[0];
    const totPL = r2(totPLContas + resAnteriores + resExercicio);
    return {
        data: dt,
        ativo: { linhas: arvore(ativo, vals, 1), total: totAtivo },
        passivo: { linhas: arvore(passivo, vals, 1), total: totPassivo },
        patrimonio: {
            linhas: arvore(pl, vals, 1),
            resultadosAnteriores: resAnteriores,
            resultadoExercicio: resExercicio,
            total: totPL
        },
        totalPassivoPL: r2(totPassivo + totPL),
        diferenca: r2(totAtivo - (totPassivo + totPL)),
        diagnostico: base.diagnostico
    };
}

async function dre(igrejaId, { inicio, fim } = {}) {
    const base = await carregarBase(igrejaId);
    const vals = saldosNaturais(base, entre(inicio, fim));
    const todas = [...base.contas.values()];
    const rec = todas.filter((c) => c.natureza === 'receita');
    const desp = todas.filter((c) => c.natureza === 'despesa');
    const totRec = totalSecao(rec, vals, 1)[0];
    const totDesp = totalSecao(desp, vals, 1)[0];
    return {
        receitas: { linhas: arvore(rec, vals, 1), total: totRec },
        despesas: { linhas: arvore(desp, vals, 1), total: totDesp },
        resultado: r2(totRec - totDesp),
        diagnostico: base.diagnostico
    };
}

/** DRE mês a mês (Resumo Financeiro Anual). */
async function dreMensal(igrejaId, { ano } = {}) {
    const y = Number(ano) || new Date().getFullYear();
    const base = await carregarBase(igrejaId);
    const vals = new Map();
    for (const p of base.partidas) {
        if (!p.data || Number(p.data.slice(0, 4)) !== y) continue;
        const c = p.conta;
        if (c.natureza !== 'receita' && c.natureza !== 'despesa') continue;
        const mes = Number(p.data.slice(5, 7)) - 1;
        const v = vals.get(c.key) || Array(13).fill(0);
        const valor = c.natureza === 'despesa' ? p.d - p.c : p.c - p.d;
        v[mes] += valor;
        v[12] += valor;
        vals.set(c.key, v);
    }
    const todas = [...base.contas.values()];
    const rec = todas.filter((c) => c.natureza === 'receita');
    const desp = todas.filter((c) => c.natureza === 'despesa');
    const totRec = totalSecao(rec, vals, 13);
    const totDesp = totalSecao(desp, vals, 13);
    return {
        ano: y,
        receitas: { linhas: arvore(rec, vals, 13), total: totRec },
        despesas: { linhas: arvore(desp, vals, 13), total: totDesp },
        resultado: totRec.map((v, i) => r2(v - totDesp[i])),
        diagnostico: base.diagnostico
    };
}

/** Fluxo de caixa — método direto, a partir dos lançamentos contábeis. */
async function fluxoContabil(igrejaId, { inicio, fim } = {}) {
    const base = await carregarBase(igrejaId);
    const disp = [...base.contas.values()].filter((c) => c.disponivel);
    const ehCaixa = (c) => c && c.disponivel;
    const saldoEm = (filtro) => {
        const s = somar(base.partidas, filtro);
        return r2(disp.reduce((t, c) => { const v = s.get(c.key); return t + (v ? v.d - v.c : 0); }, 0));
    };
    const saldoInicial = saldoEm(antesDe(inicio));

    const categoria = (c) => {
        if (c.natureza === 'receita' || c.natureza === 'despesa') return 'operacional';
        if (c.natureza === 'ativo') return c.codigo && !c.codigo.startsWith('1.1') ? 'investimento' : 'operacional';
        if (c.natureza === 'passivo') return c.pl || (c.codigo && !c.codigo.startsWith('2.1')) ? 'financiamento' : 'operacional';
        return 'operacional';
    };
    const grupos = { operacional: new Map(), investimento: new Map(), financiamento: new Map() };
    for (const l of base.lancamentos) {
        if ((inicio && l.data < inicio) || (fim && l.data > fim)) continue;
        const dCaixa = ehCaixa(l.debito);
        const cCaixa = ehCaixa(l.credito);
        if (dCaixa === cCaixa) continue; // transferência entre caixas ou lançamento sem caixa
        const contra = dCaixa ? l.credito : l.debito;
        const valor = dCaixa ? l.valor : -l.valor;
        const g = grupos[categoria(contra)];
        const k = contra.key;
        const item = g.get(k) || { conta: rotulo(contra), entradas: 0, saidas: 0 };
        if (valor > 0) item.entradas += valor; else item.saidas += -valor;
        g.set(k, item);
    }
    const secoes = Object.entries(grupos).map(([nome, m]) => {
        const linhas = [...m.values()].map((x) => ({ ...x, entradas: r2(x.entradas), saidas: r2(x.saidas), liquido: r2(x.entradas - x.saidas) }))
            .sort((a, b) => Math.abs(b.liquido) - Math.abs(a.liquido));
        return { nome, linhas, entradas: r2(linhas.reduce((s, x) => s + x.entradas, 0)), saidas: r2(linhas.reduce((s, x) => s + x.saidas, 0)), liquido: r2(linhas.reduce((s, x) => s + x.liquido, 0)) };
    });
    const variacao = r2(secoes.reduce((s, x) => s + x.liquido, 0));
    return {
        fonte: 'contabil',
        contasCaixa: disp.map(rotulo),
        saldoInicial,
        secoes,
        variacao,
        saldoFinal: r2(saldoInicial + variacao),
        diagnostico: base.diagnostico
    };
}

/** Fluxo de caixa mensal a partir da Tesouraria (caixa + bancos) — para igrejas sem contabilidade. */
async function fluxoTesouraria(igrejaId, { inicio, fim } = {}) {
    const [caixa, banco] = await Promise.all([
        relatorios.tesourariaMovimento(igrejaId, { inicio, fim, fonte: 'caixa' }),
        relatorios.tesourariaMovimento(igrejaId, { inicio, fim, fonte: 'banco' })
    ]);
    const saldoInicial = r2(caixa.saldoAnterior + banco.saldoAnterior);
    const meses = new Map();
    for (const r of [...caixa.rows, ...banco.rows]) {
        if (!r.data) continue;
        const k = r.data.slice(0, 7);
        const m = meses.get(k) || { mes: k, entradas: 0, saidas: 0 };
        m.entradas += r.entrada;
        m.saidas += r.saida;
        meses.set(k, m);
    }
    let saldo = saldoInicial;
    const linhas = [...meses.values()].sort((a, b) => a.mes.localeCompare(b.mes)).map((m) => {
        const inicial = saldo;
        saldo = r2(saldo + m.entradas - m.saidas);
        return { mes: m.mes, saldoInicial: r2(inicial), entradas: r2(m.entradas), saidas: r2(m.saidas), liquido: r2(m.entradas - m.saidas), saldoFinal: saldo };
    });
    return {
        fonte: 'tesouraria', inicio: caixa.inicio, fim: caixa.fim, saldoInicial, linhas,
        entradas: r2(linhas.reduce((s, x) => s + x.entradas, 0)),
        saidas: r2(linhas.reduce((s, x) => s + x.saidas, 0)),
        saldoFinal: saldo
    };
}

/** DMPL — mutações do patrimônio social no ano. */
async function dmpl(igrejaId, { ano } = {}) {
    const y = Number(ano) || new Date().getFullYear();
    const ini = `${y}-01-01`;
    const fim = `${y}-12-31`;
    const base = await carregarBase(igrejaId);
    const pl = [...base.contas.values()].filter((c) => c.natureza === 'passivo' && c.pl);
    const antes = somar(base.partidas, antesDe(ini));
    const no = somar(base.partidas, entre(ini, fim));
    const linhas = pl
        .map((c) => {
            const a = antes.get(c.key) || { d: 0, c: 0 };
            const m = no.get(c.key) || { d: 0, c: 0 };
            const inicial = r2(a.c - a.d);
            const mut = r2(m.c - m.d);
            return { conta: rotulo(c), saldoInicial: inicial, resultado: 0, outras: mut, saldoFinal: r2(inicial + mut) };
        })
        .filter((l) => l.saldoInicial || l.outras);
    const resAnt = resultado(base, antesDe(ini)).resultado;
    const resAno = resultado(base, entre(ini, fim));
    linhas.push({ conta: 'Superávits/Déficits acumulados', saldoInicial: resAnt, resultado: resAno.resultado, outras: 0, saldoFinal: r2(resAnt + resAno.resultado) });
    const soma = (k) => r2(linhas.reduce((s, l) => s + l[k], 0));
    return {
        ano: y, linhas,
        totais: { saldoInicial: soma('saldoInicial'), resultado: soma('resultado'), outras: soma('outras'), saldoFinal: soma('saldoFinal') },
        receitas: resAno.receitas, despesas: resAno.despesas,
        diagnostico: base.diagnostico
    };
}

module.exports = {
    contasDisponiveis, diario, razao, balancete, balanco, dre, dreMensal, fluxoContabil, fluxoTesouraria, dmpl,
    _internals: { cmpCodigo, carregarBase, arvore }
};
