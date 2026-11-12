'use strict';

/**
 * Relatórios e gráficos (Lote 3).
 * Somente leitura. Toda query filtra por igreja_id (vindo de req.auth.igrejaId).
 * A agregação é feita em JS para não depender de funções de data específicas
 * do MySQL 5.6 / SQLite / Postgres e para tolerar formatos de data diferentes
 * (membros.nascimento é VARCHAR: 'YYYY-MM-DD' ou 'DD/MM/YYYY').
 */

const { pool } = require('../config/db');

// ─── Utilitários ────────────────────────────────────────────────────────────

async function safeQuery(sql, params = []) {
    try {
        const [rows] = await pool.query(sql, params);
        return Array.isArray(rows) ? rows : [];
    } catch (err) {
        // Tabela/coluna ainda não criada nesta instalação → relatório vazio, não erro 500.
        if (/doesn't exist|no such table|does not exist|Unknown column|no such column/i.test(String(err && err.message))) {
            return [];
        }
        throw err;
    }
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Converte Date | 'YYYY-MM-DD[...]' | 'DD/MM/YYYY' em 'YYYY-MM-DD' (ou null). */
function toISODate(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return null;
        return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
    }
    const s = String(value).trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${pad2(m[2])}-${pad2(m[1])}`;
    return null;
}

function idade(isoNascimento, ref = new Date()) {
    if (!isoNascimento) return null;
    const [y, mo, d] = isoNascimento.split('-').map(Number);
    if (!y || y < 1900) return null;
    let age = ref.getFullYear() - y;
    const mm = ref.getMonth() + 1;
    if (mm < mo || (mm === mo && ref.getDate() < d)) age -= 1;
    return age >= 0 && age < 130 ? age : null;
}

function faixaEtaria(age) {
    if (age === null || age === undefined) return 'Não informado';
    if (age <= 11) return 'Crianças (0-11)';
    if (age <= 17) return 'Adolescentes (12-17)';
    if (age <= 29) return 'Jovens (18-29)';
    if (age <= 59) return 'Adultos (30-59)';
    return 'Idosos (60+)';
}
const ORDEM_FAIXAS = ['Crianças (0-11)', 'Adolescentes (12-17)', 'Jovens (18-29)', 'Adultos (30-59)', 'Idosos (60+)', 'Não informado'];

function normSexo(v) {
    const s = String(v || '').trim().toLowerCase();
    if (s === 'm' || s.startsWith('masc')) return 'Masculino';
    if (s === 'f' || s.startsWith('fem')) return 'Feminino';
    return 'Não informado';
}

function normTexto(v) {
    const s = String(v || '').trim();
    if (!s) return 'Não informado';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function contar(items, keyFn, ordem) {
    const map = new Map();
    for (const it of items) {
        const k = keyFn(it);
        map.set(k, (map.get(k) || 0) + 1);
    }
    let arr = [...map.entries()].map(([label, valor]) => ({ label, valor }));
    if (ordem) {
        arr = ordem.filter((o) => map.has(o)).map((o) => ({ label: o, valor: map.get(o) }));
    } else {
        arr.sort((a, b) => b.valor - a.valor || a.label.localeCompare(b.label));
    }
    return arr;
}

function inRange(iso, inicio, fim) {
    if (!iso) return !inicio && !fim;
    if (inicio && iso < inicio) return false;
    if (fim && iso > fim) return false;
    return true;
}

function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

function round2(n) { return Math.round(n * 100) / 100; }

/** 'MM/YYYY' → { ano, mes } */
function parseCompetencia(c) {
    const m = String(c || '').match(/^(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    return { mes: Number(m[1]), ano: Number(m[2]) };
}

// ─── Pessoas (normalização das 4 tabelas) ───────────────────────────────────

async function carregarPessoas(igrejaId, tipo) {
    if (tipo === 'membros') {
        const rows = await safeQuery('SELECT * FROM membros WHERE igreja_id = ?', [igrejaId]);
        return rows.map((r) => {
            const nasc = toISODate(r.data_nascimento) || toISODate(r.nascimento);
            return {
                id: r.id, tipo: 'Membro', nome: r.nome, sexo: normSexo(r.sexo),
                nascimento: nasc, idade: idade(nasc),
                estadoCivil: normTexto(r.estado_civil), situacao: normTexto(r.situacao || 'Ativo'),
                cargo: normTexto(r.cargo), telefone: r.celular || r.telefone || '', email: r.email || '',
                endereco: [r.endereco, r.numero].filter(Boolean).join(', '), bairro: r.bairro || '', cidade: r.cidade || '',
                cadastro: toISODate(r.created_at)
            };
        });
    }
    if (tipo === 'visitantes') {
        const rows = await safeQuery('SELECT * FROM visitantes WHERE igreja_id = ?', [igrejaId]);
        return rows.map((r) => {
            const nasc = toISODate(r.birth_date);
            return {
                id: r.id, tipo: 'Visitante', nome: r.full_name, sexo: normSexo(r.gender),
                nascimento: nasc, idade: idade(nasc), estadoCivil: normTexto(r.civil_status),
                situacao: 'Visitante', cargo: '', telefone: r.mobile_phone || r.phone || '', email: r.email || '',
                endereco: [r.address, r.number].filter(Boolean).join(', '), bairro: r.neighborhood || '', cidade: r.city || '',
                cadastro: toISODate(r.visit_date) || toISODate(r.created_at)
            };
        });
    }
    if (tipo === 'congregados') {
        const rows = await safeQuery('SELECT * FROM congregados WHERE igreja_id = ?', [igrejaId]);
        return rows.map((r) => {
            const nasc = toISODate(r.nascimento);
            return {
                id: r.id, tipo: 'Congregado', nome: r.nome, sexo: normSexo(r.sexo),
                nascimento: nasc, idade: idade(nasc), estadoCivil: normTexto(r.estado_civil),
                situacao: 'Congregado', cargo: '', telefone: r.celular || r.telefone || '', email: r.email || '',
                endereco: [r.endereco, r.numero].filter(Boolean).join(', '), bairro: r.bairro || '', cidade: r.cidade || '',
                cadastro: toISODate(r.data_cadastro) || toISODate(r.created_at)
            };
        });
    }
    if (tipo === 'criancas') {
        const rows = await safeQuery('SELECT * FROM criancas WHERE igreja_id = ?', [igrejaId]);
        return rows.map((r) => {
            const nasc = toISODate(r.nascimento);
            return {
                id: r.id, tipo: 'Criança', nome: r.nome, sexo: normSexo(r.sexo),
                nascimento: nasc, idade: idade(nasc), estadoCivil: '',
                situacao: normTexto(r.situacao || 'Ativo'), cargo: '',
                responsaveis: [r.nome_pai || r.pai, r.nome_mae || r.mae].filter(Boolean).join(' / '),
                apresentacao: toISODate(r.apresentacao),
                telefone: r.celular || r.telefone || '', email: r.email || '',
                endereco: [r.endereco, r.numero].filter(Boolean).join(', '), bairro: r.bairro || '', cidade: r.cidade || '',
                cadastro: toISODate(r.created_at)
            };
        });
    }
    return [];
}

const TIPOS_PESSOA = ['membros', 'visitantes', 'congregados', 'criancas'];

// ─── Secretaria ─────────────────────────────────────────────────────────────

async function secretariaResumo(igrejaId, { inicio, fim, situacao } = {}) {
    const [membros, visitantes, congregados, criancas, grupos, batismos] = await Promise.all([
        carregarPessoas(igrejaId, 'membros'),
        carregarPessoas(igrejaId, 'visitantes'),
        carregarPessoas(igrejaId, 'congregados'),
        carregarPessoas(igrejaId, 'criancas'),
        safeQuery("SELECT id FROM grupos WHERE igreja_id = ? AND situacao = 'Ativo'", [igrejaId]),
        safeQuery('SELECT data_batismo, total_batizados, id FROM batismos WHERE igreja_id = ?', [igrejaId])
    ]);

    const base = situacao ? membros.filter((m) => m.situacao.toLowerCase() === String(situacao).toLowerCase()) : membros;

    // batizados no período: candidatos confirmados (ou total_batizados quando não há candidatos)
    const batismosPeriodo = batismos.filter((b) => inRange(toISODate(b.data_batismo), inicio, fim));
    let batizados = 0;
    if (batismosPeriodo.length) {
        const ids = batismosPeriodo.map((b) => b.id);
        const cand = await safeQuery(
            `SELECT batismo_id, COUNT(*) AS total FROM batismo_candidatos
             WHERE igreja_id = ? AND status = 'Confirmado' AND batismo_id IN (${ids.map(() => '?').join(',')})
             GROUP BY batismo_id`,
            [igrejaId, ...ids]
        );
        const porId = new Map(cand.map((c) => [c.batismo_id, num(c.total)]));
        batizados = batismosPeriodo.reduce((s, b) => s + (porId.get(b.id) || num(b.total_batizados)), 0);
    }

    // crescimento: últimos 12 meses até "fim" (ou hoje)
    const ref = fim ? new Date(`${fim}T12:00:00`) : new Date();
    const meses = [];
    for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
        meses.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}`);
    }
    const porMes = (lista) => meses.map((mes) => lista.filter((p) => p.cadastro && p.cadastro.startsWith(mes)).length);

    return {
        periodo: { inicio: inicio || null, fim: fim || null },
        kpis: {
            membrosTotal: membros.length,
            membrosAtivos: membros.filter((m) => m.situacao.toLowerCase() === 'ativo').length,
            novosMembros: membros.filter((m) => inRange(m.cadastro, inicio, fim)).length,
            visitantesPeriodo: visitantes.filter((v) => inRange(v.cadastro, inicio, fim)).length,
            congregados: congregados.length,
            criancas: criancas.length,
            batizados,
            gruposAtivos: grupos.length
        },
        distribuicoes: {
            sexo: contar(base, (m) => m.sexo, ['Masculino', 'Feminino', 'Não informado']),
            estadoCivil: contar(base, (m) => m.estadoCivil),
            situacao: contar(membros, (m) => m.situacao),
            cargo: contar(base.filter((m) => m.cargo !== 'Não informado'), (m) => m.cargo).slice(0, 15),
            faixaEtaria: contar(base, (m) => faixaEtaria(m.idade), ORDEM_FAIXAS),
            cidade: contar(base.filter((m) => m.cidade), (m) => normTexto(m.cidade)).slice(0, 10)
        },
        crescimento: { meses, membros: porMes(membros), visitantes: porMes(visitantes) }
    };
}

async function secretariaLista(igrejaId, { tipo = 'membros', inicio, fim, situacao, sexo } = {}) {
    if (!TIPOS_PESSOA.includes(tipo)) return [];
    let rows = await carregarPessoas(igrejaId, tipo);
    if (inicio || fim) rows = rows.filter((p) => inRange(p.cadastro, inicio, fim));
    if (situacao) rows = rows.filter((p) => p.situacao.toLowerCase() === String(situacao).toLowerCase());
    if (sexo) rows = rows.filter((p) => p.sexo === sexo);
    rows.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
    return rows;
}

async function secretariaAniversariantes(igrejaId, { mes, tipo = 'todos' } = {}) {
    const m = Number(mes) || new Date().getMonth() + 1;
    const tipos = tipo === 'todos' ? TIPOS_PESSOA : [tipo].filter((t) => TIPOS_PESSOA.includes(t));
    const listas = await Promise.all(tipos.map((t) => carregarPessoas(igrejaId, t)));
    const anoAtual = new Date().getFullYear();
    const rows = [];
    for (const p of listas.flat()) {
        if (!p.nascimento) continue;
        const [y, mo, d] = p.nascimento.split('-').map(Number);
        if (mo !== m) continue;
        rows.push({
            dia: d, nome: p.nome, tipo: p.tipo, nascimento: p.nascimento,
            completa: y > 1900 ? anoAtual - y : null, telefone: p.telefone, situacao: p.situacao
        });
    }
    rows.sort((a, b) => a.dia - b.dia || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return rows;
}

async function secretariaBatizados(igrejaId, { inicio, fim } = {}) {
    const batismos = (await safeQuery('SELECT * FROM batismos WHERE igreja_id = ?', [igrejaId]))
        .map((b) => ({ ...b, data: toISODate(b.data_batismo) }))
        .filter((b) => inRange(b.data, inicio, fim));
    if (!batismos.length) return [];
    const ids = batismos.map((b) => b.id);
    const cands = await safeQuery(
        `SELECT * FROM batismo_candidatos WHERE igreja_id = ? AND batismo_id IN (${ids.map(() => '?').join(',')})`,
        [igrejaId, ...ids]
    );
    const rows = [];
    for (const b of batismos) {
        const lista = cands.filter((c) => c.batismo_id === b.id);
        if (!lista.length) {
            rows.push({ data: b.data, cerimonia: b.descricao, local: b.local_batismo || '', pastor: b.pastor || '',
                nome: `(${num(b.total_batizados)} batizado(s) — sem lista nominal)`, telefone: '', status: '' });
            continue;
        }
        for (const c of lista) {
            rows.push({ data: b.data, cerimonia: b.descricao, local: b.local_batismo || '', pastor: b.pastor || '',
                nome: c.nome, telefone: c.telefone || '', status: c.status });
        }
    }
    rows.sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return rows;
}

async function secretariaGrupos(igrejaId, { inicio, fim } = {}) {
    const [grupos, gm, reunioes, membros] = await Promise.all([
        safeQuery('SELECT * FROM grupos WHERE igreja_id = ?', [igrejaId]),
        safeQuery('SELECT * FROM grupo_membros WHERE igreja_id = ?', [igrejaId]),
        safeQuery('SELECT * FROM grupo_reunioes WHERE igreja_id = ?', [igrejaId]),
        carregarPessoas(igrejaId, 'membros')
    ]);
    const membrosPorId = new Map(membros.map((m) => [m.id, m]));

    const resumo = grupos.map((g) => {
        const participantes = gm.filter((p) => p.grupo_id === g.id);
        const reun = reunioes
            .map((r) => ({ ...r, data: toISODate(r.data) }))
            .filter((r) => r.grupo_id === g.id && inRange(r.data, inicio, fim));
        const presencas = reun.reduce((s, r) => s + num(r.presentes), 0);
        const faixas = {};
        for (const p of participantes) {
            const m = p.membro_id ? membrosPorId.get(p.membro_id) : null;
            const f = faixaEtaria(m ? m.idade : null);
            faixas[f] = (faixas[f] || 0) + 1;
        }
        return {
            id: g.id, nome: g.nome, categoria: g.categoria || '', situacao: g.situacao || '',
            lider: g.lider || '', colider: g.colider || '', telefoneLider: g.telefone_lider || '',
            diaSemana: g.dia_semana || '', horario: g.horario || '', local: g.local || '',
            participantes: participantes.length,
            reunioes: reun.length,
            mediaPresentes: reun.length ? round2(presencas / reun.length) : 0,
            ultimaReuniao: reun.map((r) => r.data).filter(Boolean).sort().pop() || null,
            faixas,
            membros: participantes
                .map((p) => {
                    const m = p.membro_id ? membrosPorId.get(p.membro_id) : null;
                    return { nome: p.nome, funcao: p.funcao || '', desde: toISODate(p.desde),
                        telefone: m ? m.telefone : '', idade: m ? m.idade : null };
                })
                .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        };
    });
    resumo.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    return { grupos: resumo, faixasOrdem: ORDEM_FAIXAS };
}

// ─── Tesouraria ─────────────────────────────────────────────────────────────

async function carregarMovimentos(igrejaId, inicio, fim) {
    const [caixa, banco, contas, contasBanco] = await Promise.all([
        safeQuery('SELECT * FROM caixa_lancamentos WHERE igreja_id = ? AND data >= ? AND data <= ?', [igrejaId, inicio, fim]),
        safeQuery('SELECT * FROM banco_lancamentos WHERE igreja_id = ? AND data_lancamento >= ? AND data_lancamento <= ?', [igrejaId, inicio, fim]),
        safeQuery("SELECT * FROM contas_pagar WHERE igreja_id = ? AND status = 'pago' AND data_pagamento >= ? AND data_pagamento <= ?", [igrejaId, inicio, fim]),
        safeQuery('SELECT id, nome, banco FROM banco_contas WHERE igreja_id = ?', [igrejaId])
    ]);
    const nomeConta = new Map(contasBanco.map((c) => [c.id, c.nome || c.banco || `Conta ${c.id}`]));
    const mov = [];
    // Lote 5: vínculos (centro de custo / fornecedor) — colunas podem não existir em instalações antigas
    const vinc = (r) => ({ centroCustoId: r.centro_custo_id || null, fornecedorId: r.fornecedor_id || null });
    for (const r of caixa) {
        const ent = String(r.tipo).toUpperCase() === 'ENTRADA';
        mov.push({ data: toISODate(r.data), fonte: 'Caixa', descricao: r.historico, doc: r.doc || '',
            entrada: ent ? num(r.valor) : 0, saida: ent ? 0 : num(r.valor), ...vinc(r) });
    }
    for (const r of banco) {
        const ent = String(r.tipo).toLowerCase() === 'entrada';
        mov.push({ data: toISODate(r.data_lancamento), fonte: `Banco: ${nomeConta.get(r.conta_id) || r.conta_id}`, contaId: r.conta_id,
            descricao: r.descricao, doc: '', entrada: ent ? num(r.valor) : 0, saida: ent ? 0 : num(r.valor), ...vinc(r) });
    }
    for (const r of contas) {
        mov.push({ data: toISODate(r.data_pagamento), fonte: 'Contas a Pagar', descricao: [r.descricao, r.fornecedor].filter(Boolean).join(' — '),
            doc: r.categoria || '', entrada: 0, saida: num(r.valor), ...vinc(r), fornecedorTexto: r.fornecedor || '' });
    }
    return mov;
}

/** Nomes dos cadastros auxiliares (Lote 5) por id. */
async function carregarCadastros(igrejaId) {
    const [centros, fornecedores] = await Promise.all([
        safeQuery('SELECT id, codigo, nome FROM centros_custo WHERE igreja_id = ?', [igrejaId]),
        safeQuery('SELECT id, nome FROM fornecedores WHERE igreja_id = ?', [igrejaId])
    ]);
    return {
        centro: new Map(centros.map((c) => [c.id, c.codigo ? `${c.codigo} - ${c.nome}` : c.nome])),
        fornecedor: new Map(fornecedores.map((f) => [f.id, f.nome]))
    };
}

/**
 * Lote 5 — Despesas/receitas agrupadas por centro de custo ou por fornecedor.
 * agrupar: 'centro' | 'fornecedor'
 */
async function tesourariaPorCentro(igrejaId, { inicio, fim, agrupar = 'centro' } = {}) {
    const hoje = toISODate(new Date());
    const ini = inicio || `${hoje.slice(0, 4)}-01-01`;
    const fi = fim || hoje;
    const [mov, cad] = await Promise.all([carregarMovimentos(igrejaId, ini, fi), carregarCadastros(igrejaId)]);
    const grupos = new Map();
    for (const m of mov) {
        let nome;
        if (agrupar === 'fornecedor') {
            if (m.entrada > 0 && !m.fornecedorId) continue; // entrada sem fornecedor não é despesa de fornecedor
            nome = (m.fornecedorId && cad.fornecedor.get(m.fornecedorId)) || m.fornecedorTexto || 'Sem fornecedor';
        } else {
            nome = (m.centroCustoId && cad.centro.get(m.centroCustoId)) || 'Sem centro de custo';
        }
        const g = grupos.get(nome) || { nome, entradas: 0, saidas: 0, lancamentos: [] };
        g.entradas += m.entrada;
        g.saidas += m.saida;
        g.lancamentos.push({ data: m.data, fonte: m.fonte, descricao: m.descricao, entrada: m.entrada, saida: m.saida });
        grupos.set(nome, g);
    }
    const semNome = agrupar === 'fornecedor' ? 'Sem fornecedor' : 'Sem centro de custo';
    const lista = [...grupos.values()]
        .map((g) => ({ ...g, entradas: round2(g.entradas), saidas: round2(g.saidas), saldo: round2(g.entradas - g.saidas),
            lancamentos: g.lancamentos.sort((a, b) => String(a.data).localeCompare(String(b.data))) }))
        .sort((a, b) => (a.nome === semNome) - (b.nome === semNome) || b.saidas - a.saidas || a.nome.localeCompare(b.nome, 'pt-BR'));
    const totSaidas = round2(lista.reduce((s, g) => s + g.saidas, 0));
    lista.forEach((g) => { g.percentual = totSaidas ? round2((g.saidas / totSaidas) * 100) : 0; });
    return {
        inicio: ini, fim: fi, agrupar, grupos: lista,
        totais: { entradas: round2(lista.reduce((s, g) => s + g.entradas, 0)), saidas: totSaidas }
    };
}

async function carregarDizimosAno(igrejaId, ano) {
    const rows = await safeQuery('SELECT * FROM dizimos WHERE igreja_id = ? AND competencia LIKE ?', [igrejaId, `%/${ano}`]);
    return rows
        .map((r) => ({ ...r, comp: parseCompetencia(r.competencia), valor: num(r.valor) }))
        .filter((r) => r.comp && r.comp.ano === Number(ano));
}

async function tesourariaAnual(igrejaId, { ano } = {}) {
    const y = Number(ano) || new Date().getFullYear();
    const [dizimos, mov, membros] = await Promise.all([
        carregarDizimosAno(igrejaId, y),
        carregarMovimentos(igrejaId, `${y}-01-01`, `${y}-12-31`),
        carregarPessoas(igrejaId, 'membros')
    ]);
    const ativos = membros.filter((m) => m.situacao.toLowerCase() === 'ativo').length;

    const meses = Array.from({ length: 12 }, (_, i) => ({
        mes: i + 1,
        dizimos: 0, ofertas: 0, missoes: 0, outros: 0,
        caixaEntrada: 0, bancoEntrada: 0,
        caixaSaida: 0, bancoSaida: 0, contasPagas: 0,
        dizimistas: 0
    }));
    const dizimistasMes = Array.from({ length: 12 }, () => new Set());

    for (const d of dizimos) {
        const m = meses[d.comp.mes - 1];
        const t = String(d.tipo || 'dizimo').toLowerCase();
        if (t === 'dizimo') {
            m.dizimos += d.valor;
            dizimistasMes[d.comp.mes - 1].add(d.membro_id ? `id:${d.membro_id}` : `n:${String(d.membro_nome).trim().toLowerCase()}`);
        } else if (t === 'oferta') m.ofertas += d.valor;
        else if (t === 'missoes') m.missoes += d.valor;
        else m.outros += d.valor;
    }
    for (const x of mov) {
        if (!x.data) continue;
        const m = meses[Number(x.data.slice(5, 7)) - 1];
        if (!m) continue;
        if (x.fonte === 'Caixa') { m.caixaEntrada += x.entrada; m.caixaSaida += x.saida; }
        else if (x.fonte === 'Contas a Pagar') m.contasPagas += x.saida;
        else { m.bancoEntrada += x.entrada; m.bancoSaida += x.saida; }
    }

    const todosDizimistas = new Set();
    meses.forEach((m, i) => {
        m.dizimistas = dizimistasMes[i].size;
        dizimistasMes[i].forEach((k) => todosDizimistas.add(k));
        m.contribuicoes = round2(m.dizimos + m.ofertas + m.missoes + m.outros);
        m.receita = round2(m.contribuicoes + m.caixaEntrada + m.bancoEntrada);
        m.despesa = round2(m.caixaSaida + m.bancoSaida + m.contasPagas);
        m.saldo = round2(m.receita - m.despesa);
        m.perCapitaMembro = ativos ? round2(m.dizimos / ativos) : 0;
        m.mediaPorDizimista = m.dizimistas ? round2(m.dizimos / m.dizimistas) : 0;
        for (const k of Object.keys(m)) if (typeof m[k] === 'number' && k !== 'mes') m[k] = round2(m[k]);
    });

    const soma = (k) => round2(meses.reduce((s, m) => s + m[k], 0));
    const totais = {};
    ['dizimos', 'ofertas', 'missoes', 'outros', 'contribuicoes', 'caixaEntrada', 'bancoEntrada', 'caixaSaida', 'bancoSaida', 'contasPagas', 'receita', 'despesa', 'saldo']
        .forEach((k) => { totais[k] = soma(k); });
    totais.dizimistasUnicos = todosDizimistas.size;
    totais.membrosAtivos = ativos;
    totais.perCapitaAnual = ativos ? round2(totais.dizimos / ativos) : 0;

    return { ano: y, meses, totais };
}

async function tesourariaDizimistas(igrejaId, { ano, tipo = 'dizimo' } = {}) {
    const y = Number(ano) || new Date().getFullYear();
    let rows = await carregarDizimosAno(igrejaId, y);
    if (tipo && tipo !== 'todos') rows = rows.filter((r) => String(r.tipo || 'dizimo').toLowerCase() === tipo);
    const map = new Map();
    for (const r of rows) {
        const key = r.membro_id ? `id:${r.membro_id}` : `n:${String(r.membro_nome).trim().toLowerCase()}`;
        if (!map.has(key)) map.set(key, { membroId: r.membro_id || null, nome: r.membro_nome, meses: Array(12).fill(0), total: 0, lancamentos: [] });
        const it = map.get(key);
        it.meses[r.comp.mes - 1] = round2(it.meses[r.comp.mes - 1] + r.valor);
        it.total = round2(it.total + r.valor);
        it.lancamentos.push({ competencia: r.competencia, tipo: r.tipo, valor: r.valor, observacao: r.observacao || '', lancadoEm: toISODate(r.created_at) });
    }
    const lista = [...map.values()].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    const totaisMes = Array(12).fill(0).map((_, i) => round2(lista.reduce((s, x) => s + x.meses[i], 0)));
    return { ano: y, tipo, dizimistas: lista, totaisMes, total: round2(totaisMes.reduce((s, v) => s + v, 0)) };
}

async function tesourariaMovimento(igrejaId, { inicio, fim, fonte = 'caixa', contaId } = {}) {
    const hoje = toISODate(new Date());
    const ini = inicio || `${hoje.slice(0, 7)}-01`;
    const fi = fim || hoje;

    if (fonte === 'dizimos') {
        // Dízimos/ofertas cuja competência cai dentro do período (por mês)
        const anos = [];
        for (let a = Number(ini.slice(0, 4)); a <= Number(fi.slice(0, 4)); a += 1) anos.push(a);
        const todos = (await Promise.all(anos.map((a) => carregarDizimosAno(igrejaId, a)))).flat();
        const iniM = ini.slice(0, 7);
        const fimM = fi.slice(0, 7);
        const rows = todos
            .map((r) => ({ mes: `${r.comp.ano}-${pad2(r.comp.mes)}`, r }))
            .filter((x) => x.mes >= iniM && x.mes <= fimM)
            .map(({ r }) => ({ data: toISODate(r.created_at), competencia: r.competencia, fonte: 'Dízimos', descricao: r.membro_nome,
                doc: String(r.tipo || 'dizimo'), entrada: r.valor, saida: 0 }))
            .sort((a, b) => String(a.competencia).split('/').reverse().join('').localeCompare(String(b.competencia).split('/').reverse().join(''))
                || String(a.descricao).localeCompare(String(b.descricao), 'pt-BR'));
        const porTipo = {};
        rows.forEach((r) => { porTipo[r.doc] = round2((porTipo[r.doc] || 0) + r.entrada); });
        return { inicio: ini, fim: fi, fonte, saldoAnterior: 0, rows, totais: { entrada: round2(rows.reduce((s, r) => s + r.entrada, 0)), saida: 0 }, porTipo };
    }

    let rows = await carregarMovimentos(igrejaId, ini, fi);
    let saldoAnterior = 0;
    if (fonte === 'caixa') {
        rows = rows.filter((r) => r.fonte === 'Caixa');
        const ant = await safeQuery(
            "SELECT tipo, SUM(valor) AS total FROM caixa_lancamentos WHERE igreja_id = ? AND data < ? GROUP BY tipo", [igrejaId, ini]);
        saldoAnterior = ant.reduce((s, r) => s + (String(r.tipo).toUpperCase() === 'ENTRADA' ? num(r.total) : -num(r.total)), 0);
    } else if (fonte === 'banco') {
        rows = rows.filter((r) => r.fonte.startsWith('Banco') && (!contaId || String(r.contaId) === String(contaId)));
        const contas = await safeQuery('SELECT id, saldo_inicial FROM banco_contas WHERE igreja_id = ?', [igrejaId]);
        const alvo = contaId ? contas.filter((c) => String(c.id) === String(contaId)) : contas;
        saldoAnterior = alvo.reduce((s, c) => s + num(c.saldo_inicial), 0);
        const params = [igrejaId, ini];
        let extra = '';
        if (contaId) { extra = ' AND conta_id = ?'; params.push(contaId); }
        const ant = await safeQuery(
            `SELECT tipo, SUM(valor) AS total FROM banco_lancamentos WHERE igreja_id = ? AND data_lancamento < ?${extra} GROUP BY tipo`, params);
        saldoAnterior += ant.reduce((s, r) => s + (String(r.tipo).toLowerCase() === 'entrada' ? num(r.total) : -num(r.total)), 0);
    } else if (fonte === 'contas') {
        rows = rows.filter((r) => r.fonte === 'Contas a Pagar');
    } // fonte === 'geral' → tudo

    rows.sort((a, b) => String(a.data).localeCompare(String(b.data)));
    let saldo = round2(saldoAnterior);
    for (const r of rows) { saldo = round2(saldo + r.entrada - r.saida); r.saldo = saldo; }
    return {
        inicio: ini, fim: fi, fonte, saldoAnterior: round2(saldoAnterior), rows,
        totais: { entrada: round2(rows.reduce((s, r) => s + r.entrada, 0)), saida: round2(rows.reduce((s, r) => s + r.saida, 0)), saldoFinal: saldo }
    };
}

async function tesourariaContasPagar(igrejaId, { inicio, fim, status, centroCustoId } = {}) {
    const params = [igrejaId];
    let where = 'igreja_id = ?';
    if (inicio) { where += ' AND vencimento >= ?'; params.push(inicio); }
    if (fim) { where += ' AND vencimento <= ?'; params.push(fim); }
    const [lista, cad, tipos] = await Promise.all([
        safeQuery(`SELECT * FROM contas_pagar WHERE ${where} ORDER BY vencimento ASC`, params),
        carregarCadastros(igrejaId),
        safeQuery('SELECT id, nome FROM tipos_documento WHERE igreja_id = ?', [igrejaId])
    ]);
    const nomeTipo = new Map(tipos.map((t) => [t.id, t.nome]));
    const hoje = toISODate(new Date());
    let rows = lista.map((r) => {
        const venc = toISODate(r.vencimento);
        // 'vencido' pode estar gravado no banco (markVencidas) ou ainda como 'pendente' com data passada
        const st = r.status === 'pendente' && venc && venc < hoje ? 'vencido' : r.status;
        return { descricao: r.descricao, fornecedor: (r.fornecedor_id && cad.fornecedor.get(r.fornecedor_id)) || r.fornecedor || '',
            categoria: r.categoria || '', centroCusto: (r.centro_custo_id && cad.centro.get(r.centro_custo_id)) || '', centroCustoId: r.centro_custo_id || null,
            documento: [r.tipo_documento_id && nomeTipo.get(r.tipo_documento_id), r.numero_documento].filter(Boolean).join(' nº '),
            vencimento: venc, valor: num(r.valor), status: st, pagamento: toISODate(r.data_pagamento) };
    });
    if (status) rows = rows.filter((r) => r.status === status);
    if (centroCustoId) rows = rows.filter((r) => String(r.centroCustoId) === String(centroCustoId));
    const tot = (st) => round2(rows.filter((r) => r.status === st).reduce((s, r) => s + r.valor, 0));
    return { rows, totais: { total: round2(rows.reduce((s, r) => s + r.valor, 0)), pago: tot('pago'), pendente: tot('pendente'), vencido: tot('vencido'), cancelado: tot('cancelado') } };
}

async function tesourariaContasBancarias(igrejaId) {
    return safeQuery('SELECT id, nome, banco, agencia, conta FROM banco_contas WHERE igreja_id = ? ORDER BY nome', [igrejaId]);
}

module.exports = {
    secretariaResumo,
    secretariaLista,
    secretariaAniversariantes,
    secretariaBatizados,
    secretariaGrupos,
    tesourariaAnual,
    tesourariaDizimistas,
    tesourariaMovimento,
    tesourariaContasPagar,
    tesourariaContasBancarias,
    tesourariaPorCentro,
    carregarCadastros,
    // exportados para teste
    _internals: { toISODate, idade, faixaEtaria, normSexo, parseCompetencia }
};
