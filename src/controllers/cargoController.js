const { createHttpError } = require('../utils/httpError');
const cargoService = require('../services/cargoService');
const { audit } = require('../services/auditService');

async function listCargos(req, res) {
    const igrejaId = Number(req.auth.igrejaId || 1);
    const rows = await cargoService.listCargos(igrejaId);
    res.json(rows);
}

async function createCargo(req, res) {
    const { descricao } = req.validatedBody;

    const igrejaId = Number(req.auth.igrejaId || 1);

    try {
        await cargoService.createCargo(igrejaId, descricao);
        audit('cargo.create', req, { descricao });
        res.status(201).json({ message: 'Cargo criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw createHttpError(409, 'Já existe um cargo com essa descrição.');
        }
        throw error;
    }
}

async function updateCargo(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    const igrejaId = Number(req.auth.igrejaId || 1);
    const { descricao } = req.validatedBody;

    if (!Number.isInteger(id) || id <= 0) {
        throw createHttpError(400, 'ID inválido.');
    }

    try {
        const affectedRows = await cargoService.updateCargo(id, igrejaId, descricao);

        if (!affectedRows) {
            throw createHttpError(404, 'Cargo não encontrado.');
        }

        audit('cargo.update', req, { id, descricao });
        res.json({ message: 'Cargo atualizado com sucesso.' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw createHttpError(409, 'Já existe um cargo com essa descrição.');
        }
        throw error;
    }
}

async function deleteCargo(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    const igrejaId = Number(req.auth.igrejaId || 1);

    if (!Number.isInteger(id) || id <= 0) {
        throw createHttpError(400, 'ID inválido.');
    }

    const affectedRows = await cargoService.deleteCargo(id, igrejaId);

    if (!affectedRows) {
        throw createHttpError(404, 'Cargo não encontrado.');
    }

    audit('cargo.delete', req, { id });
    res.json({ message: 'Cargo excluído com sucesso.' });
}

module.exports = {
    createCargo,
    deleteCargo,
    listCargos,
    updateCargo
};