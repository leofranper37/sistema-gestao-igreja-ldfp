const outrasIgrejasService = require('../services/outrasIgrejasService');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');

function getIgrejaId(req) {
    return Number(req.auth?.igrejaId || 1);
}

async function listOutrasIgrejas(req, res) {
    const igrejaId = getIgrejaId(req);
    const query = req.validatedQuery || {};

    const rows = await outrasIgrejasService.listOutrasIgrejas({
        igrejaId,
        search: query.search || null
    });

    res.json(rows);
}

async function createOutrasIgreja(req, res) {
    const igrejaId = getIgrejaId(req);
    const payload = req.validatedBody;
    const maxCongregacoes = Number(req.auth?.maxCongregacoes || 0);

    if (maxCongregacoes > 0) {
        const totalAtual = Number(await outrasIgrejasService.countOutrasIgrejas(igrejaId));
        if (totalAtual >= maxCongregacoes) {
            throw createHttpError(
                403,
                `Limite do plano atingido: seu plano permite até ${maxCongregacoes} congregação(ões). Faça upgrade para adicionar mais.`
            );
        }
    }

    const created = await outrasIgrejasService.createOutrasIgreja({ igrejaId, payload });
    audit('outras-igrejas.create', req, { nome: created?.nome, cidade: created?.cidade || null });

    res.status(201).json({
        message: 'Igreja cadastrada com sucesso.',
        item: created
    });
}

async function updateOutrasIgreja(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);
    const payload = req.validatedBody;

    const updated = await outrasIgrejasService.updateOutrasIgreja({ igrejaId, id, payload });
    audit('outras-igrejas.update', req, { id, nome: updated?.nome, cidade: updated?.cidade || null });

    res.json({
        message: 'Igreja atualizada com sucesso.',
        item: updated
    });
}

async function deleteOutrasIgreja(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);

    await outrasIgrejasService.deleteOutrasIgreja({ igrejaId, id });
    audit('outras-igrejas.delete', req, { id });

    res.json({ message: 'Igreja removida com sucesso.' });
}

async function getPainelCongregacoes(req, res) {
    const igrejaId = getIgrejaId(req);
    const limite = Number(req.auth?.maxCongregacoes || 0);
    const plano = req.auth?.plano || 'hebrom';

    const filiais = await outrasIgrejasService.listOutrasIgrejas({ igrejaId, search: null });
    const total = filiais.length;

    res.json({
        plano,
        limite,
        total,
        disponivel: limite > 0 ? Math.max(0, limite - total) : null,
        filiais
    });
}

module.exports = {
    createOutrasIgreja,
    deleteOutrasIgreja,
    getPainelCongregacoes,
    listOutrasIgrejas,
    updateOutrasIgreja
};
