const agendaModel = require('../models/agendaModel');
const { createHttpError } = require('../utils/httpError');

function normalizeDateRange(start, end) {
    const now = new Date();
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);

    const startDate = start ? new Date(start) : defaultStart;
    const endDate = end ? new Date(end) : defaultEnd;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
        throw createHttpError(400, 'Período da agenda inválido.');
    }

    if (endDate <= startDate) {
        throw createHttpError(400, 'Data final deve ser maior que a data inicial do período.');
    }

    return { startDate, endDate };
}

function normalizeEventoPayload(payload) {
    const titulo = String(payload.titulo || '').trim();
    const descricao = String(payload.descricao || '').trim();
    const inicio = new Date(payload.inicio);
    const fim = new Date(payload.fim);

    if (!titulo) {
        throw createHttpError(400, 'Título do evento é obrigatório.');
    }

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
        throw createHttpError(400, 'Data/hora do evento inválida.');
    }

    if (fim <= inicio) {
        throw createHttpError(400, 'Data/hora de fim deve ser maior que início.');
    }

    return {
        titulo,
        descricao: descricao || null,
        inicio: inicio.toISOString().slice(0, 19).replace('T', ' '),
        fim: fim.toISOString().slice(0, 19).replace('T', ' ')
    };
}

function mapEvento(row) {
    return {
        id: row.id,
        titulo: row.titulo,
        descricao: row.descricao || '',
        inicio: row.inicio,
        fim: row.fim,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

async function listEventos({ igrejaId, start, end }) {
    const { startDate, endDate } = normalizeDateRange(start, end);
    const rows = await agendaModel.listEventosByPeriodo({
        igrejaId,
        startDate: startDate.toISOString().slice(0, 19).replace('T', ' '),
        endDate: endDate.toISOString().slice(0, 19).replace('T', ' ')
    });

    return rows.map(mapEvento);
}

async function createEvento({ igrejaId, payload }) {
    const normalized = normalizeEventoPayload(payload);
    const id = await agendaModel.createEvento({ igrejaId, ...normalized });
    return agendaModel.getEventoById({ igrejaId, id });
}

async function updateEvento({ igrejaId, id, payload }) {
    const normalized = normalizeEventoPayload(payload);
    const affected = await agendaModel.updateEvento({ igrejaId, id, ...normalized });

    if (!affected) {
        throw createHttpError(404, 'Evento não encontrado.');
    }

    return agendaModel.getEventoById({ igrejaId, id });
}

async function deleteEvento({ igrejaId, id }) {
    const affected = await agendaModel.deleteEvento({ igrejaId, id });

    if (!affected) {
        throw createHttpError(404, 'Evento não encontrado.');
    }
}

module.exports = {
    createEvento,
    deleteEvento,
    listEventos,
    updateEvento
};
