/* Lote 5 — preenche <select> de Fornecedor / Centro de Custo / Tipo de Documento */
(function () {
    'use strict';

    const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const cache = {};

    async function listar(recurso) {
        if (!cache[recurso]) {
            cache[recurso] = fetch(`/api/tesouraria/${recurso}`, { headers: { Accept: 'application/json' } })
                .then((r) => (r.ok ? r.json() : { items: [] }))
                .then((d) => d.items || [])
                .catch(() => []);
        }
        return cache[recurso];
    }

    const rotulo = (recurso, item) => (recurso === 'centros-custo' && item.codigo ? `${item.codigo} - ${item.nome}` : item.nome);

    /**
     * Preenche um select. opts.vazio = texto da opção vazia (padrão "— nenhum —").
     * Retorna a lista carregada.
     */
    async function preencher(select, recurso, opts = {}) {
        if (!select) return [];
        const itens = await listar(recurso);
        const atual = select.value;
        select.innerHTML = `<option value="">${esc(opts.vazio || '— nenhum —')}</option>` +
            itens.map((i) => `<option value="${i.id}">${esc(rotulo(recurso, i))}</option>`).join('');
        if (atual) select.value = atual;
        if (!itens.length && opts.dicaVazia !== false) {
            select.title = 'Nenhum cadastro ainda. Cadastre em Tesouraria → Cadastros Auxiliares.';
        }
        return itens;
    }

    function limparCache() { Object.keys(cache).forEach((k) => delete cache[k]); }

    window.CadastrosTesouraria = { listar, preencher, rotulo, limparCache };
})();
