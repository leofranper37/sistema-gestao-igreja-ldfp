/* Tesouraria LDFP — utilitários comuns das telas (dízimos, caixa, bancos) */
(function () {
    'use strict';

    const fmtBRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

    function money(valor) {
        const n = Number(valor);
        return fmtBRL.format(Number.isFinite(n) ? n : 0);
    }

    // "1.234,56" | "1234.56" | 1234.56 → 1234.56
    function parseMoney(valor) {
        if (typeof valor === 'number') return valor;
        const s = String(valor || '').replace(/[^\d,.-]/g, '');
        if (!s) return 0;
        if (s.includes(',')) return Number(s.replace(/\./g, '').replace(',', '.')) || 0;
        return Number(s) || 0;
    }

    // Campo de valor no estilo calculadora: digitar 1-5-0-0-0 vira 150,00
    function maskMoney(input, aoMudar) {
        const aplicar = () => {
            const centavos = Number(String(input.value).replace(/\D/g, '').slice(0, 13) || '0');
            input.value = (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (aoMudar) aoMudar(centavos / 100);
        };
        input.addEventListener('input', aplicar);
        input.addEventListener('focus', () => setTimeout(() => { if (document.activeElement === input) input.select(); }, 0));
        if (!input.value) input.value = '0,00';
        return {
            set(valor) {
                input.value = Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                if (aoMudar) aoMudar(Number(valor || 0));
            },
            get: () => parseMoney(input.value)
        };
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    // Competência no formato da API: "MM/AAAA"
    function competenciaAtual() {
        const d = new Date();
        return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    }
    // "2026-11" (input month) ↔ "11/2026" (API)
    function mesParaCompetencia(mes) {
        const m = String(mes || '').match(/^(\d{4})-(\d{2})$/);
        return m ? `${m[2]}/${m[1]}` : '';
    }
    function competenciaParaMes(comp) {
        const m = String(comp || '').match(/^(\d{2})\/(\d{4})$/);
        return m ? `${m[2]}-${m[1]}` : '';
    }

    function dataBR(valor) {
        if (!valor) return '—';
        const s = String(valor);
        const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        const d = new Date(s.replace(' ', 'T'));
        return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
    }

    function esc(valor) {
        return String(valor == null ? '' : valor)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    }

    // fetch com JSON e mensagem de erro legível (o token é anexado pelo session.js)
    async function api(url, opcoes = {}) {
        const init = { ...opcoes, headers: { Accept: 'application/json', ...(opcoes.headers || {}) } };
        if (init.body && typeof init.body !== 'string') {
            init.body = JSON.stringify(init.body);
            init.headers['Content-Type'] = 'application/json';
        }
        const r = await fetch(url, init);
        let dados = null;
        try { dados = await r.json(); } catch (_) { /* resposta sem corpo */ }
        if (!r.ok) {
            const msg = (dados && (dados.error || dados.message)) || `Erro ${r.status}`;
            const erro = new Error(msg);
            erro.status = r.status;
            throw erro;
        }
        return dados;
    }

    let toastTimer;
    function toast(msg, tipo = 'ok') {
        let el = document.getElementById('txToast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'txToast';
            el.className = 'tx-toast';
            el.setAttribute('role', 'status');
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.toggle('erro', tipo === 'erro');
        el.classList.add('visivel');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => el.classList.remove('visivel'), 3800);
    }

    // Mensagem deixada por outra página (ex.: "Lançamento salvo") antes de redirecionar
    function toastPendente() {
        try {
            const m = sessionStorage.getItem('txToast');
            if (m) { sessionStorage.removeItem('txToast'); toast(m); }
        } catch (_) { /* sem storage */ }
    }
    function toastDepois(msg) {
        try { sessionStorage.setItem('txToast', msg); } catch (_) { /* sem storage */ }
    }

    function confirmar({ titulo, texto, botao = 'Excluir', perigo = true }) {
        return new Promise((resolve) => {
            const bg = document.createElement('div');
            bg.className = 'tx-modal-bg aberto';
            bg.innerHTML = `
                <div class="tx-modal" role="dialog" aria-modal="true">
                    <header><span>${esc(titulo)}</span><button type="button" data-x aria-label="Fechar">&times;</button></header>
                    <div class="corpo">${esc(texto)}</div>
                    <footer>
                        <button type="button" class="tx-btn tx-btn-ghost" data-x>Cancelar</button>
                        <button type="button" class="tx-btn ${perigo ? 'tx-btn-danger' : 'tx-btn-primary'}" data-ok>${esc(botao)}</button>
                    </footer>
                </div>`;
            const fechar = (ok) => { bg.remove(); document.removeEventListener('keydown', tecla); resolve(ok); };
            const tecla = (e) => { if (e.key === 'Escape') fechar(false); };
            bg.addEventListener('click', (e) => {
                if (e.target === bg || e.target.closest('[data-x]')) fechar(false);
                if (e.target.closest('[data-ok]')) fechar(true);
            });
            document.addEventListener('keydown', tecla);
            document.body.appendChild(bg);
            bg.querySelector('[data-ok]').focus();
        });
    }

    const TIPOS = {
        dizimo: 'Dízimo',
        oferta: 'Oferta',
        missoes: 'Missões',
        outros: 'Outros'
    };
    const PUBLICOS = {
        membro: 'Membro',
        visitante: 'Visitante',
        congregado: 'Congregado',
        crianca: 'Criança'
    };

    window.TX = {
        money, parseMoney, maskMoney, hojeISO, competenciaAtual, mesParaCompetencia,
        competenciaParaMes, dataBR, esc, debounce, api, toast, toastPendente, toastDepois,
        confirmar, TIPOS, PUBLICOS
    };
})();
