const { createHttpError } = require('./httpError');

function getIgrejaId(auth) {
    const id = Number(auth?.igrejaId);
    if (!id) throw createHttpError(401, 'Token inválido: igrejaId ausente. Faça login novamente.');
    return id;
}

module.exports = getIgrejaId;
