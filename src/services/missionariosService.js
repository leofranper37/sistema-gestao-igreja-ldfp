const missionariosModel = require('../models/missionariosModel');
const { createHttpError } = require('../utils/httpError');

function sanitizeText(value) {
    const text = String(value || '').trim();
    return text || null;
}

function sanitizePayload(payload) {
    const nome = String(payload.nome || '').trim();
    if (!nome) {
        throw createHttpError(400, 'Nome do missionário é obrigatório.');
    }

    return {
        nome,
        titulo: sanitizeText(payload.titulo),
        cep: sanitizeText(payload.cep),
        endereco: sanitizeText(payload.endereco),
        bairro: sanitizeText(payload.bairro),
        cidade: sanitizeText(payload.cidade),
        estado: sanitizeText(payload.estado),
        pais: sanitizeText(payload.pais),
        telefone: sanitizeText(payload.telefone),
        telefone2: sanitizeText(payload.telefone2),
        email: sanitizeText(payload.email),
        email2: sanitizeText(payload.email2),
        banco: sanitizeText(payload.banco),
        nomeAgencia: sanitizeText(payload.nomeAgencia),
        agencia: sanitizeText(payload.agencia),
        tipoConta: sanitizeText(payload.tipoConta),
        numeroConta: sanitizeText(payload.numeroConta),
        nomeContato: sanitizeText(payload.nomeContato),
        parentescoContato: sanitizeText(payload.parentescoContato),
        cepContato: sanitizeText(payload.cepContato),
        enderecoContato: sanitizeText(payload.enderecoContato),
        bairroContato: sanitizeText(payload.bairroContato),
        cidadeContato: sanitizeText(payload.cidadeContato),
        estadoContato: sanitizeText(payload.estadoContato),
        paisContato: sanitizeText(payload.paisContato),
        telefoneContato: sanitizeText(payload.telefoneContato),
        telefone2Contato: sanitizeText(payload.telefone2Contato),
        emailContato: sanitizeText(payload.emailContato),
        obs: sanitizeText(payload.obs)
    };
}

async function listMissionarios({ igrejaId, search }) {
    const termo = String(search || '').trim() || null;
    return missionariosModel.listMissionarios({ igrejaId, termo });
}

async function createMissionario({ igrejaId, payload }) {
    const normalized = sanitizePayload(payload);
    const id = await missionariosModel.createMissionario({ ...normalized, igrejaId });
    return missionariosModel.getMissionarioById({ igrejaId, id });
}

async function updateMissionario({ igrejaId, id, payload }) {
    const normalized = sanitizePayload(payload);
    const affected = await missionariosModel.updateMissionario({ igrejaId, id, payload: normalized });

    if (!affected) {
        throw createHttpError(404, 'Registro de missionário não encontrado.');
    }

    return missionariosModel.getMissionarioById({ igrejaId, id });
}

async function deleteMissionario({ igrejaId, id }) {
    const affected = await missionariosModel.deleteMissionario({ igrejaId, id });

    if (!affected) {
        throw createHttpError(404, 'Registro de missionário não encontrado.');
    }
}

module.exports = {
    createMissionario,
    deleteMissionario,
    listMissionarios,
    updateMissionario
};
