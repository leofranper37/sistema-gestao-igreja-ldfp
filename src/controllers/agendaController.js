const agendaService = require('../services/agendaService');
const { audit } = require('../services/auditService');

function getIgrejaId(req) {
    return Number(req.auth?.igrejaId || 1);
}

async function listEventos(req, res) {
    const igrejaId = getIgrejaId(req);
    const query = req.validatedQuery || {};

    const items = await agendaService.listEventos({
        igrejaId,
        start: query.start || null,
        end: query.end || null
    });

    res.json(items);
}

async function createEvento(req, res) {
    const igrejaId = getIgrejaId(req);
    const payload = req.validatedBody;

    const created = await agendaService.createEvento({ igrejaId, payload });
    audit('agenda.evento.create', req, { titulo: created?.titulo, inicio: created?.inicio, fim: created?.fim });

    res.status(201).json({
        message: 'Evento criado com sucesso.',
        event: created
    });
}

async function updateEvento(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);
    const payload = req.validatedBody;

    const updated = await agendaService.updateEvento({ igrejaId, id, payload });
    audit('agenda.evento.update', req, { id, titulo: updated?.titulo, inicio: updated?.inicio, fim: updated?.fim });

    res.json({
        message: 'Evento atualizado com sucesso.',
        event: updated
    });
}

async function deleteEvento(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);

    await agendaService.deleteEvento({ igrejaId, id });
    audit('agenda.evento.delete', req, { id });

    res.json({ message: 'Evento removido com sucesso.' });
}

module.exports = {
    createEvento,
    deleteEvento,
    listEventos,
    updateEvento
};
