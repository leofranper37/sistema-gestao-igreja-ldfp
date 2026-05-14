const missionariosService = require('../services/missionariosService');
const { audit } = require('../services/auditService');

function getIgrejaId(req) {
    return Number(req.auth?.igrejaId || 1);
}

async function listMissionarios(req, res) {
    const igrejaId = getIgrejaId(req);
    const query = req.validatedQuery || {};

    const rows = await missionariosService.listMissionarios({
        igrejaId,
        search: query.search || null
    });

    res.json(rows);
}

async function createMissionario(req, res) {
    const igrejaId = getIgrejaId(req);
    const payload = req.validatedBody;

    const created = await missionariosService.createMissionario({ igrejaId, payload });
    audit('missionarios.create', req, { nome: created?.nome, cidade: created?.cidade || null, pais: created?.pais || null });

    res.status(201).json({
        message: 'Missionário cadastrado com sucesso.',
        item: created
    });
}

async function updateMissionario(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);
    const payload = req.validatedBody;

    const updated = await missionariosService.updateMissionario({ igrejaId, id, payload });
    audit('missionarios.update', req, { id, nome: updated?.nome, cidade: updated?.cidade || null, pais: updated?.pais || null });

    res.json({
        message: 'Missionário atualizado com sucesso.',
        item: updated
    });
}

async function deleteMissionario(req, res) {
    const igrejaId = getIgrejaId(req);
    const id = Number(req.params.id);

    await missionariosService.deleteMissionario({ igrejaId, id });
    audit('missionarios.delete', req, { id });

    res.json({ message: 'Missionário removido com sucesso.' });
}

module.exports = {
    createMissionario,
    deleteMissionario,
    listMissionarios,
    updateMissionario
};
