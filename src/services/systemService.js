const systemModel = require('../models/systemModel');

async function listMembros(filters) {
    return systemModel.listMembros(filters);
}

async function listMembrosWithFilters(filters) {
    return systemModel.listMembrosWithFilters(filters);
}

async function createMembro(payload) {
    await systemModel.createMembro(payload);
}

async function listVisitantes({ igrejaId, search }) {
    return systemModel.listVisitantes({ igrejaId, search });
}

async function createVisitante(payload) {
    await systemModel.createVisitante(payload);
}

async function updateVisitante(payload) {
    return systemModel.updateVisitante(payload);
}

async function deleteVisitante(payload) {
    return systemModel.deleteVisitante(payload);
}

async function listCongregados({ igrejaId, search }) {
    return systemModel.listCongregados({ igrejaId, search });
}

async function createCongregado(payload) {
    await systemModel.createCongregado(payload);
}

async function updateCongregado(payload) {
    return systemModel.updateCongregado(payload);
}

async function deleteCongregado(payload) {
    return systemModel.deleteCongregado(payload);
}

async function listCriancas({ igrejaId, search }) {
    return systemModel.listCriancas({ igrejaId, search });
}

async function createCrianca(payload) {
    await systemModel.createCrianca(payload);
}

async function updateCrianca(payload) {
    return systemModel.updateCrianca(payload);
}

async function deleteCrianca(payload) {
    return systemModel.deleteCrianca(payload);
}

async function listOracoesMy({ igrejaId, userId, status }) {
    return systemModel.listOracoesMy({ igrejaId, userId, status });
}

async function listOracoesMural({ igrejaId }) {
    return systemModel.listOracoesMural({ igrejaId });
}

async function getOracaoById({ igrejaId, id }) {
    return systemModel.getOracaoById({ igrejaId, id });
}

async function createOracao(payload) {
    await systemModel.createOracao(payload);
}

async function updateOracao(payload) {
    return systemModel.updateOracao(payload);
}

async function updateOracaoResposta(payload) {
    return systemModel.updateOracaoResposta(payload);
}

async function deleteOracao(payload) {
    return systemModel.deleteOracao(payload);
}

async function getTotalVisitantes(igrejaId) {
    return systemModel.countVisitantes(igrejaId);
}

async function getHealthStatus() {
    const databaseOk = await systemModel.pingDatabase();

    return {
        status: databaseOk ? 'ok' : 'degraded',
        database: databaseOk ? 'up' : 'down',
        timestamp: new Date().toISOString()
    };
}

module.exports = {
    createCrianca,
    createCongregado,
    createMembro,
    createOracao,
    createVisitante,
    deleteCrianca,
    deleteCongregado,
    deleteOracao,
    deleteVisitante,
    getOracaoById,
    getHealthStatus,
    getTotalVisitantes,
    listOracoesMural,
    listOracoesMy,
    listCriancas,
    listCongregados,
    listMembrosWithFilters,
    listMembros,
    listVisitantes,
    updateCrianca,
    updateCongregado,
    updateOracao,
    updateOracaoResposta,
    updateVisitante
};