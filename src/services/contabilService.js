/**
 * Contabilidade da igreja (módulo "contabilidade" do plano).
 *
 * - Plano de contas padrão (sintéticas S / analíticas A) criado na primeira vez, compatível
 *   com as contas que a Tesouraria já usa (1.01.01 Caixa, 1.01.02.xx bancos, 3.xx despesas, 4.xx receitas).
 * - Lançamentos contábeis = manuais + automáticos da Tesouraria (caixa e bancos, regime de caixa)
 *   + lançamentos de encerramento. Os automáticos são calculados na hora: nunca ficam desatualizados.
 * - Balancete de abertura: saldos iniciais (os do caixa e das contas bancárias vêm da Tesouraria).
 * - Encerramento do exercício: apura o resultado, zera receitas/despesas contra o resultado do
 *   exercício e apropria em "Superávit ou déficit acumulado". Depois disso o ano fica travado.
 */
const { pool } = require('../config/db');
const contabilidadeModel = require('../models/contabilidadeModel');
const exercicio = require('../models/exercicioContabilModel');
const caixaModel = require('../models/caixaModel');
const bancoModel = require('../models/bancoModel');
const { createHttpError } = require('../utils/httpError');

const CONTA_CAIXA = '1.01.01';
const RESULTADO_EXERCICIO = '2.03.03';
const RESULTADO_ACUMULADO = '2.03.02';

// [código, nome, tipo] — a natureza vem do grupo (1 ativo, 2 passivo/PL, 3 despesa, 4 receita)
const PLANO_PADRAO = [
    ['1', 'ATIVO', 'S'],
    ['1.01', 'ATIVO CIRCULANTE', 'S'],
    ['1.01.01', 'Caixa', 'A'],
    ['1.01.02', 'Bancos conta movimento', 'S'],
    ['1.01.03', 'Aplicações financeiras', 'S'],
    ['1.01.04', 'Créditos a receber', 'S'],
    ['1.01.04.01', 'Adiantamentos a funcionários', 'A'],
    ['1.01.04.02', 'Adiantamentos a fornecedores', 'A'],
    ['1.01.04.03', 'Outros créditos a receber', 'A'],
    ['1.02', 'ATIVO NÃO CIRCULANTE', 'S'],
    ['1.02.01', 'Imobilizado', 'S'],
    ['1.02.01.01', 'Terrenos', 'A'],
    ['1.02.01.02', 'Edificações e templos', 'A'],
    ['1.02.01.03', 'Móveis e utensílios', 'A'],
    ['1.02.01.04', 'Instrumentos musicais e equipamentos de som', 'A'],
    ['1.02.01.05', 'Veículos', 'A'],
    ['1.02.01.06', 'Computadores e periféricos', 'A'],
    ['1.02.01.07', 'Construções em andamento', 'A'],
    ['1.02.02', 'Depreciação acumulada', 'S'],
    ['1.02.02.01', '(-) Depreciação acumulada', 'A'],
    ['2', 'PASSIVO', 'S'],
    ['2.01', 'PASSIVO CIRCULANTE', 'S'],
    ['2.01.01', 'Fornecedores', 'S'],
    ['2.01.01.01', 'Fornecedores a pagar', 'A'],
    ['2.01.02', 'Obrigações trabalhistas', 'S'],
    ['2.01.02.01', 'Salários a pagar', 'A'],
    ['2.01.02.02', 'Prebenda pastoral a pagar', 'A'],
    ['2.01.02.03', 'INSS a recolher', 'A'],
    ['2.01.02.04', 'FGTS a recolher', 'A'],
    ['2.01.02.05', 'Contribuição sindical a recolher', 'A'],
    ['2.01.03', 'Obrigações tributárias', 'S'],
    ['2.01.03.01', 'IRRF a recolher', 'A'],
    ['2.01.03.02', 'PIS sobre folha a recolher', 'A'],
    ['2.01.03.03', 'ISS a recolher', 'A'],
    ['2.01.04', 'Empréstimos e financiamentos', 'S'],
    ['2.01.04.01', 'Empréstimos bancários', 'A'],
    ['2.01.05', 'Cartões de crédito', 'S'],
    ['2.01.06', 'Outras obrigações', 'S'],
    ['2.01.06.01', 'Contas a pagar diversas', 'A'],
    ['2.02', 'PASSIVO NÃO CIRCULANTE', 'S'],
    ['2.02.01', 'Empréstimos e financiamentos de longo prazo', 'S'],
    ['2.02.01.01', 'Financiamentos de longo prazo', 'A'],
    ['2.03', 'PATRIMÔNIO SOCIAL', 'S'],
    ['2.03.01', 'Patrimônio social', 'A'],
    ['2.03.02', 'Superávit ou déficit acumulado', 'A'],
    ['2.03.03', 'Superávit ou déficit do exercício', 'A'],
    ['3', 'DESPESAS', 'S'],
    ['3.01', 'Despesas administrativas', 'S'],
    ['3.01.01', 'Aluguel', 'A'],
    ['3.01.02', 'Água e esgoto', 'A'],
    ['3.01.03', 'Energia elétrica', 'A'],
    ['3.01.04', 'Telefone e internet', 'A'],
    ['3.01.05', 'Material de limpeza', 'A'],
    ['3.01.06', 'Material de escritório', 'A'],
    ['3.01.07', 'Manutenção e reparos', 'A'],
    ['3.02', 'Despesas com pessoal', 'S'],
    ['3.02.01', 'Prebenda pastoral', 'A'],
    ['3.02.02', 'Salários e encargos', 'A'],
    ['3.03', 'Ação social e missões', 'S'],
    ['3.03.01', 'Ação social / ajuda a necessitados', 'A'],
    ['3.03.02', 'Repasse missionário', 'A'],
    ['3.04', 'Eventos e atividades', 'S'],
    ['3.04.01', 'Eventos e congressos', 'A'],
    ['3.04.02', 'Transporte e combustível', 'A'],
    ['3.04.03', 'Alimentação', 'A'],
    ['3.05', 'Despesas financeiras', 'S'],
    ['3.05.01', 'Tarifas bancárias', 'A'],
    ['3.06', 'Repasses', 'S'],
    ['3.06.01', 'Repasse à sede / convenção', 'A'],
    ['3.09', 'Outras despesas', 'S'],
    ['3.09.99', 'Outras despesas', 'A'],
    ['4', 'RECEITAS', 'S'],
    ['4.01', 'Contribuições', 'S'],
    ['4.01.01', 'Contribuições de membros', 'S'],
    ['4.01.01.01', 'Dízimo de Membros', 'A'],
    ['4.01.01.02', 'Oferta de Membros', 'A'],
    ['4.01.02', 'Contribuições de visitantes', 'S'],
    ['4.01.02.01', 'Dízimo de Visitantes', 'A'],
    ['4.01.02.02', 'Oferta de Visitantes', 'A'],
    ['4.01.03', 'Ofertas missionárias', 'S'],
    ['4.01.03.01', 'Oferta Missionária de Membros', 'A'],
    ['4.01.03.02', 'Oferta Missionária de Visitantes', 'A'],
    ['4.01.04', 'Contribuições de congregados', 'S'],
    ['4.01.04.01', 'Dízimo de Congregados', 'A'],
    ['4.01.04.02', 'Oferta de Congregados', 'A'],
    ['4.01.05', 'Contribuições de crianças', 'S'],
    ['4.01.05.01', 'Dízimo de Crianças', 'A'],
    ['4.01.05.02', 'Oferta de Crianças', 'A'],
    ['4.02', 'Outras receitas operacionais', 'S'],
    ['4.02.01', 'Receitas de eventos', 'A'],
    ['4.02.02', 'Cantina e vendas', 'A'],
    ['4.02.03', 'Doações e campanhas', 'A'],
    ['4.03', 'Receitas financeiras', 'S'],
    ['4.03.01', 'Rendimentos de aplicações', 'A'],
    ['4.09', 'Outras receitas', 'S'],
    ['4.09.99', 'Outras receitas', 'A']
];

const NATUREZA_GRUPO = { 1: 'ativo', 2: 'passivo', 3: 'despesa', 4: 'receita' };
const naturezaDe = (codigo) => NATUREZA_GRUPO[String(codigo).charAt(0)] || null;
const devedora = (nat) => nat === 'ativo' || nat === 'despesa';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const iso = exercicio.isoData;
const RE_CODIGO = /^\s*(\d+(?:\.\d+)*)/;
const codigoDe = (rotulo) => { const m = String(rotulo || '').match(RE_CODIGO); return m ? m[1] : null; };
const rotuloDe = (c) => `${c.codigo} - ${c.nome}`;
const paiDe = (codigo) => (String(codigo).includes('.') ? String(codigo).split('.').slice(0, -1).join('.') : null);

function cmpCodigo(a, b) {
    const pa = String(a).split('.').map(Number);
    const pb = String(b).split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
        if (pa[i] === undefined) return -1;
        if (pb[i] === undefined) return 1;
        if (pa[i] !== pb[i]) return pa[i] - pb[i];
    }
    return 0;
}

// ── Estrutura ────────────────────────────────────────────────────────────────
let colunasOk = false;
async function ensure() {
    await contabilidadeModel.ensureTables();
    await exercicio.ensure();
    if (colunasOk) return;
    for (const ddl of [
        "ALTER TABLE contabilidade_plano_contas ADD COLUMN tipo VARCHAR(1) NOT NULL DEFAULT 'A'",
        'ALTER TABLE contabilidade_plano_contas ADD COLUMN sistema INTEGER NOT NULL DEFAULT 0',
        'ALTER TABLE contabilidade_lancamentos ADD COLUMN documento VARCHAR(50) NULL',
        'ALTER TABLE contabilidade_lancamentos ADD COLUMN centro_custo_id INTEGER NULL',
        'ALTER TABLE contabilidade_lancamentos ADD COLUMN movimento_cc VARCHAR(1) NULL',
        'ALTER TABLE contabilidade_lancamentos ADD COLUMN origem VARCHAR(20) NULL',
        'ALTER TABLE contabilidade_lancamentos ADD COLUMN exercicio INTEGER NULL'
    ]) {
        try {
            await pool.query(ddl);
        } catch (e) {
            if (!/duplicate column|already exists/i.test(String(e && e.message))) throw e;
        }
    }
    colunasOk = true;
}

async function garantirPlano(igrejaId) {
    await ensure();
    const [rows] = await pool.query('SELECT codigo FROM contabilidade_plano_contas WHERE igreja_id = ?', [igrejaId]);
    const existentes = new Set(rows.map((r) => String(r.codigo).trim()));
    const faltando = PLANO_PADRAO.filter(([codigo]) => !existentes.has(codigo));
    for (const [codigo, nome, tipo] of faltando) {
        const id = `pc-${igrejaId}-${codigo}`;
        try {
            await pool.query(
                `INSERT INTO contabilidade_plano_contas (id, igreja_id, codigo, nome, natureza, ativo, tipo, sistema)
                 VALUES (?, ?, ?, ?, ?, 1, ?, 1)`,
                [id, igrejaId, codigo, nome, naturezaDe(codigo), tipo]
            );
        } catch (e) {
            if (!/duplicate|unique/i.test(String(e && e.message))) throw e;
        }
    }
    // Contas que a Tesouraria cria (bancos) ficam marcadas como analíticas do sistema
    if (faltando.length) {
        await pool.query(
            "UPDATE contabilidade_plano_contas SET tipo = 'S' WHERE igreja_id = ? AND codigo IN ('1.01.02', '1.01.03', '2.01.05')",
            [igrejaId]
        );
    }
}

async function carregarPlano(igrejaId, { inativas = true } = {}) {
    await garantirPlano(igrejaId);
    const [rows] = await pool.query(
        `SELECT id, codigo, nome, natureza, ativo, tipo, sistema FROM contabilidade_plano_contas
         WHERE igreja_id = ? ${inativas ? '' : 'AND ativo = 1'}`,
        [igrejaId]
    );
    const contas = rows.map((r) => ({
        id: r.id,
        codigo: String(r.codigo).trim(),
        nome: String(r.nome || '').trim(),
        natureza: naturezaDe(r.codigo) || String(r.natureza || '').toLowerCase(),
        tipo: r.tipo === 'S' ? 'S' : 'A',
        ativo: Number(r.ativo) !== 0,
        sistema: Number(r.sistema) === 1
    })).sort((a, b) => cmpCodigo(a.codigo, b.codigo));
    return contas;
}

// Contas que pertencem à Tesouraria (não aceitam lançamento manual: use o Caixa/Bancos)
async function contasDaTesouraria(igrejaId) {
    const contas = await bancoModel.listContas(igrejaId);
    const mapa = new Map([[CONTA_CAIXA, { tipo: 'caixa', nome: 'Caixa' }]]);
    contas.forEach((c) => {
        const cod = codigoDe(c.conta_contabil);
        if (cod) mapa.set(cod, { tipo: 'banco', nome: c.nome, contaId: c.id, tipoConta: c.tipo });
    });
    return mapa;
}

async function listarPlano(igrejaId) {
    const [plano, tes] = await Promise.all([carregarPlano(igrejaId), contasDaTesouraria(igrejaId)]);
    const temFilho = new Set(plano.map((c) => paiDe(c.codigo)).filter(Boolean));
    return plano.map((c) => ({
        ...c,
        nivel: c.codigo.split('.').length,
        pai: paiDe(c.codigo),
        temFilhos: temFilho.has(c.codigo),
        tesouraria: tes.has(c.codigo) ? tes.get(c.codigo).tipo : null
    }));
}

function proximoCodigo(plano, pai) {
    const filhos = plano.filter((c) => paiDe(c.codigo) === pai).map((c) => Number(c.codigo.split('.').pop()));
    let n = 1;
    const usados = new Set(filhos);
    while (usados.has(n)) n += 1;
    return `${pai}.${String(n).padStart(2, '0')}`;
}

async function criarConta(igrejaId, { pai, codigo, nome, tipo }, userId) {
    const plano = await carregarPlano(igrejaId);
    const contaPai = plano.find((c) => c.codigo === pai);
    if (!contaPai) throw createHttpError(400, 'Escolha a conta superior (grupo) onde a nova conta vai ficar.');
    if (contaPai.tipo !== 'S') throw createHttpError(400, `"${rotuloDe(contaPai)}" é uma conta analítica (recebe lançamentos) e não pode ter subcontas.`);
    const cod = codigo ? String(codigo).trim() : proximoCodigo(plano, pai);
    if (!/^\d+(\.\d+)*$/.test(cod) || paiDe(cod) !== pai) {
        throw createHttpError(400, `O código precisa começar por ${pai}. (ex.: ${proximoCodigo(plano, pai)}).`);
    }
    if (plano.some((c) => c.codigo === cod)) throw createHttpError(409, `Já existe uma conta com o código ${cod}.`);
    const id = `pc-${igrejaId}-${cod}-${Date.now().toString(36)}`;
    await pool.query(
        `INSERT INTO contabilidade_plano_contas (id, igreja_id, codigo, nome, natureza, ativo, tipo, sistema, created_by)
         VALUES (?, ?, ?, ?, ?, 1, ?, 0, ?)`,
        [id, igrejaId, cod, String(nome).trim(), naturezaDe(cod), tipo === 'S' ? 'S' : 'A', userId || null]
    );
    return { id, codigo: cod };
}

async function acharConta(igrejaId, id) {
    const plano = await carregarPlano(igrejaId);
    const c = plano.find((x) => x.id === String(id));
    if (!c) throw createHttpError(404, 'Conta não encontrada.');
    return { c, plano };
}

async function atualizarConta(igrejaId, id, { nome, ativo }) {
    const { c } = await acharConta(igrejaId, id);
    if (ativo === false && c.sistema && [CONTA_CAIXA, RESULTADO_ACUMULADO, RESULTADO_EXERCICIO].includes(c.codigo)) {
        throw createHttpError(409, 'Esta conta é usada pelo sistema e não pode ser desativada.');
    }
    await pool.query(
        'UPDATE contabilidade_plano_contas SET nome = ?, ativo = ? WHERE id = ? AND igreja_id = ?',
        [nome != null ? String(nome).trim() : c.nome, ativo === false ? 0 : 1, c.id, igrejaId]
    );
}

async function excluirConta(igrejaId, id) {
    const { c, plano } = await acharConta(igrejaId, id);
    if (c.sistema) throw createHttpError(409, 'Contas do plano padrão não podem ser excluídas. Você pode desativá-las.');
    if (plano.some((x) => paiDe(x.codigo) === c.codigo)) throw createHttpError(409, 'Esta conta tem subcontas. Exclua as subcontas primeiro.');
    const tes = await contasDaTesouraria(igrejaId);
    if (tes.has(c.codigo)) throw createHttpError(409, 'Esta conta está ligada a uma conta bancária da Tesouraria.');
    const like = `${c.codigo} %`;
    const usos = await Promise.all([
        pool.query('SELECT COUNT(*) AS n FROM contabilidade_lancamentos WHERE igreja_id = ? AND (conta_debito LIKE ? OR conta_credito LIKE ?)', [igrejaId, like, like]),
        pool.query('SELECT COUNT(*) AS n FROM caixa_lancamentos WHERE igreja_id = ? AND conta_contabil LIKE ?', [igrejaId, like]).catch(() => [[{ n: 0 }]]),
        pool.query('SELECT COUNT(*) AS n FROM banco_lancamentos WHERE igreja_id = ? AND conta_contabil LIKE ?', [igrejaId, like]).catch(() => [[{ n: 0 }]]),
        pool.query('SELECT COUNT(*) AS n FROM contabilidade_balancete_abertura WHERE igreja_id = ? AND conta LIKE ?', [igrejaId, like])
    ]);
    if (usos.some(([r]) => Number(r[0].n) > 0)) throw createHttpError(409, 'Esta conta já tem movimento. Desative-a em vez de excluir.');
    await pool.query('DELETE FROM contabilidade_plano_contas WHERE id = ? AND igreja_id = ?', [c.id, igrejaId]);
}

// ── Lançamentos (manuais + Tesouraria + encerramento) ───────────────────────
async function rotuloBanco(igrejaId, conta) {
    if (conta.conta_contabil) return conta.conta_contabil;
    // conta antiga sem conta contábil: gera agora (mesmo padrão do cadastro de contas)
    // eslint-disable-next-line global-require
    return require('./bancoService').garantirContaContabil(igrejaId, conta, null);
}

function filtroData(col, inicio, fim) {
    const w = [];
    const p = [];
    if (inicio) { w.push(`${col} >= ?`); p.push(inicio); }
    if (fim) { w.push(`${col} < ?`); p.push(fim); }
    return { sql: w.length ? ` AND ${w.join(' AND ')}` : '', p };
}

// Movimento da Tesouraria sem conta contábil: vai para "outras" (marcado para reclassificar)
const OUTRAS_RECEITAS = '4.09.99 - Outras receitas';
const OUTRAS_DESPESAS = '3.09.99 - Outras despesas';

async function carregarLancamentos(igrejaId, { inicio = null, fim = null } = {}) {
    await ensure();
    await caixaModel.ensure();
    await bancoModel.ensureBancoTables();
    const out = [];

    const fm = filtroData('data_lancamento', inicio, fim);
    const [manuais] = await pool.query(
        `SELECT id, data_lancamento, historico, conta_debito, conta_credito, valor, documento, centro_custo_id,
                movimento_cc, origem, exercicio, created_at
         FROM contabilidade_lancamentos WHERE igreja_id = ?${fm.sql}`,
        [igrejaId, ...fm.p]
    );
    manuais.forEach((l) => out.push({
        id: `m${l.id}`, fonte: l.origem === 'encerramento' ? 'encerramento' : 'manual', fonteId: l.id,
        data: iso(l.data_lancamento), historico: l.historico, debito: l.conta_debito, credito: l.conta_credito,
        valor: r2(l.valor), documento: l.documento || null, centroCustoId: l.centro_custo_id || null,
        movimentoCC: l.movimento_cc || null, exercicio: l.exercicio || null, criado: l.created_at
    }));

    // Caixa: entrada = D Caixa / C conta; saída = D conta / C Caixa (cópias vindas do banco são ignoradas)
    const caixaRotulo = '1.01.01 - Caixa';
    const fc = filtroData('data', inicio, fim);
    const [cx] = await pool.query(
        `SELECT id, data, doc, historico, valor, tipo, conta_contabil, origem, origem_id, created_at
         FROM caixa_lancamentos WHERE igreja_id = ? AND (origem IS NULL OR origem <> 'banco')${fc.sql}`,
        [igrejaId, ...fc.p]
    );
    cx.forEach((l) => {
        const entrada = String(l.tipo).toUpperCase() === 'ENTRADA';
        const outra = l.conta_contabil || (entrada ? OUTRAS_RECEITAS : OUTRAS_DESPESAS);
        out.push({
            semClassificacao: !l.conta_contabil,
            id: `c${l.id}`, fonte: 'caixa', fonteId: l.id, origem: l.origem || null, data: iso(l.data), historico: l.historico,
            debito: entrada ? caixaRotulo : outra, credito: entrada ? outra : caixaRotulo,
            valor: r2(l.valor), documento: l.doc || null, criado: l.created_at
        });
    });

    // Bancos: idem com a conta contábil da conta bancária (cópias de transferência/caixa são ignoradas)
    const contas = await bancoModel.listContas(igrejaId);
    const rotulo = new Map();
    for (const c of contas) rotulo.set(Number(c.id), await rotuloBanco(igrejaId, c));
    const nomeConta = new Map(contas.map((c) => [Number(c.id), c.nome]));
    const fb = filtroData('data_lancamento', inicio, fim);
    const [bc] = await pool.query(
        `SELECT id, conta_id, data_lancamento, doc, descricao, valor, tipo, conta_contabil, origem, origem_id, created_at
         FROM banco_lancamentos WHERE igreja_id = ? AND (origem IS NULL OR origem NOT IN ('transferencia', 'caixa'))${fb.sql}`,
        [igrejaId, ...fb.p]
    );
    bc.forEach((l) => {
        const entrada = String(l.tipo).toLowerCase() === 'entrada';
        const banco = rotulo.get(Number(l.conta_id)) || `Conta bancária ${l.conta_id}`;
        const outra = l.conta_contabil || (entrada ? OUTRAS_RECEITAS : OUTRAS_DESPESAS);
        out.push({
            semClassificacao: !l.conta_contabil,
            id: `b${l.id}`, fonte: 'banco', fonteId: l.id, contaId: l.conta_id, origem: l.origem || null, contaNome: nomeConta.get(Number(l.conta_id)) || '',
            data: iso(l.data_lancamento), historico: l.descricao,
            debito: entrada ? banco : outra, credito: entrada ? outra : banco,
            valor: r2(l.valor), documento: l.doc || null, criado: l.created_at
        });
    });

    out.sort((a, b) => String(a.data).localeCompare(String(b.data))
        || String(a.criado || '').localeCompare(String(b.criado || '')) || String(a.id).localeCompare(String(b.id)));
    return out;
}

function intervaloMes(mes) {
    const [a, m] = mes.split('-').map(Number);
    const fim = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
    return { inicio: `${mes}-01`, fim };
}

async function listarLancamentos(igrejaId, { mes, busca } = {}) {
    const { inicio, fim } = mes ? intervaloMes(mes) : {};
    let items = await carregarLancamentos(igrejaId, { inicio, fim });
    const b = String(busca || '').trim().toLowerCase();
    if (b) {
        items = items.filter((l) => [l.historico, l.debito, l.credito, l.documento].some((v) => String(v || '').toLowerCase().includes(b)));
    }
    const fechado = await exercicio.ultimoFechado(igrejaId);
    items = items.map((l) => ({ ...l, bloqueado: !!(fechado && Number(String(l.data).slice(0, 4)) <= fechado) }));
    const total = r2(items.reduce((s, l) => s + l.valor, 0));
    return { items: items.reverse(), total, ultimoExercicioFechado: fechado };
}

async function validarManual(igrejaId, d, idAtual = null) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dataLancamento || ''))) throw createHttpError(400, 'Informe a data.');
    const valor = Number(d.valor);
    if (!(valor > 0)) throw createHttpError(400, 'Informe um valor maior que zero.');
    const plano = await carregarPlano(igrejaId, { inativas: false });
    const tes = await contasDaTesouraria(igrejaId);
    const achar = (rotulo, lado) => {
        const cod = codigoDe(rotulo);
        const c = cod && plano.find((x) => x.codigo === cod);
        if (!c) throw createHttpError(400, `Conta ${lado}: escolha uma conta do plano de contas.`);
        if (c.tipo !== 'A') throw createHttpError(400, `Conta ${lado}: "${rotuloDe(c)}" é sintética (grupo). Escolha uma conta analítica.`);
        if (tes.has(c.codigo)) {
            throw createHttpError(400, `Conta ${lado}: "${rotuloDe(c)}" é movimentada pela Tesouraria. Lance no ${tes.get(c.codigo).tipo === 'caixa' ? 'Caixa' : 'banco'} para manter os saldos iguais.`);
        }
        return c;
    };
    const deb = achar(d.contaDebito, 'débito');
    const cred = achar(d.contaCredito, 'crédito');
    if (deb.codigo === cred.codigo) throw createHttpError(400, 'A conta de débito e a de crédito precisam ser diferentes.');
    let antiga = null;
    if (idAtual) {
        const [r] = await pool.query('SELECT data_lancamento, origem FROM contabilidade_lancamentos WHERE id = ? AND igreja_id = ? LIMIT 1', [idAtual, igrejaId]);
        if (!r[0]) throw createHttpError(404, 'Lançamento não encontrado.');
        if (r[0].origem === 'encerramento') throw createHttpError(409, 'Lançamentos de encerramento não podem ser alterados. Reabra o exercício.');
        antiga = r[0].data_lancamento;
    }
    await exercicio.exigirAberto(igrejaId, d.dataLancamento, antiga);
    return { deb, cred, valor };
}

async function criarLancamento(igrejaId, d, userId) {
    const { deb, cred, valor } = await validarManual(igrejaId, d);
    const id = `lc-${igrejaId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
        `INSERT INTO contabilidade_lancamentos
            (id, igreja_id, data_lancamento, historico, conta_debito, conta_credito, valor, documento, centro_custo_id, movimento_cc, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, igrejaId, d.dataLancamento, d.historico, rotuloDe(deb), rotuloDe(cred), valor, d.documento || null,
            d.centroCustoId || null, d.movimentoCC || null, userId || null]
    );
    return id;
}

async function atualizarLancamento(igrejaId, id, d) {
    const { deb, cred, valor } = await validarManual(igrejaId, d, id);
    await pool.query(
        `UPDATE contabilidade_lancamentos SET data_lancamento = ?, historico = ?, conta_debito = ?, conta_credito = ?, valor = ?,
            documento = ?, centro_custo_id = ?, movimento_cc = ?
         WHERE id = ? AND igreja_id = ?`,
        [d.dataLancamento, d.historico, rotuloDe(deb), rotuloDe(cred), valor, d.documento || null, d.centroCustoId || null,
            d.movimentoCC || null, id, igrejaId]
    );
}

async function getLancamento(igrejaId, id) {
    await ensure();
    const [r] = await pool.query(
        `SELECT id, data_lancamento, historico, conta_debito, conta_credito, valor, documento, centro_custo_id, movimento_cc, origem
         FROM contabilidade_lancamentos WHERE id = ? AND igreja_id = ? LIMIT 1`,
        [id, igrejaId]
    );
    if (!r[0]) return null;
    return { ...r[0], data_lancamento: iso(r[0].data_lancamento), valor: r2(r[0].valor) };
}

async function excluirLancamento(igrejaId, id) {
    const l = await getLancamento(igrejaId, id);
    if (!l) throw createHttpError(404, 'Lançamento não encontrado.');
    if (l.origem === 'encerramento') throw createHttpError(409, 'Lançamentos de encerramento não podem ser excluídos. Reabra o exercício.');
    await exercicio.exigirAberto(igrejaId, l.data_lancamento);
    await pool.query('DELETE FROM contabilidade_lancamentos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
}

// ── Balancete de abertura ───────────────────────────────────────────────────
async function dataAbertura(igrejaId) {
    const datas = [];
    const meses = await caixaModel.listMeses(igrejaId).catch(() => []);
    if (meses[0]) datas.push(`${String(meses[0].mes_competencia).slice(0, 7)}-01`);
    (await bancoModel.listContas(igrejaId)).forEach((c) => { const d = iso(c.saldo_data); if (d) datas.push(d); });
    const [l] = await pool.query('SELECT MIN(data_lancamento) AS d FROM contabilidade_lancamentos WHERE igreja_id = ?', [igrejaId]);
    if (l[0] && l[0].d) datas.push(iso(l[0].d));
    datas.sort();
    return datas[0] || `${new Date().getFullYear()}-01-01`;
}

// Saldos de abertura que vêm da Tesouraria (código → saldo na natureza da conta)
async function aberturaTesouraria(igrejaId) {
    const m = new Map();
    const meses = await caixaModel.listMeses(igrejaId).catch(() => []);
    if (meses[0]) m.set(CONTA_CAIXA, { saldo: r2(meses[0].saldo_inicial), origem: 'Caixa' });
    for (const c of await bancoModel.listContas(igrejaId)) {
        const cod = codigoDe(await rotuloBanco(igrejaId, c));
        if (!cod) continue;
        const v = Number(c.saldo_inicial) || 0;
        // no ativo o saldo é devedor; no cartão (passivo) a dívida fica guardada negativa
        const saldo = naturezaDe(cod) === 'passivo' ? -v : v;
        const atual = m.get(cod);
        m.set(cod, { saldo: r2((atual ? atual.saldo : 0) + saldo), origem: c.nome });
    }
    return m;
}

async function aberturaManual(igrejaId) {
    await ensure();
    const [rows] = await pool.query('SELECT conta, debito, credito FROM contabilidade_balancete_abertura WHERE igreja_id = ?', [igrejaId]);
    const m = new Map();
    rows.forEach((r) => {
        const cod = codigoDe(r.conta);
        if (!cod) return;
        const nat = naturezaDe(cod);
        const v = devedora(nat) ? Number(r.debito) - Number(r.credito) : Number(r.credito) - Number(r.debito);
        m.set(cod, r2((m.get(cod) || 0) + v));
    });
    return m;
}

async function balanceteAbertura(igrejaId) {
    const [plano, tes, manual, fechado, data] = await Promise.all([
        carregarPlano(igrejaId, { inativas: false }), aberturaTesouraria(igrejaId), aberturaManual(igrejaId),
        exercicio.ultimoFechado(igrejaId), dataAbertura(igrejaId)
    ]);
    const linha = (c) => {
        const t = tes.get(c.codigo);
        return {
            codigo: c.codigo, nome: c.nome, conta: rotuloDe(c),
            saldo: t ? t.saldo : (manual.get(c.codigo) || 0),
            tesouraria: t ? t.origem : null
        };
    };
    const analiticas = plano.filter((c) => c.tipo === 'A');
    const ativo = analiticas.filter((c) => c.natureza === 'ativo').map(linha);
    const passivo = analiticas.filter((c) => c.natureza === 'passivo').map(linha);
    const totalAtivo = r2(ativo.reduce((s, l) => s + l.saldo, 0));
    const totalPassivo = r2(passivo.reduce((s, l) => s + l.saldo, 0));
    return {
        dataAbertura: data, bloqueado: !!fechado, ultimoExercicioFechado: fechado,
        ativo, passivo, totalAtivo, totalPassivo, diferenca: r2(totalAtivo - totalPassivo)
    };
}

async function exigirAberturaEditavel(igrejaId) {
    const fechado = await exercicio.ultimoFechado(igrejaId);
    if (fechado) throw createHttpError(409, `O exercício de ${fechado} já foi encerrado. Os saldos de abertura não podem mais ser alterados.`);
}

async function gravarSaldoAbertura(igrejaId, cod, saldo, userId) {
    const c = (await carregarPlano(igrejaId)).find((x) => x.codigo === cod);
    await pool.query('DELETE FROM contabilidade_balancete_abertura WHERE igreja_id = ? AND (conta = ? OR conta LIKE ?)', [igrejaId, rotuloDe(c), `${cod} -%`]);
    const v = r2(saldo);
    if (!v) return;
    const deb = devedora(c.natureza) ? v : -v;
    await pool.query(
        'INSERT INTO contabilidade_balancete_abertura (id, igreja_id, conta, debito, credito, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [`ba-${igrejaId}-${cod}-${Date.now().toString(36)}`, igrejaId, rotuloDe(c), deb > 0 ? deb : 0, deb < 0 ? -deb : 0, userId || null]
    );
}

async function salvarSaldoAbertura(igrejaId, { conta, saldo }, userId) {
    await exigirAberturaEditavel(igrejaId);
    const cod = codigoDe(conta);
    const c = cod && (await carregarPlano(igrejaId, { inativas: false })).find((x) => x.codigo === cod);
    if (!c || c.tipo !== 'A' || !['ativo', 'passivo'].includes(c.natureza)) {
        throw createHttpError(400, 'Escolha uma conta analítica do Ativo ou do Passivo.');
    }
    if ((await aberturaTesouraria(igrejaId)).has(cod)) {
        throw createHttpError(409, 'O saldo inicial desta conta vem da Tesouraria (cadastro do caixa ou da conta bancária).');
    }
    const v = Number(saldo);
    if (!Number.isFinite(v)) throw createHttpError(400, 'Informe um valor válido.');
    await gravarSaldoAbertura(igrejaId, cod, v, userId);
}

// Fecha a diferença entre Ativo e Passivo em "Superávit ou déficit acumulado"
async function ajustarResultadoAcumulado(igrejaId, userId) {
    await exigirAberturaEditavel(igrejaId);
    const b = await balanceteAbertura(igrejaId);
    const atual = b.passivo.find((l) => l.codigo === RESULTADO_ACUMULADO);
    const novo = r2((atual ? atual.saldo : 0) + b.diferenca);
    await gravarSaldoAbertura(igrejaId, RESULTADO_ACUMULADO, novo, userId);
    return { valor: novo };
}

// ── Encerramento do exercício ───────────────────────────────────────────────
async function estadoEncerramento(igrejaId) {
    await ensure();
    const fechado = await exercicio.ultimoFechado(igrejaId);
    const abertura = await dataAbertura(igrejaId);
    const ano = fechado ? fechado + 1 : Number(abertura.slice(0, 4));
    const anoAtual = new Date().getFullYear();
    const [hist] = await pool.query(
        `SELECT id, ano, resultado, sem_movimento, usuario_nome, created_at FROM contabilidade_encerramentos
         WHERE igreja_id = ? AND ano IS NOT NULL ORDER BY ano DESC`,
        [igrejaId]
    );
    const movs = await carregarLancamentos(igrejaId, { inicio: `${ano}-01-01`, fim: `${ano + 1}-01-01` });
    const res = apurar(movs.filter((l) => l.fonte !== 'encerramento'));
    return {
        ultimoExercicioFechado: fechado,
        anoEncerramento: ano,
        podeEncerrar: ano <= anoAtual,
        anoAindaEmAndamento: ano === anoAtual,
        movimentos: movs.length,
        previa: { receitas: res.receitas, despesas: res.despesas, resultado: res.resultado },
        historico: hist.map((h) => ({
            ano: Number(h.ano), resultado: r2(h.resultado), semMovimento: Number(h.sem_movimento) === 1,
            usuario: h.usuario_nome, data: h.created_at
        }))
    };
}

// Saldo de cada conta de resultado (3 e 4) nos movimentos
function apurar(movs) {
    const saldo = new Map();
    const add = (rotulo, d, c) => {
        const cod = codigoDe(rotulo);
        if (!cod || !['3', '4'].includes(cod.charAt(0))) return;
        const s = saldo.get(cod) || { rotulo, d: 0, c: 0 };
        s.d += d;
        s.c += c;
        saldo.set(cod, s);
    };
    movs.forEach((l) => { add(l.debito, l.valor, 0); add(l.credito, 0, l.valor); });
    let receitas = 0;
    let despesas = 0;
    saldo.forEach((s, cod) => {
        if (cod.charAt(0) === '4') receitas += s.c - s.d;
        else despesas += s.d - s.c;
    });
    return { saldo, receitas: r2(receitas), despesas: r2(despesas), resultado: r2(receitas - despesas) };
}

async function encerrar(igrejaId, { ano, semMovimento }, usuario) {
    const estado = await estadoEncerramento(igrejaId);
    if (Number(ano) !== estado.anoEncerramento) {
        throw createHttpError(400, `O próximo exercício a encerrar é ${estado.anoEncerramento}. Os anos precisam ser encerrados em ordem.`);
    }
    if (!estado.podeEncerrar) throw createHttpError(400, `O exercício de ${ano} ainda não começou.`);
    if (!estado.movimentos && !semMovimento) {
        throw createHttpError(400, `Não há movimento em ${ano}. Se for isso mesmo, marque "Ano sem movimento".`);
    }
    if (estado.movimentos && semMovimento) {
        throw createHttpError(400, `Existem ${estado.movimentos} lançamento(s) em ${ano}; desmarque "Ano sem movimento".`);
    }

    const plano = await carregarPlano(igrejaId);
    const rot = (cod) => rotuloDe(plano.find((c) => c.codigo === cod));
    const movs = await carregarLancamentos(igrejaId, { inicio: `${ano}-01-01`, fim: `${ano + 1}-01-01` });
    const { saldo, resultado } = apurar(movs.filter((l) => l.fonte !== 'encerramento'));
    const data = `${ano}-12-31`;
    const linhas = [];
    saldo.forEach((s, cod) => {
        const v = r2(cod.charAt(0) === '4' ? s.c - s.d : s.d - s.c);
        if (!v) return;
        const conta = plano.find((c) => c.codigo === cod) ? rot(cod) : s.rotulo;
        if (cod.charAt(0) === '4') {
            linhas.push(v > 0 ? [conta, rot(RESULTADO_EXERCICIO), v] : [rot(RESULTADO_EXERCICIO), conta, -v]);
        } else {
            linhas.push(v > 0 ? [rot(RESULTADO_EXERCICIO), conta, v] : [conta, rot(RESULTADO_EXERCICIO), -v]);
        }
    });
    if (resultado > 0) linhas.push([rot(RESULTADO_EXERCICIO), rot(RESULTADO_ACUMULADO), resultado]);
    if (resultado < 0) linhas.push([rot(RESULTADO_ACUMULADO), rot(RESULTADO_EXERCICIO), -resultado]);

    let n = 0;
    for (const [deb, cred, valor] of linhas) {
        n += 1;
        const historico = deb.startsWith(RESULTADO_EXERCICIO) && cred.startsWith(RESULTADO_ACUMULADO)
            || deb.startsWith(RESULTADO_ACUMULADO)
            ? `Apropriação do resultado do exercício de ${ano}`
            : `Encerramento do exercício de ${ano} - apuração do resultado`;
        await pool.query(
            `INSERT INTO contabilidade_lancamentos
                (id, igreja_id, data_lancamento, historico, conta_debito, conta_credito, valor, origem, exercicio, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'encerramento', ?, ?)`,
            [`enc-${igrejaId}-${ano}-${n}-${Date.now().toString(36)}`, igrejaId, data, historico, deb, cred, valor, ano, usuario.id || null]
        );
    }
    await pool.query(
        `INSERT INTO contabilidade_encerramentos (id, igreja_id, usuario_nome, observacao, created_by, ano, resultado, sem_movimento)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`ce-${igrejaId}-${ano}`, igrejaId, usuario.nome || 'Usuário', `Encerramento do exercício de ${ano}`, usuario.id || null,
            ano, resultado, semMovimento ? 1 : 0]
    );
    return { ano: Number(ano), resultado, lancamentos: linhas.length };
}

async function reabrir(igrejaId, { ano }) {
    const fechado = await exercicio.ultimoFechado(igrejaId);
    if (!fechado || Number(ano) !== fechado) throw createHttpError(400, fechado ? `Só o último exercício encerrado (${fechado}) pode ser reaberto.` : 'Nenhum exercício encerrado.');
    await pool.query("DELETE FROM contabilidade_lancamentos WHERE igreja_id = ? AND origem = 'encerramento' AND exercicio = ?", [igrejaId, fechado]);
    await pool.query('DELETE FROM contabilidade_encerramentos WHERE igreja_id = ? AND ano = ?', [igrejaId, fechado]);
}

module.exports = {
    PLANO_PADRAO, CONTA_CAIXA, codigoDe, naturezaDe, cmpCodigo,
    ensure, garantirPlano, carregarPlano, listarPlano, criarConta, atualizarConta, excluirConta,
    carregarLancamentos, listarLancamentos, getLancamento, criarLancamento, atualizarLancamento, excluirLancamento,
    balanceteAbertura, aberturaTesouraria, aberturaManual, salvarSaldoAbertura, ajustarResultadoAcumulado,
    estadoEncerramento, encerrar, reabrir
};
