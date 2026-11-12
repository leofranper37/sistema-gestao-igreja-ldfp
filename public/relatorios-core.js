/* Helpers compartilhados de Relatórios e Gráficos (Lote 3) */
(function () {
    'use strict';

    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    const CORES = ['#0f766e', '#2563eb', '#f59e0b', '#db2777', '#7c3aed', '#16a34a', '#ea580c', '#0891b2', '#64748b', '#ca8a04', '#9333ea', '#dc2626'];

    const esc = (v) => String(v === null || v === undefined ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
    const moeda = (v) => fmtMoeda.format(Number(v) || 0);
    const numero = (v) => (Number(v) || 0).toLocaleString('pt-BR');
    const data = (iso) => {
        if (!iso) return '';
        const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso);
    };
    const hojeISO = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const inicioMesISO = () => hojeISO().slice(0, 8) + '01';
    const inicioAnoISO = () => hojeISO().slice(0, 5) + '01-01';

    function nomeIgreja() {
        try {
            const a = JSON.parse(localStorage.getItem('ldfpAuth') || '{}');
            return (a.user && (a.user.igreja || a.user.igrejaNome)) || '';
        } catch (_) { return ''; }
    }

    async function get(url, params) {
        const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)).toString() : '';
        const r = await fetch(url + qs, { headers: { Accept: 'application/json' } });
        let body = null;
        try { body = await r.json(); } catch (_) { /* vazio */ }
        if (!r.ok) {
            const msg = (body && (body.message || body.error)) || `Erro ${r.status}`;
            throw new Error(r.status === 403 ? 'Seu perfil não tem acesso a este relatório.' : msg);
        }
        return body;
    }

    /**
     * cols: [{ key, label, fmt?: 'moeda'|'data'|'numero'|fn(row), num?: bool, csv?: fn(row) }]
     * opts: { footer?: { key: valor | html }, vazio?: string }
     */
    function valorCelula(col, row) {
        const v = typeof col.key === 'function' ? col.key(row) : row[col.key];
        if (typeof col.fmt === 'function') return col.fmt(row, v);
        if (col.fmt === 'moeda') return moeda(v);
        if (col.fmt === 'data') return esc(data(v));
        if (col.fmt === 'numero') return numero(v);
        return esc(v);
    }

    function tabela(el, cols, rows, opts = {}) {
        if (!rows || !rows.length) {
            el.innerHTML = `<div class="rl-vazio">${esc(opts.vazio || 'Nenhum registro encontrado para os filtros escolhidos.')}</div>`;
            return;
        }
        const isNum = (c) => c.num || c.fmt === 'moeda' || c.fmt === 'numero';
        const head = cols.map((c) => `<th class="${isNum(c) ? 'num' : ''}">${esc(c.label)}</th>`).join('');
        const body = rows.map((r) => {
            if (r.__grupo) return `<tr class="grupo-linha"><td colspan="${cols.length}">${esc(r.__grupo)}</td></tr>`;
            return '<tr class="' + (r.__classe || '') + '">' + cols.map((c) => `<td class="${isNum(c) ? 'num' : ''}">${valorCelula(c, r)}</td>`).join('') + '</tr>';
        }).join('');
        let foot = '';
        if (opts.footer) {
            foot = '<tfoot><tr>' + cols.map((c, i) => {
                const k = typeof c.key === 'string' ? c.key : `__${i}`;
                let v = opts.footer[k];
                if (v === undefined) v = i === 0 ? 'Total' : '';
                else if (c.fmt === 'moeda' && typeof v === 'number') v = moeda(v);
                else if (c.fmt === 'numero' && typeof v === 'number') v = numero(v);
                return `<td class="${isNum(c) ? 'num' : ''}">${typeof v === 'string' && !/^</.test(v) ? esc(v) : v}</td>`;
            }).join('') + '</tr></tfoot>';
        }
        el.innerHTML = `<div class="rl-tabela-wrap"><table class="rl-tabela"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
    }

    function csvValor(col, row) {
        if (col.csv) return col.csv(row);
        const v = typeof col.key === 'function' ? col.key(row) : row[col.key];
        if (col.fmt === 'moeda' || col.fmt === 'numero') return (Number(v) || 0).toFixed(col.fmt === 'moeda' ? 2 : 0).replace('.', ',');
        if (col.fmt === 'data') return data(v);
        if (typeof col.fmt === 'function') return String(col.fmt(row, v)).replace(/<[^>]+>/g, '');
        return v === null || v === undefined ? '' : String(v);
    }

    /** CSV com ';' e BOM: abre direto no Excel em português. */
    function exportarCSV(nomeArquivo, cols, rows) {
        const linhas = [cols.map((c) => c.label)];
        rows.filter((r) => !r.__grupo).forEach((r) => linhas.push(cols.map((c) => csvValor(c, r))));
        const csv = linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo.replace(/[^\w.-]+/g, '_') + '.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function imprimir(titulo, subtitulo) {
        let head = document.getElementById('rlPrintHead');
        if (!head) {
            head = document.createElement('div');
            head.id = 'rlPrintHead';
            head.className = 'rl-print-head';
            const alvo = document.querySelector('.enterprise-page-shell') || document.body;
            alvo.prepend(head);
        }
        const igreja = nomeIgreja();
        head.innerHTML = `<h1>${esc(titulo)}</h1><p>${esc([igreja, subtitulo, 'Emitido em ' + new Date().toLocaleString('pt-BR')].filter(Boolean).join(' · '))}</p>`;
        window.print();
    }

    const charts = {};
    function grafico(canvasId, config) {
        if (charts[canvasId]) charts[canvasId].destroy();
        const el = document.getElementById(canvasId);
        if (!el || !window.Chart) return null;
        config.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: { duration: 300 } }, config.options || {});
        charts[canvasId] = new window.Chart(el, config);
        return charts[canvasId];
    }

    function status(el, msg, erro) {
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'rl-status' + (erro ? ' erro' : '');
    }

    window.RL = { MESES, MESES_LONGOS, CORES, esc, moeda, numero, data, hojeISO, inicioMesISO, inicioAnoISO, get, tabela, exportarCSV, imprimir, grafico, status, nomeIgreja };
})();
