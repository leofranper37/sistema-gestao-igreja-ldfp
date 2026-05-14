const outrasIgrejasModel = require('../models/outrasIgrejasModel');
const { createHttpError } = require('../utils/httpError');

function sanitizeText(value) {
    const text = String(value || '').trim();
    return text || null;
}

function sanitizePayload(payload) {
    const nome = String(payload.nome || '').trim();
    if (!nome) {
        throw createHttpError(400, 'Nome da igreja é obrigatório.');
    }

    return {
        nome,
        sede: sanitizeText(payload.sede),
        endereco: sanitizeText(payload.endereco),
        bairro: sanitizeText(payload.bairro),
        cidade: sanitizeText(payload.cidade),
        cep: sanitizeText(payload.cep),
        estado: sanitizeText(payload.estado),
        telefone: sanitizeText(payload.telefone),
        celular: sanitizeText(payload.celular),
        email: sanitizeText(payload.email),
        responsavel: sanitizeText(payload.responsavel),
        cargo: sanitizeText(payload.cargo),
        nascimento: payload.nascimento || null,
        declaracao: sanitizeText(payload.declaracao)
    };
}

async function listOutrasIgrejas({ igrejaId, search }) {
    const termo = String(search || '').trim() || null;
    return outrasIgrejasModel.listOutrasIgrejas({ igrejaId, termo });
}

async function createOutrasIgreja({ igrejaId, payload }) {
    const normalized = sanitizePayload(payload);
    const id = await outrasIgrejasModel.createOutrasIgreja({ ...normalized, igrejaId });
    return outrasIgrejasModel.getOutrasIgrejaById({ igrejaId, id });
}

async function updateOutrasIgreja({ igrejaId, id, payload }) {
    const normalized = sanitizePayload(payload);
    const affected = await outrasIgrejasModel.updateOutrasIgreja({ igrejaId, id, payload: normalized });

    if (!affected) {
        throw createHttpError(404, 'Registro de igreja não encontrado.');
    }

    return outrasIgrejasModel.getOutrasIgrejaById({ igrejaId, id });
}

async function deleteOutrasIgreja({ igrejaId, id }) {
    const affected = await outrasIgrejasModel.deleteOutrasIgreja({ igrejaId, id });

    if (!affected) {
        throw createHttpError(404, 'Registro de igreja não encontrado.');
    }
}

module.exports = {
    createOutrasIgreja,
    deleteOutrasIgreja,
    listOutrasIgrejas,
    updateOutrasIgreja
};
