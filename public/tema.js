/* ==========================================================================
   LDFP — Tema do sistema (Automático / Claro / Escuro)
   Carregado no <head> de todas as páginas, antes do conteúdo aparecer.
   Preferência: localStorage['ldfpTema'] = 'auto' | 'claro' | 'escuro' (padrão: claro)
   Resultado:   <html data-tema-ativo="claro|escuro">

   No escuro, as páginas que ainda têm cores fixas (#fff, #333...) são
   convertidas automaticamente: a partir das folhas de estilo da própria
   página é gerada uma versão escura das cores (fundos claros → superfícies
   escuras, textos escuros → claros), preservando as cores de destaque.
   Telas já desenhadas para os dois temas (tesouraria-ui.css) não são convertidas.
   ========================================================================== */
(function () {
    'use strict';

    var CHAVE = 'ldfpTema';
    var root = document.documentElement;
    var midia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    var IGNORAR = /(tema-escuro|tesouraria-ui)\.css/;

    function ler() {
        try {
            var v = localStorage.getItem(CHAVE);
            return v === 'auto' || v === 'escuro' || v === 'claro' ? v : 'claro';
        } catch (_) { return 'claro'; }
    }

    function resolver(pref) {
        if (pref === 'auto') return midia && midia.matches ? 'escuro' : 'claro';
        return pref;
    }

    // ── Conversão de cores ───────────────────────────────────────────────
    var NOMES = { white: [255, 255, 255], black: [0, 0, 0], whitesmoke: [245, 245, 245], snow: [255, 250, 250], ghostwhite: [248, 248, 255], gainsboro: [220, 220, 220], lightgray: [211, 211, 211], lightgrey: [211, 211, 211], silver: [192, 192, 192], aliceblue: [240, 248, 255], ivory: [255, 255, 240], beige: [245, 245, 220], linen: [250, 240, 230], azure: [240, 255, 255], honeydew: [240, 255, 240], mintcream: [245, 255, 250], floralwhite: [255, 250, 240], oldlace: [253, 245, 230], seashell: [255, 245, 238], lavender: [230, 230, 250] };
    var RE_COR = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|rgba?\([^)]*\)|hsla?\([^)]*\)|\b(?:white|black|whitesmoke|snow|ghostwhite|gainsboro|lightgr[ae]y|silver|aliceblue|ivory|beige|linen|azure|honeydew|mintcream|floralwhite|oldlace|seashell|lavender)\b/g;

    function parse(c) {
        c = c.trim().toLowerCase();
        if (NOMES[c]) return NOMES[c].concat(1);
        if (c[0] === '#') {
            var h = c.slice(1);
            if (h.length <= 4) h = h.split('').map(function (x) { return x + x; }).join('');
            return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
        }
        var n = c.match(/[\d.]+%?/g);
        if (!n || n.length < 3) return null;
        var a = n[3] !== undefined ? (n[3].slice(-1) === '%' ? parseFloat(n[3]) / 100 : parseFloat(n[3])) : 1;
        if (c.indexOf('hsl') === 0) {
            var rgb = hslRgb(parseFloat(n[0]) / 360, parseFloat(n[1]) / 100, parseFloat(n[2]) / 100);
            return rgb.concat(a);
        }
        return [parseFloat(n[0]), parseFloat(n[1]), parseFloat(n[2]), a];
    }

    function rgbHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
        if (d) {
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    }

    function hslRgb(h, s, l) {
        if (!s) { var v = Math.round(l * 255); return [v, v, v]; }
        function f(p, q, t) {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        }
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
        return [f(p, q, h + 1 / 3), f(p, q, h), f(p, q, h - 1 / 3)].map(function (x) { return Math.round(x * 255); });
    }

    function saida(rgb, a) {
        return a < 1 ? 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + +a.toFixed(3) + ')' : 'rgb(' + rgb.join(', ') + ')';
    }

    // tipo: 'fundo' | 'texto' | 'borda'
    function converter(cor, tipo) {
        var p = parse(cor);
        if (!p || p[3] === 0) return cor;
        var hsl = rgbHsl(p[0], p[1], p[2]), h = hsl[0], s = hsl[1], l = hsl[2];
        // quase-brancos levemente coloridos (slate, cinza-azulado) viram o mesmo tom neutro do tema
        var neutro = s < 0.12 || (tipo !== 'texto' && l > 0.9 && s < 0.5);
        if (tipo === 'fundo') {
            if (l < 0.6) return cor; // já é escuro ou é uma cor de destaque (botões, faixas)
            var nl = 0.10 + (1 - l) * 0.38;
            return saida(hslRgb(neutro ? 0.47 : h, neutro ? 0.12 : Math.min(s, 0.6) * 0.45, nl), p[3]);
        }
        if (tipo === 'borda') {
            if (l < 0.6) return cor;
            return saida(hslRgb(neutro ? 0.47 : h, neutro ? 0.12 : s * 0.35, 0.19 + (1 - l) * 0.15), p[3]);
        }
        if (l > 0.5) return cor; // texto já claro (ex.: texto branco sobre botão)
        return saida(hslRgb(neutro ? 0.47 : h, neutro ? 0.08 : Math.min(s, 0.75), 0.9 - l * 0.42), p[3]);
    }

    function converterValor(valor, tipo) {
        if (!valor) return valor;
        RE_COR.lastIndex = 0;
        return valor.replace(RE_COR, function (c) { return converter(c, tipo); });
    }

    function tipoDaPropriedade(prop, valor) {
        if (prop === 'color' || prop === 'caret-color' || prop === '-webkit-text-fill-color') return 'texto';
        if (prop.indexOf('background') === 0) return 'fundo';
        if (prop.indexOf('border') === 0 || prop.indexOf('outline') === 0 || prop === 'column-rule-color') return 'borda';
        if (prop.indexOf('--') === 0) {
            var n = prop.toLowerCase();
            if (/text|title|muted|ink|fg|font|heading|label|titulo|texto/.test(n)) return 'texto';
            if (/border|line|divider|borda/.test(n)) return 'borda';
            if (/bg|background|surface|card|panel|soft|light|main|white|fundo|superficie/.test(n)) return 'fundo';
            // sem pista no nome: decide pela cor (bem clara = fundo, bem escura e neutra = texto)
            RE_COR.lastIndex = 0;
            var m = valor.match(RE_COR);
            if (!m || m.length !== 1) return null;
            var p = parse(m[0]);
            if (!p) return null;
            var hsl = rgbHsl(p[0], p[1], p[2]);
            if (hsl[2] >= 0.85) return 'fundo';
            if (hsl[2] <= 0.3 && hsl[1] < 0.35) return 'texto';
            return null;
        }
        return null;
    }

    // ── Gera a versão escura das folhas de estilo da página ──────────────
    function declaracoes(style) {
        var out = [];
        for (var i = 0; i < style.length; i++) {
            var prop = style[i];
            var valor = style.getPropertyValue(prop);
            if (!valor) continue;
            var tipo = tipoDaPropriedade(prop, valor);
            if (!tipo) continue;
            RE_COR.lastIndex = 0;
            if (!RE_COR.test(valor)) continue;
            var novo = converterValor(valor, tipo);
            if (novo !== valor) out.push(prop + ': ' + novo + (style.getPropertyPriority(prop) ? ' !important' : ''));
        }
        return out.join('; ');
    }

    function regras(lista) {
        var css = '';
        for (var i = 0; i < lista.length; i++) {
            var r = lista[i];
            if (r.type === 1) { // CSSStyleRule
                var d = declaracoes(r.style);
                if (d) css += r.selectorText + ' { ' + d + ' }\n';
            } else if (r.type === 4 && r.cssRules) { // @media
                var m = regras(r.cssRules);
                if (m) css += '@media ' + r.conditionText + ' {\n' + m + '}\n';
            } else if (r.type === 12 && r.cssRules) { // @supports
                var s = regras(r.cssRules);
                if (s) css += '@supports ' + r.conditionText + ' {\n' + s + '}\n';
            }
        }
        return css;
    }

    var tagGerada = null;
    var processadas = typeof WeakSet === 'function' ? new WeakSet() : null;
    var cssGerado = [];

    function gerarEscuro() {
        var folhas = document.styleSheets, novo = '';
        for (var i = 0; i < folhas.length; i++) {
            var f = folhas[i];
            if (f.ownerNode === tagGerada) continue;
            if (f.href && IGNORAR.test(f.href)) continue;
            if (f.ownerNode && f.ownerNode.hasAttribute && f.ownerNode.hasAttribute('data-tema-nao-converter')) continue;
            if (processadas && processadas.has(f)) continue;
            var lista;
            try { lista = f.cssRules; } catch (_) { continue; } // folhas de outro domínio (ex.: ícones)
            if (!lista) continue;
            if (processadas) processadas.add(f);
            novo += regras(lista);
        }
        if (!novo) return;
        cssGerado.push(novo);
        if (!tagGerada) {
            tagGerada = document.createElement('style');
            tagGerada.id = 'ldfp-tema-gerado';
        }
        tagGerada.textContent = cssGerado.join('\n');
        // sempre por último (fim do body), para valer sobre as regras originais de mesma especificidade
        (document.body || document.head).appendChild(tagGerada);
    }

    // Estilos escritos direto no elemento (style="background:#fff")
    var ATTR_ORIG = 'data-tema-orig';
    function converterInline(el) {
        if (!el.style || !el.getAttribute) return;
        var atual = el.getAttribute('style') || '';
        if (!atual || !(/#|rgb|hsl|white|black/i).test(atual)) return;
        if (el.closest && el.closest('.tx-page, .tx-modal-bg, .tx-toast')) return;
        var orig = el.getAttribute(ATTR_ORIG);
        if (orig !== null && el.getAttribute('data-tema-conv') === atual) return; // já convertido
        if (orig === null || el.getAttribute('data-tema-conv') !== atual) {
            orig = atual;
            el.setAttribute(ATTR_ORIG, orig);
        }
        var d = declaracoes(el.style);
        if (!d) { el.setAttribute('data-tema-conv', atual); return; }
        d.split('; ').forEach(function (par) {
            var i = par.indexOf(': ');
            var prop = par.slice(0, i), resto = par.slice(i + 2), imp = / !important$/.test(resto);
            el.style.setProperty(prop, resto.replace(/ !important$/, ''), imp ? 'important' : '');
        });
        el.setAttribute('data-tema-conv', el.getAttribute('style') || '');
    }

    function restaurarInline() {
        var els = document.querySelectorAll('[' + ATTR_ORIG + ']');
        for (var i = 0; i < els.length; i++) {
            els[i].setAttribute('style', els[i].getAttribute(ATTR_ORIG));
            els[i].removeAttribute(ATTR_ORIG);
            els[i].removeAttribute('data-tema-conv');
        }
    }

    var observador = null, agendado = false;
    function agendar() {
        if (agendado) return;
        agendado = true;
        (window.requestAnimationFrame || setTimeout)(function () {
            agendado = false;
            if (root.getAttribute('data-tema-ativo') !== 'escuro') return;
            gerarEscuro();
        });
    }

    function ligarConversao() {
        gerarEscuro();
        var els = document.querySelectorAll('[style]');
        for (var i = 0; i < els.length; i++) converterInline(els[i]);
        if (observador || !window.MutationObserver) return;
        observador = new MutationObserver(function (muts) {
            if (root.getAttribute('data-tema-ativo') !== 'escuro') return;
            for (var i = 0; i < muts.length; i++) {
                var m = muts[i];
                if (m.type === 'attributes') { converterInline(m.target); continue; }
                for (var j = 0; j < m.addedNodes.length; j++) {
                    var n = m.addedNodes[j];
                    if (n.nodeType !== 1) continue;
                    if (n.tagName === 'STYLE' || n.tagName === 'LINK') { if (n !== tagGerada) { agendar(); n.addEventListener && n.addEventListener('load', agendar); } continue; }
                    if (n.hasAttribute('style')) converterInline(n);
                    var filhos = n.querySelectorAll ? n.querySelectorAll('[style]') : [];
                    for (var k = 0; k < filhos.length; k++) converterInline(filhos[k]);
                }
            }
        });
        observador.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['style'] });
    }

    function desligarConversao() {
        if (observador) { observador.disconnect(); observador = null; }
        if (tagGerada && tagGerada.parentNode) tagGerada.parentNode.removeChild(tagGerada);
        tagGerada = null;
        cssGerado = [];
        processadas = typeof WeakSet === 'function' ? new WeakSet() : null;
        restaurarInline();
    }

    // ── Aplicar ──────────────────────────────────────────────────────────
    function aplicar() {
        var ativo = resolver(ler());
        var antes = root.getAttribute('data-tema-ativo');
        root.setAttribute('data-tema-ativo', ativo);
        root.style.colorScheme = ativo === 'escuro' ? 'dark' : 'light';
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', ativo === 'escuro' ? '#0e1413' : '#0f766e');

        if (ativo === 'escuro') {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', ligarConversao, { once: true });
            } else {
                ligarConversao();
            }
            window.addEventListener('load', agendar, { once: true });
        } else if (antes === 'escuro') {
            desligarConversao();
        }
    }

    // Folha com o acabamento escuro do menu, cabeçalho e base (só vale com data-tema-ativo="escuro")
    (function carregarFolha() {
        if (document.getElementById('ldfp-tema-css')) return;
        var src = (document.currentScript && document.currentScript.src) || 'tema.js';
        var link = document.createElement('link');
        link.id = 'ldfp-tema-css';
        link.rel = 'stylesheet';
        link.href = src.replace(/tema\.js(\?.*)?$/, 'tema-escuro.css');
        (document.head || root).appendChild(link);
    })();

    aplicar();

    if (midia) {
        var aoMudarSistema = function () { if (ler() === 'auto') aplicar(); };
        if (midia.addEventListener) midia.addEventListener('change', aoMudarSistema);
        else if (midia.addListener) midia.addListener(aoMudarSistema);
    }

    // Mudou em outra aba
    window.addEventListener('storage', function (e) { if (e.key === CHAVE) aplicar(); });

    window.LDFPTema = {
        obter: ler,
        ativo: function () { return root.getAttribute('data-tema-ativo'); },
        definir: function (pref) {
            try { localStorage.setItem(CHAVE, pref); } catch (_) { /* sem storage */ }
            aplicar();
        }
    };
})();
