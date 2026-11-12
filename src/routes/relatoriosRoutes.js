'use strict';

const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const svc = require('../services/relatoriosService');

const router = express.Router();

const SECRETARIA = ['admin', 'secretaria', 'pastor'];
const TESOURARIA = ['admin', 'financeiro', 'tesoureiro', 'secretaria', 'pastor'];

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function datas(q) {
    return {
        inicio: ISO.test(String(q.inicio || '')) ? q.inicio : undefined,
        fim: ISO.test(String(q.fim || '')) ? q.fim : undefined
    };
}

function ano(q) {
    const y = Number(q.ano);
    return y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
}

const handle = (fn) => async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store');
        res.json(await fn(req.auth.igrejaId, req.query));
    } catch (err) {
        next(err);
    }
};

// ─── Secretaria ─────────────────────────────────────────────────────────────
router.get('/api/relatorios/secretaria/resumo', requireAuth, authorize(SECRETARIA),
    handle((igrejaId, q) => svc.secretariaResumo(igrejaId, { ...datas(q), situacao: q.situacao || undefined })));

router.get('/api/relatorios/secretaria/lista', requireAuth, authorize(SECRETARIA),
    handle((igrejaId, q) => svc.secretariaLista(igrejaId, {
        ...datas(q),
        tipo: String(q.tipo || 'membros'),
        situacao: q.situacao || undefined,
        sexo: q.sexo || undefined
    })));

router.get('/api/relatorios/secretaria/aniversariantes', requireAuth, authorize(SECRETARIA),
    handle((igrejaId, q) => svc.secretariaAniversariantes(igrejaId, {
        mes: Math.min(12, Math.max(1, Number(q.mes) || new Date().getMonth() + 1)),
        tipo: String(q.tipo || 'todos')
    })));

router.get('/api/relatorios/secretaria/batizados', requireAuth, authorize(SECRETARIA),
    handle((igrejaId, q) => svc.secretariaBatizados(igrejaId, datas(q))));

router.get('/api/relatorios/secretaria/grupos', requireAuth, authorize(SECRETARIA),
    handle((igrejaId, q) => svc.secretariaGrupos(igrejaId, datas(q))));

// ─── Tesouraria ─────────────────────────────────────────────────────────────
router.get('/api/relatorios/tesouraria/anual', requireAuth, authorize(TESOURARIA),
    handle((igrejaId, q) => svc.tesourariaAnual(igrejaId, { ano: ano(q) })));

router.get('/api/relatorios/tesouraria/dizimistas', requireAuth, authorize(TESOURARIA),
    handle((igrejaId, q) => svc.tesourariaDizimistas(igrejaId, {
        ano: ano(q),
        tipo: ['dizimo', 'oferta', 'missoes', 'outros', 'todos'].includes(q.tipo) ? q.tipo : 'dizimo'
    })));

router.get('/api/relatorios/tesouraria/movimento', requireAuth, authorize(TESOURARIA),
    handle((igrejaId, q) => svc.tesourariaMovimento(igrejaId, {
        ...datas(q),
        fonte: ['caixa', 'banco', 'contas', 'dizimos', 'geral'].includes(q.fonte) ? q.fonte : 'caixa',
        contaId: q.contaId && /^\d+$/.test(String(q.contaId)) ? Number(q.contaId) : undefined
    })));

router.get('/api/relatorios/tesouraria/contas-pagar', requireAuth, authorize(TESOURARIA),
    handle((igrejaId, q) => svc.tesourariaContasPagar(igrejaId, {
        ...datas(q),
        status: ['pendente', 'pago', 'cancelado'].includes(q.status) ? q.status : undefined
    })));

router.get('/api/relatorios/tesouraria/contas-bancarias', requireAuth, authorize(TESOURARIA),
    handle((igrejaId) => svc.tesourariaContasBancarias(igrejaId)));

// ─── Contabilidade (Lote 4) ─────────────────────────────────────────────────
const contabil = require('../services/relatoriosContabeisService');
const CONTABIL = TESOURARIA;

router.get('/api/relatorios/contabil/contas', requireAuth, authorize(CONTABIL),
    handle((igrejaId) => contabil.contasDisponiveis(igrejaId)));

router.get('/api/relatorios/contabil/diario', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.diario(igrejaId, datas(q))));

router.get('/api/relatorios/contabil/razao', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.razao(igrejaId, { ...datas(q), conta: q.conta ? String(q.conta).slice(0, 300) : undefined })));

router.get('/api/relatorios/contabil/balancete', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.balancete(igrejaId, { ...datas(q), zeradas: q.zeradas === 'true' })));

router.get('/api/relatorios/contabil/balanco', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.balanco(igrejaId, { data: ISO.test(String(q.data || '')) ? q.data : undefined })));

router.get('/api/relatorios/contabil/dre', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.dre(igrejaId, datas(q))));

router.get('/api/relatorios/contabil/dre-mensal', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.dreMensal(igrejaId, { ano: ano(q) })));

router.get('/api/relatorios/contabil/fluxo-caixa', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => (q.fonte === 'tesouraria'
        ? contabil.fluxoTesouraria(igrejaId, datas(q))
        : contabil.fluxoContabil(igrejaId, datas(q)))));

router.get('/api/relatorios/contabil/dmpl', requireAuth, authorize(CONTABIL),
    handle((igrejaId, q) => contabil.dmpl(igrejaId, { ano: ano(q) })));

module.exports = router;
