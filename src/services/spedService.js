/**
 * SPED Contábil da igreja.
 *
 * - ECD (Escrituração Contábil Digital), leiaute 9: gera o arquivo TXT com Bloco 0, C, I (plano de
 *   contas, saldos mensais, lançamentos, saldos antes do encerramento), J (balanço, DRE, termos e
 *   signatários), K e 9, a partir da contabilidade do sistema (manual + Tesouraria + encerramento).
 *   O arquivo é importado no PVA da Receita, validado, assinado com certificado digital e transmitido.
 * - ECF: confere os pré-requisitos e monta a ficha (balanço, DRE, dirigentes). A ECF é preenchida no
 *   PVA da ECF recuperando o arquivo da ECD.
 * - Dirigentes e conselheiros: também são os signatários da ECD (registro J930).
 */
const crypto = require('crypto');
const { pool } = require('../config/db');
const contabil = require('./contabilService');
const exercicio = require('../models/exercicioContabilModel');
const { createHttpError } = require('../utils/httpError');

const LEIAUTE_ECD = '9.00';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const iso = exercicio.isoData;
const devedora = (nat) => nat === 'ativo' || nat === 'despesa';
const soDigitos = (v) => String(v || '').replace(/\D/g, '');

// Qualificação dos signatários (tabela de qualificação do assinante da ECD)
const QUALIFICACOES = {
    203: 'Diretor',
    204: 'Conselheiro de Administração',
    205: 'Administrador',
    206: 'Administrador do Grupo',
    207: 'Administrador de Sociedade Filiada',
    309: 'Procurador',
    900: 'Contador',
    910: 'Contador responsável pelo Termo de Verificação para fins de substituição da ECD',
    999: 'Outros'
};

// Plano referencial (0000.COD_PLAN_REF)
const PLANOS_REFERENCIAIS = {
    1: 'PJ em geral - Lucro Real',
    2: 'PJ em geral - Lucro Presumido',
    3: 'Financeiras - Lucro Real',
    4: 'Seguradoras - Lucro Real',
    5: 'Imunes e isentas em geral',
    6: 'Imunes e isentas - Financeiras',
    7: 'Imunes e isentas - Seguradoras',
    8: 'Entidades fechadas de previdência complementar',
    9: 'Partidos políticos',
    10: 'Financeiras - Lucro Presumido'
};

const SITUACOES_ESPECIAIS = { '': 'Nenhuma', 1: 'Cisão', 2: 'Fusão', 3: 'Incorporação', 4: 'Extinção', 5: 'Transformação' };
const SITUACOES_INICIO = { 0: 'Normal (início no primeiro dia do ano)', 1: 'Abertura', 2: 'Resultante de cisão/fusão ou remanescente de cisão', 3: 'Início de obrigatoriedade da entrega no curso do ano' };

// ── Estrutura ────────────────────────────────────────────────────────────────
let pronto = false;
async function ensure() {
    await contabil.ensure();
    if (pronto) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_sped_config (
            igreja_id INTEGER PRIMARY KEY,
            dados LONGTEXT NULL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_dirigentes (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            nome VARCHAR(255) NOT NULL,
            cpf VARCHAR(14) NOT NULL,
            qualificacao INTEGER NOT NULL,
            cargo VARCHAR(120) NULL,
            email VARCHAR(255) NULL,
            telefone VARCHAR(30) NULL,
            crc VARCHAR(30) NULL,
            uf_crc VARCHAR(2) NULL,
            crc_seq VARCHAR(30) NULL,
            crc_validade DATE NULL,
            inicio_mandato DATE NULL,
            fim_mandato DATE NULL,
            remuneracao DECIMAL(14,2) NOT NULL DEFAULT 0,
            responsavel_legal INTEGER NOT NULL DEFAULT 0,
            assina_ecd INTEGER NOT NULL DEFAULT 1,
            ativo INTEGER NOT NULL DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_sped_arquivos (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            tipo VARCHAR(10) NOT NULL,
            ano INTEGER NOT NULL,
            num_livro INTEGER NULL,
            finalidade VARCHAR(1) NULL,
            dt_ini DATE NULL,
            dt_fin DATE NULL,
            linhas INTEGER NOT NULL DEFAULT 0,
            sha256 VARCHAR(64) NULL,
            conteudo LONGTEXT NULL,
            usuario_nome VARCHAR(255) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    try {
        await pool.query('ALTER TABLE contabilidade_plano_contas ADD COLUMN referencial VARCHAR(60) NULL');
    } catch (e) {
        if (!/duplicate column|already exists/i.test(String(e && e.message))) throw e;
    }
    pronto = true;
}

// ── Validações de documento ──────────────────────────────────────────────────
function cnpjValido(v) {
    const c = soDigitos(v);
    if (c.length !== 14 || /^(\d)\1+$/.test(c)) return false;
    const dv = (base) => {
        const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const s = base.split('').reduce((t, d, i) => t + Number(d) * pesos[i], 0);
        const r = s % 11;
        return r < 2 ? 0 : 11 - r;
    };
    const d1 = dv(c.slice(0, 12));
    const d2 = dv(c.slice(0, 12) + d1);
    return c.endsWith(`${d1}${d2}`);
}

function cpfValido(v) {
    const c = soDigitos(v);
    if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
    const dv = (base) => {
        const s = base.split('').reduce((t, d, i) => t + Number(d) * (base.length + 1 - i), 0);
        const r = (s * 10) % 11;
        return r === 10 ? 0 : r;
    };
    const d1 = dv(c.slice(0, 9));
    const d2 = dv(c.slice(0, 9) + d1);
    return c.endsWith(`${d1}${d2}`);
}

// ── Dados da entidade ────────────────────────────────────────────────────────
async function getConfig(igrejaId) {
    await ensure();
    let ig;
    try {
        [[ig]] = await pool.query('SELECT nome, cnpj, config_personalizada_json FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
    } catch (_) {
        // bancos antigos sem as colunas de perfil
        [[ig]] = await pool.query('SELECT nome FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
    }
    let perfil = {};
    try { perfil = JSON.parse((ig && ig.config_personalizada_json) || '{}') || {}; } catch (_) { perfil = {}; }
    const [rows] = await pool.query('SELECT dados FROM contabilidade_sped_config WHERE igreja_id = ? LIMIT 1', [igrejaId]);
    let salvo = {};
    try { salvo = JSON.parse((rows[0] && rows[0].dados) || '{}') || {}; } catch (_) { salvo = {}; }
    return {
        nome: (ig && ig.nome) || '',
        cnpj: soDigitos(perfil.cnpj || (ig && ig.cnpj) || ''),
        uf: String(perfil.estado || '').toUpperCase().slice(0, 2),
        municipio: perfil.cidade || '',
        codMun: '',
        ie: '',
        im: '',
        dtArq: '',
        dtArqConv: '',
        codPlanRef: '5',
        formaTributacao: 'imune',
        naturezaLivro: 'DIARIO GERAL',
        ...salvo
    };
}

async function salvarConfig(igrejaId, dados) {
    await ensure();
    const atual = await getConfig(igrejaId);
    const novo = { ...atual, ...dados };
    novo.cnpj = soDigitos(novo.cnpj);
    novo.codMun = soDigitos(novo.codMun);
    novo.uf = String(novo.uf || '').toUpperCase();
    if (novo.cnpj && !cnpjValido(novo.cnpj)) throw createHttpError(400, 'CNPJ inválido. Confira os números.');
    if (novo.codMun && novo.codMun.length !== 7) throw createHttpError(400, 'O código do município (IBGE) tem 7 dígitos.');
    const texto = JSON.stringify(novo);
    const [rows] = await pool.query('SELECT igreja_id FROM contabilidade_sped_config WHERE igreja_id = ? LIMIT 1', [igrejaId]);
    if (rows[0]) await pool.query('UPDATE contabilidade_sped_config SET dados = ? WHERE igreja_id = ?', [texto, igrejaId]);
    else await pool.query('INSERT INTO contabilidade_sped_config (igreja_id, dados) VALUES (?, ?)', [igrejaId, texto]);
    return novo;
}

// ── Dirigentes e conselheiros ────────────────────────────────────────────────
function mapDirigente(r) {
    return {
        id: r.id, nome: r.nome, cpf: r.cpf, qualificacao: Number(r.qualificacao),
        qualificacaoNome: QUALIFICACOES[Number(r.qualificacao)] || 'Outros', cargo: r.cargo || '',
        email: r.email || '', telefone: r.telefone || '', crc: r.crc || '', ufCrc: r.uf_crc || '',
        crcSeq: r.crc_seq || '', crcValidade: iso(r.crc_validade), inicioMandato: iso(r.inicio_mandato),
        fimMandato: iso(r.fim_mandato), remuneracao: r2(r.remuneracao), responsavelLegal: Number(r.responsavel_legal) === 1,
        assinaEcd: Number(r.assina_ecd) === 1, ativo: Number(r.ativo) !== 0
    };
}

async function listarDirigentes(igrejaId) {
    await ensure();
    const [rows] = await pool.query('SELECT * FROM contabilidade_dirigentes WHERE igreja_id = ? ORDER BY nome', [igrejaId]);
    return rows.map(mapDirigente);
}

function validarDirigente(d) {
    if (!cpfValido(d.cpf)) throw createHttpError(400, 'CPF inválido. Confira os números.');
    if (!QUALIFICACOES[Number(d.qualificacao)]) throw createHttpError(400, 'Escolha a qualificação.');
    if (Number(d.qualificacao) === 900 && (!d.crc || !d.ufCrc)) {
        throw createHttpError(400, 'Para o contador, informe o número do CRC e a UF do CRC.');
    }
    if (d.inicioMandato && d.fimMandato && d.fimMandato < d.inicioMandato) {
        throw createHttpError(400, 'O fim do mandato não pode ser antes do início.');
    }
}

function valoresDirigente(d) {
    return [
        String(d.nome).trim(), soDigitos(d.cpf), Number(d.qualificacao), d.cargo || null, d.email || null, d.telefone || null,
        d.crc || null, d.ufCrc ? String(d.ufCrc).toUpperCase() : null, d.crcSeq || null, d.crcValidade || null,
        d.inicioMandato || null, d.fimMandato || null, r2(d.remuneracao), d.responsavelLegal ? 1 : 0,
        d.assinaEcd === false ? 0 : 1, d.ativo === false ? 0 : 1
    ];
}

async function criarDirigente(igrejaId, d) {
    await ensure();
    validarDirigente(d);
    const [dup] = await pool.query('SELECT id FROM contabilidade_dirigentes WHERE igreja_id = ? AND cpf = ? LIMIT 1', [igrejaId, soDigitos(d.cpf)]);
    if (dup[0]) throw createHttpError(409, 'Já existe um dirigente com este CPF.');
    const id = `dg-${igrejaId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await pool.query(
        `INSERT INTO contabilidade_dirigentes (nome, cpf, qualificacao, cargo, email, telefone, crc, uf_crc, crc_seq, crc_validade,
            inicio_mandato, fim_mandato, remuneracao, responsavel_legal, assina_ecd, ativo, id, igreja_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...valoresDirigente(d), id, igrejaId]
    );
    return id;
}

async function atualizarDirigente(igrejaId, id, d) {
    await ensure();
    validarDirigente(d);
    const [ex] = await pool.query('SELECT id FROM contabilidade_dirigentes WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!ex[0]) throw createHttpError(404, 'Dirigente não encontrado.');
    const [dup] = await pool.query('SELECT id FROM contabilidade_dirigentes WHERE igreja_id = ? AND cpf = ? AND id <> ? LIMIT 1', [igrejaId, soDigitos(d.cpf), id]);
    if (dup[0]) throw createHttpError(409, 'Já existe um dirigente com este CPF.');
    await pool.query(
        `UPDATE contabilidade_dirigentes SET nome = ?, cpf = ?, qualificacao = ?, cargo = ?, email = ?, telefone = ?, crc = ?, uf_crc = ?,
            crc_seq = ?, crc_validade = ?, inicio_mandato = ?, fim_mandato = ?, remuneracao = ?, responsavel_legal = ?, assina_ecd = ?, ativo = ?
         WHERE id = ? AND igreja_id = ?`,
        [...valoresDirigente(d), id, igrejaId]
    );
}

async function excluirDirigente(igrejaId, id) {
    await ensure();
    const [ex] = await pool.query('SELECT id FROM contabilidade_dirigentes WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!ex[0]) throw createHttpError(404, 'Dirigente não encontrado.');
    await pool.query('DELETE FROM contabilidade_dirigentes WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
}

// ── Plano referencial ────────────────────────────────────────────────────────
async function listarReferencial(igrejaId) {
    await ensure();
    const plano = await contabil.carregarPlano(igrejaId);
    const [refs] = await pool.query('SELECT codigo, referencial FROM contabilidade_plano_contas WHERE igreja_id = ?', [igrejaId]);
    const mapa = new Map(refs.map((r) => [String(r.codigo).trim(), r.referencial || '']));
    return plano.filter((c) => c.tipo === 'A').map((c) => ({ codigo: c.codigo, nome: c.nome, natureza: c.natureza, ativo: c.ativo, referencial: mapa.get(c.codigo) || '' }));
}

async function salvarReferencial(igrejaId, itens) {
    await ensure();
    const plano = await contabil.carregarPlano(igrejaId);
    const analiticas = new Set(plano.filter((c) => c.tipo === 'A').map((c) => c.codigo));
    for (const { codigo, referencial } of itens) {
        if (!analiticas.has(String(codigo))) throw createHttpError(400, `A conta ${codigo} não é analítica.`);
        const ref = String(referencial || '').trim();
        if (ref && !/^[0-9A-Za-z.]{1,60}$/.test(ref)) throw createHttpError(400, `Código referencial inválido na conta ${codigo}.`);
        await pool.query('UPDATE contabilidade_plano_contas SET referencial = ? WHERE igreja_id = ? AND codigo = ?', [ref || null, igrejaId, codigo]);
    }
}

// Confere a estrutura do plano de contas para a ECD
async function validarPlano(igrejaId) {
    await ensure();
    const plano = await contabil.carregarPlano(igrejaId);
    const ref = await listarReferencial(igrejaId);
    const porCod = new Map(plano.map((c) => [c.codigo, c]));
    const erros = [];
    const avisos = [];
    const pai = (cod) => (cod.includes('.') ? cod.split('.').slice(0, -1).join('.') : null);
    plano.forEach((c) => {
        const p = pai(c.codigo);
        if (p && !porCod.has(p)) erros.push(`A conta ${c.codigo} não tem a conta superior ${p} no plano.`);
        if (p && porCod.get(p) && porCod.get(p).tipo !== 'S') erros.push(`A conta ${p} é analítica mas tem a subconta ${c.codigo}.`);
        if (!p && c.tipo !== 'S') erros.push(`A conta de nível 1 ${c.codigo} precisa ser sintética.`);
        if (!c.nome || c.nome.length < 2) erros.push(`A conta ${c.codigo} está sem nome.`);
        if (c.tipo === 'S' && !plano.some((x) => pai(x.codigo) === c.codigo)) avisos.push(`A conta sintética ${c.codigo} - ${c.nome} não tem subcontas.`);
    });
    const semRef = ref.filter((r) => r.ativo && !r.referencial);
    if (semRef.length === ref.length) {
        avisos.push('Nenhuma conta está ligada ao plano referencial. O mapeamento é opcional na ECD, mas facilita a ECF — peça ao contador os códigos.');
    } else if (semRef.length) {
        avisos.push(`${semRef.length} conta(s) analítica(s) ainda sem código do plano referencial.`);
    }
    return { ok: !erros.length, erros, avisos, contas: plano.length, analiticas: ref.length, mapeadas: ref.length - semRef.length };
}

// ── Saldos e movimentos da escrituração ──────────────────────────────────────
async function carregarEscrituracao(igrejaId) {
    const plano = await contabil.carregarPlano(igrejaId);
    const porCod = new Map(plano.map((c) => [c.codigo, c]));
    const abertura = new Map();
    const addAb = (cod, saldo) => {
        const c = porCod.get(cod);
        if (!c || !saldo) return;
        abertura.set(cod, r2((abertura.get(cod) || 0) + (devedora(c.natureza) ? saldo : -saldo)));
    };
    (await contabil.aberturaManual(igrejaId)).forEach((s, cod) => addAb(cod, s));
    (await contabil.aberturaTesouraria(igrejaId)).forEach((v, cod) => addAb(cod, v.saldo));
    const lancs = (await contabil.carregarLancamentos(igrejaId)).map((l) => ({
        ...l, cd: contabil.codigoDe(l.debito), cc: contabil.codigoDe(l.credito)
    }));
    return { plano, porCod, abertura, lancs };
}

// Saldo (débito − crédito) por conta analítica
function saldosAte(esc, ate, { exclusivo = false, semEncerramento = false } = {}) {
    const s = new Map(esc.abertura);
    esc.lancs.forEach((l) => {
        if (!l.data || (exclusivo ? l.data >= ate : l.data > ate)) return;
        if (semEncerramento && l.fonte === 'encerramento') return;
        s.set(l.cd, r2((s.get(l.cd) || 0) + l.valor));
        s.set(l.cc, r2((s.get(l.cc) || 0) - l.valor));
    });
    return s;
}

// Resultado (receitas/despesas) num período, sem os lançamentos de encerramento
function resultadoPeriodo(esc, ini, fim) {
    const s = new Map();
    esc.lancs.forEach((l) => {
        if (!l.data || l.data < ini || l.data > fim || l.fonte === 'encerramento') return;
        [[l.cd, l.valor], [l.cc, -l.valor]].forEach(([cod, v]) => {
            if (cod && ['3', '4'].includes(cod.charAt(0))) s.set(cod, r2((s.get(cod) || 0) + v));
        });
    });
    return s;
}

// Soma dos saldos das analíticas em cada conta (inclusive sintéticas)
function totalizar(plano, saldos) {
    const t = new Map();
    plano.forEach((c) => {
        if (c.tipo !== 'A') return;
        const v = saldos.get(c.codigo) || 0;
        if (!v) return;
        const partes = c.codigo.split('.');
        for (let i = 1; i <= partes.length; i += 1) {
            const k = partes.slice(0, i).join('.');
            t.set(k, r2((t.get(k) || 0) + v));
        }
    });
    return t;
}

// ── Parâmetros da ECD ────────────────────────────────────────────────────────
function lerParametros(p) {
    const ano = Number(p.ano);
    return {
        ano,
        dtIni: p.dtIni || `${ano}-01-01`,
        dtFin: p.dtFin || `${ano}-12-31`,
        numLivro: Number(p.numLivro) || 1,
        natLivro: String(p.natLivro || 'DIARIO GERAL').trim().toUpperCase(),
        finalidade: p.finalidade === '1' ? '1' : '0',
        hashSubstituida: String(p.hashSubstituida || '').trim().toUpperCase(),
        sitEspecial: SITUACOES_ESPECIAIS[p.sitEspecial] !== undefined ? String(p.sitEspecial || '') : '',
        sitIniPer: SITUACOES_INICIO[p.sitIniPer] !== undefined ? String(p.sitIniPer) : '0',
        grandePorte: !!p.grandePorte,
        mudancaPlano: !!p.mudancaPlano,
        descentralizada: !!p.descentralizada
    };
}

async function validarEcd(igrejaId, params) {
    await ensure();
    const p = lerParametros(params);
    const erros = [];
    const avisos = [];
    const cfg = await getConfig(igrejaId);
    const dirig = (await listarDirigentes(igrejaId)).filter((d) => d.ativo && d.assinaEcd);
    const fechado = await exercicio.ultimoFechado(igrejaId);

    // Entidade
    if (!cfg.nome) erros.push('Informe o nome da entidade nos dados do SPED.');
    if (!cnpjValido(cfg.cnpj)) erros.push('Informe um CNPJ válido nos dados da entidade.');
    if (!/^[A-Z]{2}$/.test(cfg.uf || '')) erros.push('Informe a UF da entidade.');
    if (!/^\d{7}$/.test(cfg.codMun || '')) erros.push('Informe o código IBGE do município (7 dígitos).');
    if (!cfg.municipio) erros.push('Informe o município da entidade.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cfg.dtArq || '')) erros.push('Informe a data de registro dos atos constitutivos (estatuto) em cartório.');

    // Período
    if (!(p.ano >= 2020 && p.ano <= new Date().getFullYear())) erros.push('Escolha o ano-base (o leiaute 9 vale a partir de 2020).');
    if (!(p.dtIni.startsWith(`${p.ano}-`) && p.dtFin.startsWith(`${p.ano}-`) && p.dtIni <= p.dtFin)) erros.push('As datas inicial e final precisam estar dentro do ano-base.');
    if (!fechado || fechado < p.ano) erros.push(`O exercício de ${p.ano} precisa estar encerrado (Contabilidade › Encerramento do Exercício).`);
    if (p.finalidade === '1' && !/^[0-9A-F]{40}$/.test(p.hashSubstituida)) erros.push('Na ECD substituta, informe o hash (40 caracteres) do arquivo substituído, que aparece no recibo do PVA.');
    if (p.sitIniPer === '0' && p.dtIni !== `${p.ano}-01-01`) avisos.push('A data inicial não é 01/01: confira a "Situação no início do período".');

    // Signatários
    if (!dirig.some((d) => d.qualificacao === 900)) erros.push('Cadastre o contador (qualificação 900) em Dirigentes e Conselheiros, marcado como signatário da ECD.');
    if (!dirig.some((d) => d.responsavelLegal)) erros.push('Marque um dirigente como responsável legal (quem assina pela entidade).');

    // Plano e escrituração
    const vp = await validarPlano(igrejaId);
    vp.erros.forEach((e) => erros.push(e));
    vp.avisos.forEach((a) => avisos.push(a));
    const esc = await carregarEscrituracao(igrejaId);
    const desconhecidas = new Set();
    esc.lancs.forEach((l) => {
        if (!l.data || l.data > p.dtFin) return;
        [[l.cd, l.debito], [l.cc, l.credito]].forEach(([cod, rot]) => {
            const c = cod && esc.porCod.get(cod);
            if (!c || c.tipo !== 'A') desconhecidas.add(rot);
        });
    });
    desconhecidas.forEach((r) => erros.push(`Há lançamentos na conta "${r}", que não é uma conta analítica do plano de contas.`));
    const difAb = r2([...esc.abertura.values()].reduce((s, v) => s + v, 0));
    if (difAb) erros.push(`O balancete de abertura não fecha (diferença de R$ ${Math.abs(difAb).toFixed(2).replace('.', ',')}). Ajuste o resultado acumulado.`);
    const noPeriodo = esc.lancs.filter((l) => l.data && l.data >= p.dtIni && l.data <= p.dtFin);
    if (!noPeriodo.length) avisos.push('Não há lançamentos no período: a ECD sairá só com saldos.');
    const semCls = noPeriodo.filter((l) => l.semClassificacao).length;
    if (semCls) avisos.push(`${semCls} movimento(s) da Tesouraria sem conta contábil foram classificados como "Outras receitas/despesas".`);

    return { ok: !erros.length, erros, avisos, parametros: p, lancamentos: noPeriodo.length };
}

// ── Geração do arquivo ───────────────────────────────────────────────────────
const LATIN = { '–': '-', '—': '-', '“': '"', '”': '"', '‘': "'", '’': "'", '…': '...', '→': '->', '•': '-' };
function txt(v) {
    return String(v == null ? '' : v)
        .replace(/[–—“”‘’…→•]/g, (c) => LATIN[c])
        .replace(/[|\r\n\t]/g, ' ')
        .replace(/[^\x20-\xFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
const dt = (d) => (d ? `${d.slice(8, 10)}${d.slice(5, 7)}${d.slice(0, 4)}` : '');
const num = (v) => Math.abs(r2(v)).toFixed(2).replace('.', ',');
const natCod = (cod) => (cod.charAt(0) === '1' ? '01' : cod.startsWith('2.03') ? '03' : cod.charAt(0) === '2' ? '02' : '04');
const nivel = (cod) => cod.split('.').length;
const paiDe = (cod) => (cod.includes('.') ? cod.split('.').slice(0, -1).join('.') : '');
const ultimoDia = (ano, mes) => new Date(ano, mes, 0).getDate();

async function montarEcd(igrejaId, p) {
    const cfg = await getConfig(igrejaId);
    const esc = await carregarEscrituracao(igrejaId);
    const dirig = (await listarDirigentes(igrejaId)).filter((d) => d.ativo && d.assinaEcd);
    const refs = new Map((await listarReferencial(igrejaId)).filter((r) => r.referencial).map((r) => [r.codigo, r.referencial]));
    const plano = esc.plano;
    const analiticas = plano.filter((c) => c.tipo === 'A');
    const linhas = [];
    const L = (...campos) => linhas.push(`|${campos.map(txt).join('|')}|`);

    // Bloco 0
    L('0000', 'LECD', dt(p.dtIni), dt(p.dtFin), cfg.nome, cfg.cnpj, cfg.uf, cfg.ie || '', cfg.codMun, cfg.im || '',
        p.sitEspecial, p.sitIniPer, '0', p.finalidade, p.finalidade === '1' ? p.hashSubstituida : '',
        p.grandePorte ? '1' : '0', '0', '', 'N', 'N', p.descentralizada ? '1' : '0', p.mudancaPlano ? '1' : '0',
        refs.size ? String(cfg.codPlanRef || '5') : '');
    L('0001', '0');
    const fim0 = linhas.length;
    L('0990', String(fim0 + 1));

    // Bloco C (ECD recuperada) — sem dados
    const iniC = linhas.length;
    L('C001', '1');
    L('C990', String(linhas.length - iniC + 1));

    // Bloco I
    const iniI = linhas.length;
    L('I001', '0');
    L('I010', 'G', LEIAUTE_ECD);
    L('I030', 'TERMO DE ABERTURA', String(p.numLivro), p.natLivro, '#QTD#', cfg.nome, '', cfg.cnpj, dt(cfg.dtArq), dt(cfg.dtArqConv || ''),
        cfg.municipio, dt(p.dtFin));
    plano.forEach((c) => {
        L('I050', dt(p.dtIni), natCod(c.codigo), c.tipo, String(nivel(c.codigo)), c.codigo, paiDe(c.codigo), c.nome);
        if (c.tipo === 'A') {
            if (refs.has(c.codigo)) L('I051', '', refs.get(c.codigo));
            L('I052', '', c.codigo);
        }
    });

    // I150/I155: saldos mensais
    const saldo = saldosAte(esc, p.dtIni, { exclusivo: true });
    const anoN = p.ano;
    const mIni = Number(p.dtIni.slice(5, 7));
    const mFim = Number(p.dtFin.slice(5, 7));
    for (let m = mIni; m <= mFim; m += 1) {
        const mm = String(m).padStart(2, '0');
        const ini = m === mIni ? p.dtIni : `${anoN}-${mm}-01`;
        const fim = m === mFim ? p.dtFin : `${anoN}-${mm}-${ultimoDia(anoN, m)}`;
        const mov = new Map();
        esc.lancs.forEach((l) => {
            if (!l.data || l.data < ini || l.data > fim) return;
            const d = mov.get(l.cd) || { d: 0, c: 0 };
            d.d += l.valor;
            mov.set(l.cd, d);
            const c = mov.get(l.cc) || { d: 0, c: 0 };
            c.c += l.valor;
            mov.set(l.cc, c);
        });
        L('I150', dt(ini), dt(fim));
        analiticas.forEach((c) => {
            const si = saldo.get(c.codigo) || 0;
            const mv = mov.get(c.codigo) || { d: 0, c: 0 };
            if (!si && !mv.d && !mv.c) return;
            const sf = r2(si + mv.d - mv.c);
            const ind = (v) => (v > 0 ? 'D' : v < 0 ? 'C' : (devedora(c.natureza) ? 'D' : 'C'));
            L('I155', c.codigo, '', num(si), ind(si), num(mv.d), num(mv.c), num(sf), ind(sf));
            saldo.set(c.codigo, sf);
        });
    }

    // I200/I250: lançamentos
    const lancs = esc.lancs.filter((l) => l.data && l.data >= p.dtIni && l.data <= p.dtFin);
    lancs.forEach((l, i) => {
        const resultado = [l.cd, l.cc].some((cod) => cod && ['3', '4'].includes(cod.charAt(0)));
        const tipo = l.fonte === 'encerramento' && resultado ? 'E' : 'N';
        const hist = [l.historico, l.documento ? `Doc. ${l.documento}` : ''].filter(Boolean).join(' - ') || 'Lançamento contábil';
        L('I200', String(i + 1), dt(l.data), num(l.valor), tipo, '');
        L('I250', l.cd, '', num(l.valor), 'D', l.documento || '', '', hist, '');
        L('I250', l.cc, '', num(l.valor), 'C', l.documento || '', '', hist, '');
    });

    // I350/I355: saldos das contas de resultado antes do encerramento
    const antes = saldosAte(esc, p.dtFin, { semEncerramento: true });
    const resultado = analiticas.filter((c) => ['3', '4'].includes(c.codigo.charAt(0)) && r2(antes.get(c.codigo) || 0));
    if (resultado.length) {
        L('I350', dt(p.dtFin));
        resultado.forEach((c) => {
            const v = antes.get(c.codigo);
            L('I355', c.codigo, '', num(v), v > 0 ? 'D' : 'C');
        });
    }
    L('I990', String(linhas.length - iniI + 1));

    // Bloco J: demonstrações
    const iniJ = linhas.length;
    L('J001', '0');
    L('J005', dt(p.dtIni), dt(p.dtFin), '1', '');
    const tIni = totalizar(plano, saldosAte(esc, p.dtIni, { exclusivo: true }));
    const tFim = totalizar(plano, saldosAte(esc, p.dtFin));
    plano.filter((c) => ['1', '2'].includes(c.codigo.charAt(0))).forEach((c) => {
        const ativo = c.codigo.charAt(0) === '1';
        const ind = (v) => (ativo ? (v >= 0 ? 'D' : 'C') : (v <= 0 ? 'C' : 'D'));
        const vi = tIni.get(c.codigo) || 0;
        const vf = tFim.get(c.codigo) || 0;
        L('J100', c.codigo, c.tipo === 'S' ? 'T' : 'D', String(nivel(c.codigo)), paiDe(c.codigo), ativo ? 'A' : 'P', c.nome,
            num(vi), ind(vi), num(vf), ind(vf), '');
    });
    const dreAtual = totalizar(plano, resultadoPeriodo(esc, p.dtIni, p.dtFin));
    const dreAnt = totalizar(plano, resultadoPeriodo(esc, `${p.ano - 1}-01-01`, `${p.ano - 1}-12-31`));
    let ordem = 0;
    ['4', '3'].forEach((g) => {
        plano.filter((c) => c.codigo.charAt(0) === g).forEach((c) => {
            ordem += 1;
            const receita = g === '4';
            const ind = (v) => (receita ? (v <= 0 ? 'C' : 'D') : (v >= 0 ? 'D' : 'C'));
            const va = dreAnt.get(c.codigo) || 0;
            const vf = dreAtual.get(c.codigo) || 0;
            L('J150', String(ordem), c.codigo, c.tipo === 'S' ? 'T' : 'D', String(nivel(c.codigo)), paiDe(c.codigo), c.nome,
                num(va), ind(va), num(vf), ind(vf), receita ? 'R' : 'D', '');
        });
    });
    L('J900', 'TERMO DE ENCERRAMENTO', String(p.numLivro), p.natLivro, cfg.nome, '#QTD#', dt(p.dtIni), dt(p.dtFin));
    dirig.forEach((d) => {
        const contador = d.qualificacao === 900 || d.qualificacao === 910;
        L('J930', d.nome, d.cpf, QUALIFICACOES[d.qualificacao], String(d.qualificacao), contador ? d.crc : '', d.email, soDigitos(d.telefone),
            contador ? d.ufCrc : '', contador ? d.crcSeq : '', contador ? dt(d.crcValidade || '') : '', d.responsavelLegal ? 'S' : 'N');
    });
    L('J990', String(linhas.length - iniJ + 1));

    // Bloco K (conglomerados) — sem dados
    const iniK = linhas.length;
    L('K001', '1');
    L('K990', String(linhas.length - iniK + 1));

    // Bloco 9: totais por registro
    const contagem = new Map();
    linhas.forEach((l) => { const r = l.split('|')[1]; contagem.set(r, (contagem.get(r) || 0) + 1); });
    const regs = [...contagem.keys(), '9001', '9900', '9990', '9999'];
    const qtd9900 = regs.length;
    const bloco9 = ['|9001|0|'];
    regs.forEach((r) => {
        const q = r === '9900' ? qtd9900 : r === '9001' || r === '9990' || r === '9999' ? 1 : contagem.get(r);
        bloco9.push(`|9900|${r}|${q}|`);
    });
    bloco9.push(`|9990|${bloco9.length + 2}|`);
    const total = linhas.length + bloco9.length + 1;
    bloco9.push(`|9999|${total}|`);
    const todas = [...linhas, ...bloco9].map((l) => l.replace('|#QTD#|', `|${total}|`));
    return { texto: `${todas.join('\r\n')}\r\n`, linhas: total, cfg };
}

async function gerarEcd(igrejaId, params, usuario) {
    const v = await validarEcd(igrejaId, params);
    if (!v.ok) {
        const e = createHttpError(400, v.erros[0]);
        e.details = v;
        throw e;
    }
    const p = v.parametros;
    const { texto, linhas, cfg } = await montarEcd(igrejaId, p);
    const sha256 = crypto.createHash('sha256').update(Buffer.from(texto, 'latin1')).digest('hex');
    const id = `sped-${igrejaId}-${Date.now().toString(36)}`;
    await pool.query(
        `INSERT INTO contabilidade_sped_arquivos (id, igreja_id, tipo, ano, num_livro, finalidade, dt_ini, dt_fin, linhas, sha256, conteudo, usuario_nome)
         VALUES (?, ?, 'ECD', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, igrejaId, p.ano, p.numLivro, p.finalidade, p.dtIni, p.dtFin, linhas, sha256, texto, usuario.nome || null]
    );
    return { id, linhas, sha256, arquivo: nomeArquivo('ECD', cfg.cnpj, p.ano), avisos: v.avisos };
}

const nomeArquivo = (tipo, cnpj, ano) => `SPED-${tipo}_${cnpj || 'SEMCNPJ'}_${ano}.txt`;

async function listarArquivos(igrejaId, tipo) {
    await ensure();
    const [rows] = await pool.query(
        `SELECT id, tipo, ano, num_livro, finalidade, dt_ini, dt_fin, linhas, sha256, usuario_nome, created_at
         FROM contabilidade_sped_arquivos WHERE igreja_id = ? ${tipo ? 'AND tipo = ?' : ''} ORDER BY created_at DESC`,
        tipo ? [igrejaId, tipo] : [igrejaId]
    );
    return rows.map((r) => ({
        id: r.id, tipo: r.tipo, ano: Number(r.ano), numLivro: r.num_livro, finalidade: r.finalidade === '1' ? 'Substituta' : 'Original',
        dtIni: iso(r.dt_ini), dtFin: iso(r.dt_fin), linhas: Number(r.linhas), sha256: r.sha256, usuario: r.usuario_nome, criado: r.created_at
    }));
}

async function baixarArquivo(igrejaId, id) {
    await ensure();
    const [rows] = await pool.query('SELECT tipo, ano, conteudo FROM contabilidade_sped_arquivos WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!rows[0]) throw createHttpError(404, 'Arquivo não encontrado.');
    const cfg = await getConfig(igrejaId);
    return { nome: nomeArquivo(rows[0].tipo, cfg.cnpj, rows[0].ano), buffer: Buffer.from(rows[0].conteudo || '', 'latin1') };
}

async function excluirArquivo(igrejaId, id) {
    await ensure();
    const [rows] = await pool.query('SELECT id FROM contabilidade_sped_arquivos WHERE id = ? AND igreja_id = ? LIMIT 1', [id, igrejaId]);
    if (!rows[0]) throw createHttpError(404, 'Arquivo não encontrado.');
    await pool.query('DELETE FROM contabilidade_sped_arquivos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
}

// ── ECF: pré-requisitos e ficha ──────────────────────────────────────────────
async function fichaEcf(igrejaId, ano) {
    await ensure();
    const a = Number(ano) || new Date().getFullYear() - 1;
    const cfg = await getConfig(igrejaId);
    const fechado = await exercicio.ultimoFechado(igrejaId);
    const dirig = (await listarDirigentes(igrejaId)).filter((d) => d.ativo);
    const ecds = (await listarArquivos(igrejaId, 'ECD')).filter((x) => x.ano === a);
    const esc = await carregarEscrituracao(igrejaId);
    const fim = `${a}-12-31`;
    const t = totalizar(esc.plano, saldosAte(esc, fim));
    const dre = totalizar(esc.plano, resultadoPeriodo(esc, `${a}-01-01`, fim));
    const linhasDe = (grupo, sinal) => esc.plano.filter((c) => c.codigo.charAt(0) === grupo && nivel(c.codigo) <= 3)
        .map((c) => ({ codigo: c.codigo, nome: c.nome, nivel: nivel(c.codigo), valor: r2(sinal * (grupo < '3' ? (t.get(c.codigo) || 0) : (dre.get(c.codigo) || 0))) }))
        .filter((l) => l.valor || l.nivel === 1);
    const receitas = r2(-(dre.get('4') || 0));
    const despesas = r2(dre.get('3') || 0);
    const prereq = [
        { ok: !!(fechado && fechado >= a), texto: `Exercício de ${a} encerrado na Contabilidade` },
        { ok: ecds.length > 0, texto: `ECD de ${a} gerada (o PVA da ECF recupera os saldos do arquivo da ECD)` },
        { ok: cnpjValido(cfg.cnpj), texto: 'CNPJ da entidade informado' },
        { ok: dirig.some((d) => d.responsavelLegal), texto: 'Responsável legal cadastrado em Dirigentes e Conselheiros' },
        { ok: dirig.some((d) => d.qualificacao === 900), texto: 'Contador cadastrado em Dirigentes e Conselheiros' },
        { ok: dirig.filter((d) => d.qualificacao !== 900).length > 0, texto: 'Dirigentes e conselheiros da entidade cadastrados (informados na ECF)' }
    ];
    return {
        ano: a,
        entidade: { nome: cfg.nome, cnpj: cfg.cnpj, uf: cfg.uf, municipio: cfg.municipio, formaTributacao: cfg.formaTributacao },
        prerequisitos: prereq,
        pronto: prereq.every((x) => x.ok),
        ecd: ecds[0] || null,
        balanco: { ativo: linhasDe('1', 1), passivo: linhasDe('2', -1), totalAtivo: r2(t.get('1') || 0), totalPassivo: r2(-(t.get('2') || 0)) },
        dre: { receitas: linhasDe('4', -1), despesas: linhasDe('3', 1), totalReceitas: receitas, totalDespesas: despesas, resultado: r2(receitas - despesas) },
        dirigentes: dirig.filter((d) => d.qualificacao !== 900 && d.qualificacao !== 910)
    };
}

module.exports = {
    QUALIFICACOES, PLANOS_REFERENCIAIS, SITUACOES_ESPECIAIS, SITUACOES_INICIO, LEIAUTE_ECD,
    cnpjValido, cpfValido, ensure, getConfig, salvarConfig,
    listarDirigentes, criarDirigente, atualizarDirigente, excluirDirigente,
    listarReferencial, salvarReferencial, validarPlano,
    validarEcd, gerarEcd, montarEcd, listarArquivos, baixarArquivo, excluirArquivo, fichaEcf
};
