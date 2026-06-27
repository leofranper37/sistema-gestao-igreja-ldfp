'use strict';

const { ensureSystemTables } = require('./systemModel');
const { ensureAgendaTable } = require('./agendaModel');
const { ensureMissionariosTable } = require('./missionariosModel');
const { ensureOutrasIgrejasTable } = require('./outrasIgrejasModel');
const { ensureFinanceTables } = require('./financeModel');

async function bootstrapAllTables() {
    await Promise.all([
        ensureSystemTables(),
        ensureAgendaTable(),
        ensureMissionariosTable(),
        ensureOutrasIgrejasTable(),
        ensureFinanceTables()
    ]);
}

module.exports = { bootstrapAllTables };
