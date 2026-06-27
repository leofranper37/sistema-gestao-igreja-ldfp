// Funções auxiliares
const $ = id => document.getElementById(id);
const fmtVal = val => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
const monthToComp = monthStr => monthStr ? monthStr.replace('-', '') : '';
const compToDisplay = compStr => {
    if (!compStr || compStr.length !== 6) return compStr;
    return `${compStr.substring(4, 6)}/${compStr.substring(0, 4)}`;
};

const badgeClass = {
    dizimo: 'badge-dizimo',
    oferta: 'badge-oferta',
    missoes: 'badge-missoes',
    outros: 'badge-outros'
};
const tipoLabels = {
    dizimo: 'Dízimo',
    oferta: 'Oferta',
    missoes: 'Missões',
    outros: 'Outros'
};

let currentPage = 1;
let totalPages = 1;

// Mensagens de status
function setMsg(id, msg, type = '') {
    const el = $(id);
    if (el) {
        el.textContent = msg;
        el.className = `status-msg ${type}`;
        if (msg) {
            setTimeout(() => {
                el.textContent = '';
                el.className = 'status-msg';
            }, 5000);
        }
    }
}

// Lógica das abas
document.querySelectorAll('.inner-tab').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.inner-tab').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.inner-panel').forEach(panel => panel.classList.remove('active'));

        button.classList.add('active');
        $(`panel-${button.dataset.tab}`).classList.add('active');

        // Atualiza a URL sem recarregar a página
        const url = new URL(window.location);
        url.searchParams.set('tab', button.dataset.tab);
        window.history.pushState({}, '', url);
    });
});

// Ativa a aba correta ao carregar a página (se houver 'tab' na URL)
const urlParams = new URLSearchParams(window.location.search);
const activeTab = urlParams.get('tab');
if (activeTab) {
    const tabButton = document.querySelector(`.inner-tab[data-tab="${activeTab}"]`);
    if (tabButton) {
        tabButton.click(); // Simula o clique para ativar a aba
    }
} else {
    // Se não houver tab na URL, garante que a primeira aba esteja ativa
    document.querySelector('.inner-tab[data-tab="lancamentos"]').click();
}


// Preview do formulário de lançamento
function updatePreview() {
    const valor = parseFloat($('valor').value.trim().replace(',', '.')) || 0;
    const tipo = $('tipo').value;
    const membroNome = $('membroNome').value.trim() || 'Membro';
    const competencia = $('competencia').value;
    const observacao = $('observacao').value.trim();

    $('previewValor').textContent = fmtVal(valor);
    $('previewTipo').textContent = tipoLabels[tipo] || tipo;
    $('previewMembro').textContent = membroNome;
    $('previewComp').textContent = competencia ? compToDisplay(monthToComp(competencia)) : 'Mês/Ano';
    $('previewObs').textContent = observacao ? `Obs: ${observacao}` : '';
}

$('valor').addEventListener('input', updatePreview);
$('tipo').addEventListener('change', updatePreview);
$('membroNome').addEventListener('input', updatePreview);
$('competencia').addEventListener('input', updatePreview);
$('observacao').addEventListener('input', updatePreview);

// Lógica de carregamento e CRUD de Dízimos
// --- Mock de dados para rodar localmente ---
let mockDizimos = [
    { id: 1, membro_nome: 'João Silva', competencia: '202605', tipo: 'dizimo', valor: 250.00, observacao: 'Dízimo de maio' },
    { id: 2, membro_nome: 'Maria Oliveira', competencia: '202605', tipo: 'oferta', valor: 100.00, observacao: 'Oferta especial' },
    { id: 3, membro_nome: 'Pedro Souza', competencia: '202604', tipo: 'missoes', valor: 50.00, observacao: 'Missões abril' },
    { id: 4, membro_nome: 'Ana Costa', competencia: '202605', tipo: 'dizimo', valor: 150.00, observacao: 'Dízimo de maio' },
];

let mockTiposReceita = [
    { id: 1, nome: 'Dízimo', natureza: 'entrada', categoria: 'dizimo', ativo: true },
    { id: 2, nome: 'Oferta', natureza: 'entrada', categoria: 'oferta', ativo: true },
    { id: 3, nome: 'Missões', natureza: 'entrada', categoria: 'missoes', ativo: true },
    { id: 4, nome: 'Outros', natureza: 'entrada', categoria: 'outros', ativo: true },
];
// --- Fim do Mock ---

async function loadTotais() {
    const comp = monthToComp($('filtroComp').value);
    let filteredDizimos = mockDizimos;
    if (comp) {
        filteredDizimos = mockDizimos.filter(d => d.competencia === comp);
    }
    const d = totais(filteredDizimos); // Reutiliza a função totais do mock-api

    $('kpiTotal').textContent = fmtVal(d.totalGeral);
    $('kpiDizimo').textContent = fmtVal(d.totalDizimos);
    $('kpiOferta').textContent = fmtVal(d.totalOfertas);
    $('kpiMissoes').textContent = fmtVal(d.totalMissoes);
    $('kpiOutros').textContent = fmtVal(d.totalOutros);
    $('kpiCount').textContent = `${d.totalLancamentos} lançamentos`;
}

async function loadLista(page = 1) {
    const comp = monthToComp($('filtroComp').value);
    const tipo = $('filtroTipo').value;
    const nome = $('filtroNome').value.trim();

    let rows = [...mockDizimos];
    if (comp) rows = rows.filter(r => r.competencia === comp);
    if (tipo) rows = rows.filter(r => r.tipo === tipo);
    if (nome) rows = rows.filter(r => (r.membro_nome || '').toLowerCase().includes(nome.toLowerCase()));

    const limit = 50; // Seu limite de paginação
    const total = rows.length;
    totalPages = Math.max(1, Math.ceil(total / limit));
    currentPage = page;

    const start = (currentPage - 1) * limit;
    const items = rows.slice(start, start + limit);

    $('pagInfo').textContent = `Pág ${currentPage} de ${totalPages}`;
    $('btnAnterior').disabled = currentPage <= 1;
    $('btnProximo').disabled = currentPage >= totalPages;

    if (!items.length) {
        $('tbDizimos').innerHTML = `
            <tr class="empty-row">
                <td colspan="6">
                    <i class="fa-solid fa-inbox" style="font-size:20px;color:#cbd5e1;display:block;margin-bottom:6px;"></i>
                    Nenhum lançamento encontrado.
                </td>
            </tr>`;
        return;
    }

    $('tbDizimos').innerHTML = items.map(item => `
        <tr>
            <td><strong>${item.membro_nome || '-'}</strong></td>
            <td style="color:var(--muted);"> ${compToDisplay(item.competencia)}</td>
            <td><span class="badge ${badgeClass[item.tipo] || 'badge-outros'}">${tipoLabels[item.tipo] || item.tipo}</span></td>
            <td class="val-green">${fmtVal(item.valor)}</td>
            <td style="color:var(--muted);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.observacao || ''}">${item.observacao || '-'}</td>
            <td>
                <button class="btn btn-red btn-sm" onclick="excluir(${item.id})" title="Remover">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    setMsg('msgLista', '');
}

async function refresh() {
    await Promise.all([loadLista(currentPage), loadTotais()]);
}

window.excluir = async function(id) {
    if (!confirm('Remover este lançamento? Esta ação não pode ser desfeita.')) return;
    mockDizimos = mockDizimos.filter(d => d.id !== id);
    setMsg('msgLista', 'Lançamento removido.', 'ok');
    refresh();
};

$('btnFiltrar').addEventListener('click', () => { currentPage = 1; refresh(); });
$('btnAnterior').addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadLista(currentPage); } });
$('btnProximo').addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadLista(currentPage); } });

$('formDizimo').addEventListener('submit', async e => {
    e.preventDefault();
    setMsg('msgForm', '');

    const valorRaw = parseFloat($('valor').value.trim().replace(',', '.'));
    if (!valorRaw || valorRaw <= 0) { setMsg('msgForm', 'Informe um valor válido.', 'error'); return; }
    if (!$('competencia').value) { setMsg('msgForm', 'Selecione a competência.', 'error'); return; }

    const body = {
        id: Date.now(), // Gerar ID localmente
        membro_nome: $('membroNome').value.trim(),
        valor: valorRaw,
        competencia: monthToComp($('competencia').value),
        tipo: $('tipo').value,
        observacao: $('observacao').value.trim() || null
    };

    mockDizimos.unshift(body); // Adiciona ao mock
    setMsg('msgForm', 'Lançamento registrado com sucesso!', 'ok');
    $('formDizimo').reset();
    updatePreview();
    currentPage = 1;
    refresh();
});

/* Tipos de receitas */
const natLabel = { entrada: 'Entrada', saida: 'Saída' };
const catLabel = { dizimo: 'Dízimo', oferta: 'Oferta', missoes: 'Missões', campanha: 'Campanha', social: 'Social', manutencao: 'Manutenção', outros: 'Outros' };

async function loadTipos() {
    const rows = mockTiposReceita; // Usa o mock local

    if (!rows.length) {
        $('tbTipos').innerHTML = `<tr class="empty-row"><td colspan="5">Nenhum tipo cadastrado.</td></tr>`;
        return;
    }

    $('tbTipos').innerHTML = rows.map(t => `
        <tr>
            <td><strong>${t.nome}</strong>${t.descricao ? `<br><small style="color:var(--muted)">${t.descricao}</small>` : ''}</td>
            <td>
                <span class="tipo-natureza ${t.natureza === 'entrada' ? 'natureza-e' : 'natureza-s'}">
                    <i class="fa-solid ${t.natureza === 'entrada' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
                    ${natLabel[t.natureza] || t.natureza}
                </span>
            </td>
            <td>${catLabel[t.categoria] || t.categoria || '-'}</td>
            <td>
                <span class="badge" style="background:${t.ativo !== false ? '#dcfce7' : '#f1f5f9'};color:${t.ativo !== false ? '#15803d' : '#64748b'}">
                    ${t.ativo !== false ? 'Ativo' : 'Inativo'}
                </span>
            </td>
            <td style="white-space:nowrap;">
                <button class="btn btn-blue btn-sm" onclick="editarTipo(${t.id})" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-red btn-sm" onclick="excluirTipo(${t.id})" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
    window._tiposCache = rows;
    setMsg('msgTiposLista', '');
}

window.editarTipo = function(id) {
    const t = (window._tiposCache || []).find(x => x.id === id);
    if (!t) return;
    $('tipoEditId').value = id;
    $('tipoNome').value = t.nome;
    $('tipoNatureza').value = t.natureza || 'entrada';
    $('tipoCategoria').value = t.categoria || 'outros';
    $('tipoDescricao').value = t.descricao || '';
    $('tipoFormTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Editar tipo';
    $('tipoSubmitLabel').textContent = 'Salvar alterações';
    $('btnCancelarTipo').hidden = false;
};

window.excluirTipo = async function(id) {
    if (!confirm('Remover este tipo de receita?')) return;
    mockTiposReceita = mockTiposReceita.filter(t => t.id !== id);
    setMsg('msgTiposLista', 'Tipo removido.', 'ok');
    loadTipos();
};

function cancelarTipo() {
    $('formTipo').reset();
    $('tipoEditId').value = '';
    $('tipoFormTitle').innerHTML = '<i class="fa-solid fa-plus"></i> Novo tipo';
    $('tipoSubmitLabel').textContent = 'Criar tipo';
    $('btnCancelarTipo').hidden = true;
    setMsg('msgTiposForm', '');
}

$('formTipo').addEventListener('submit', async e => {
    e.preventDefault();
    const editId = $('tipoEditId').value;
    const body = {
        nome: $('tipoNome').value.trim(),
        natureza: $('tipoNatureza').value,
        categoria: $('tipoCategoria').value,
        descricao: $('tipoDescricao').value.trim() || null
    };

    if (editId) {
        const idx = mockTiposReceita.findIndex(t => t.id === Number(editId));
        if (idx >= 0) {
            mockTiposReceita[idx] = { ...mockTiposReceita[idx], ...body };
            setMsg('msgTiposForm', 'Tipo atualizado!', 'ok');
        }
    } else {
        const newId = Date.now();
        mockTiposReceita.unshift({ id: newId, ativo: true, ...body });
        setMsg('msgTiposForm', 'Tipo criado!', 'ok');
    }

    cancelarTipo();
    loadTipos();
});

// Funções auxiliares para o mock de totais (copiadas do mock-api)
function totais(items) {
  const t = { totalGeral: 0, totalDizimos: 0, totalOfertas: 0, totalMissoes: 0, totalOutros: 0 };
  for (const i of items) {
    const v = Number(i.valor || 0);
    t.totalGeral += v;
    if (i.tipo === 'dizimo') t.totalDizimos += v;
    else if (i.tipo === 'oferta') t.totalOfertas += v;
    else if (i.tipo === 'missoes') t.totalMissoes += v;
    else t.totalOutros += v;
  }
  return { ...t, totalLancamentos: items.length };
}


/* INIT */
const hoje = new Date();
const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
$('competencia').value = mesAtual;
$('filtroComp').value = mesAtual;
updatePreview();
refresh();
loadTipos();

// Remover chamadas a session.js e enterprise-shell.js para rodar local
// if (typeof requireAuthSession === 'function') {
//   requireAuthSession();
// }
