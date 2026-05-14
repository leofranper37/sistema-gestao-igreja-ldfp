const cargoModel = require('../models/cargoModel');

async function listCargos(igrejaId) {
    return cargoModel.listCargos(igrejaId);
}

async function createCargo(igrejaId, descricao) {
    await cargoModel.createCargo(igrejaId, descricao);
}

async function updateCargo(id, igrejaId, descricao) {
    return cargoModel.updateCargo(id, igrejaId, descricao);
}

async function deleteCargo(id, igrejaId) {
    return cargoModel.deleteCargo(id, igrejaId);
}

module.exports = {
    createCargo,
    deleteCargo,
    listCargos,
    updateCargo
};