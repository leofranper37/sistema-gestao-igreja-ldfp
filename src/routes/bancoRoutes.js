const express = require('express');
const { authorize, requireAuth } = require('../middlewares/auth');
const { bancoContaSchema, bancoLancamentoSchema, transferenciaSchema, validateBody } = require('../utils/validation');
const parseDecimal = require('../utils/parseDecimal');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const transferencias = require('../services/transferenciaService');
const c = require('../controllers/bancoController');

const router = express.Router();
const rw = ['admin', 'financeiro', 'secretaria'];
const ro = ['admin', 'financeiro', 'secretaria', 'pastor'];
const del = ['admin', 'financeiro'];

router.get('/banco/contas', requireAuth, authorize(ro), c.listContas);
router.get('/banco/contas/:id', requireAuth, authorize(ro), c.getConta);
router.post('/banco/contas', requireAuth, authorize(rw), validateBody(bancoContaSchema), c.createConta);
router.put('/banco/contas/:id', requireAuth, authorize(rw), validateBody(bancoContaSchema), c.updateConta);
router.delete('/banco/contas/:id', requireAuth, authorize(del), c.deleteConta);

router.get('/banco/contas-sugeridas', requireAuth, authorize(ro), c.contasSugeridas);
router.get('/banco/contas/:contaId/lancamentos', requireAuth, authorize(ro), c.listLancamentos);
router.post('/banco/contas/:contaId/lancamentos', requireAuth, authorize(rw), validateBody(bancoLancamentoSchema), c.createLancamento);
router.get('/banco/lancamentos/:id', requireAuth, authorize(ro), c.getLancamento);
router.put('/banco/lancamentos/:id', requireAuth, authorize(rw), validateBody(bancoLancamentoSchema), c.updateLancamento);
router.delete('/banco/lancamentos/:id', requireAuth, authorize(del), c.deleteLancamento);

// Transferências entre caixa e contas (a outra ponta é lançada automaticamente)
const MES_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
router.get('/banco/transferencias', requireAuth, authorize(ro), async (req, res) => {
    let inicio = null;
    let fim = null;
    if (MES_RE.test(String(req.query.mes || ''))) {
        const [a, m] = req.query.mes.split('-').map(Number);
        inicio = req.query.mes + '-01';
        fim = m === 12 ? (a + 1) + '-01-01' : a + '-' + String(m + 1).padStart(2, '0') + '-01';
    }
    res.json({ items: await transferencias.listar(getIgrejaId(req.auth), { inicio, fim }) });
});
router.post('/banco/transferencias', requireAuth, authorize(rw), validateBody(transferenciaSchema), async (req, res) => {
    const valor = parseDecimal(req.validatedBody.valor);
    const r = await transferencias.criar(getIgrejaId(req.auth), { ...req.validatedBody, valor }, req.auth.id);
    audit('banco.transferencia.create', req, { fonte: r.fonte, id: r.id });
    res.status(201).json({ message: 'Transferência registrada: ' + r.origem + ' → ' + r.destino + '.', ...r });
});

module.exports = router;
