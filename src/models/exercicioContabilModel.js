/**
 * Exercícios contábeis encerrados. Depois de encerrar um ano, nada com data dentro dele
 * pode ser criado, alterado ou excluído — nem na Contabilidade, nem no Caixa/Bancos.
 */
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

let colunasOk = false;

async function ensure() {
    if (colunasOk) return;
    await pool.query(
        `CREATE TABLE IF NOT EXISTS contabilidade_encerramentos (
            id VARCHAR(80) PRIMARY KEY,
            igreja_id INTEGER NOT NULL,
            usuario_nome VARCHAR(255) NOT NULL,
            observacao VARCHAR(500) NOT NULL,
            created_by INTEGER NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`
    );
    for (const ddl of [
        'ALTER TABLE contabilidade_encerramentos ADD COLUMN ano INTEGER NULL',
        'ALTER TABLE contabilidade_encerramentos ADD COLUMN resultado DECIMAL(14,2) NULL',
        'ALTER TABLE contabilidade_encerramentos ADD COLUMN sem_movimento INTEGER NOT NULL DEFAULT 0'
    ]) {
        try {
            await pool.query(ddl);
        } catch (e) {
            if (!/duplicate column|already exists/i.test(String(e && e.message))) throw e;
        }
    }
    colunasOk = true;
}

async function ultimoFechado(igrejaId) {
    await ensure();
    const [rows] = await pool.query(
        'SELECT MAX(ano) AS ano FROM contabilidade_encerramentos WHERE igreja_id = ? AND ano IS NOT NULL',
        [igrejaId]
    );
    const ano = rows[0] && rows[0].ano;
    return ano ? Number(ano) : null;
}

const isoData = (v) => {
    if (!v) return null;
    if (v instanceof Date) {
        const p = (n) => String(n).padStart(2, '0');
        return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    }
    return String(v).slice(0, 10);
};

// Lança 409 se alguma das datas cai num exercício já encerrado
async function exigirAberto(igrejaId, ...datas) {
    const validas = datas.map(isoData).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')));
    if (!validas.length) return;
    const ano = await ultimoFechado(igrejaId);
    if (!ano) return;
    const bloqueada = validas.find((d) => Number(d.slice(0, 4)) <= ano);
    if (bloqueada) {
        throw createHttpError(409, `O exercício de ${bloqueada.slice(0, 4)} já foi encerrado na Contabilidade. Movimentos com data até 31/12/${ano} não podem mais ser alterados.`);
    }
}

module.exports = { ensure, ultimoFechado, exigirAberto, isoData };
