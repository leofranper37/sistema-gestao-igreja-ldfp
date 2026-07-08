'use strict';
const { pool } = require('../config/db');
const { audit } = require('../services/auditService');
const getIgrejaId = require('../utils/getIgrejaId');

// MySQL DATE fields come as JS Date objects when dateStrings is not set
function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function formatRow(row) {
    if (!row) return row;
    return {
        ...row,
        data_batismo: fmtDate(row.data_batismo),
        data_aula:    fmtDate(row.data_aula),
    };
}

async function listBatismos(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const { q, encerrado, limit = 100, page = 1 } = req.query;

    let where = 'WHERE b.igreja_id = ?';
    const params = [igrejaId];

    if (q) {
        where += ' AND (b.descricao LIKE ? OR b.pastor LIKE ? OR b.local_batismo LIKE ?)';
        const like = `%${q}%`;
        params.push(like, like, like);
    }
    if (encerrado) {
        where += ' AND b.encerrado = ?';
        params.push(encerrado);
    }

    const offset = (Number(page) - 1) * Number(limit);

    const [rows] = await pool.query(`
        SELECT b.*,
               COUNT(c.id)                        AS total_candidatos,
               SUM(c.status = 'Confirmado')        AS confirmados,
               SUM(c.status = 'Pendente')          AS pendentes,
               SUM(c.status = 'Desistiu')          AS desistiram
        FROM batismos b
        LEFT JOIN batismo_candidatos c ON c.batismo_id = b.id
        ${where}
        GROUP BY b.id
        ORDER BY b.data_batismo DESC, b.id DESC
        LIMIT ? OFFSET ?
    `, [...params, Number(limit), offset]);

    const [[{ total }]] = await pool.query(
        `SELECT COUNT(*) AS total FROM batismos b ${where}`, params
    );

    return res.json({ items: rows.map(formatRow), total: Number(total) });
}

async function getBatismo(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const [[batismo]] = await pool.query(
        'SELECT * FROM batismos WHERE id = ? AND igreja_id = ? LIMIT 1',
        [id, igrejaId]
    );
    if (!batismo) return res.status(404).json({ message: 'Batismo não encontrado.' });

    const [candidatos] = await pool.query(
        'SELECT * FROM batismo_candidatos WHERE batismo_id = ? ORDER BY id ASC',
        [id]
    );

    return res.json({ ...formatRow(batismo), candidatos });
}

async function createBatismo(req, res) {
    const igrejaId  = getIgrejaId(req.auth);
    const createdBy = req.auth?.id || null;

    const {
        descricao, data_batismo, horario, local_batismo, pastor, encerrado,
        congregacao, data_aula, professor_aula, local_aula, obs,
        total_batizados, fotografo, link_midia,
    } = req.body || {};

    if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ message: 'Descrição é obrigatória.' });
    }

    const [result] = await pool.query(`
        INSERT INTO batismos
          (igreja_id, descricao, data_batismo, horario, local_batismo, pastor, encerrado,
           congregacao, data_aula, professor_aula, local_aula, obs,
           total_batizados, fotografo, link_midia, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        igrejaId, String(descricao).trim(),
        data_batismo || null, horario || null, local_batismo || null,
        pastor || null,
        ['Não','Sim'].includes(encerrado) ? encerrado : 'Não',
        congregacao || null, data_aula || null,
        professor_aula || null, local_aula || null, obs || null,
        Number(total_batizados) || 0, fotografo || null, link_midia || null,
        createdBy,
    ]);

    const [[novo]] = await pool.query('SELECT * FROM batismos WHERE id = ?', [result.insertId]);
    audit('batismo.create', req, { id: result.insertId, descricao: String(descricao).trim() });
    return res.status(201).json({ ...formatRow(novo), candidatos: [] });
}

async function updateBatismo(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const [[existing]] = await pool.query(
        'SELECT id FROM batismos WHERE id = ? AND igreja_id = ? LIMIT 1',
        [id, igrejaId]
    );
    if (!existing) return res.status(404).json({ message: 'Batismo não encontrado.' });

    const {
        descricao, data_batismo, horario, local_batismo, pastor, encerrado,
        congregacao, data_aula, professor_aula, local_aula, obs,
        total_batizados, fotografo, link_midia,
    } = req.body || {};

    if (!descricao || !String(descricao).trim()) {
        return res.status(400).json({ message: 'Descrição é obrigatória.' });
    }

    await pool.query(`
        UPDATE batismos SET
          descricao = ?, data_batismo = ?, horario = ?, local_batismo = ?,
          pastor = ?, encerrado = ?, congregacao = ?, data_aula = ?,
          professor_aula = ?, local_aula = ?, obs = ?,
          total_batizados = ?, fotografo = ?, link_midia = ?
        WHERE id = ? AND igreja_id = ?
    `, [
        String(descricao).trim(),
        data_batismo || null, horario || null, local_batismo || null,
        pastor || null,
        ['Não','Sim'].includes(encerrado) ? encerrado : 'Não',
        congregacao || null, data_aula || null,
        professor_aula || null, local_aula || null, obs || null,
        Number(total_batizados) || 0, fotografo || null, link_midia || null,
        id, igrejaId,
    ]);

    const [[bat]] = await pool.query('SELECT * FROM batismos WHERE id = ?', [id]);
    const [candidatos] = await pool.query(
        'SELECT * FROM batismo_candidatos WHERE batismo_id = ? ORDER BY id ASC', [id]
    );
    audit('batismo.update', req, { id });
    return res.json({ ...formatRow(bat), candidatos });
}

async function deleteBatismo(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const [[existing]] = await pool.query(
        'SELECT id FROM batismos WHERE id = ? AND igreja_id = ? LIMIT 1',
        [id, igrejaId]
    );
    if (!existing) return res.status(404).json({ message: 'Batismo não encontrado.' });

    await pool.query('DELETE FROM batismo_candidatos WHERE batismo_id = ? AND igreja_id = ?', [id, igrejaId]);
    await pool.query('DELETE FROM batismos WHERE id = ? AND igreja_id = ?', [id, igrejaId]);
    audit('batismo.delete', req, { id });
    return res.json({ message: 'Batismo excluído com sucesso.' });
}

async function addCandidato(req, res) {
    const igrejaId  = getIgrejaId(req.auth);
    const batismoId = Number(req.params.id);
    if (!batismoId) return res.status(400).json({ message: 'ID inválido.' });

    const [[bat]] = await pool.query(
        'SELECT id FROM batismos WHERE id = ? AND igreja_id = ? LIMIT 1',
        [batismoId, igrejaId]
    );
    if (!bat) return res.status(404).json({ message: 'Batismo não encontrado.' });

    const { nome, telefone, status, membro_id } = req.body || {};
    if (!nome || !String(nome).trim()) {
        return res.status(400).json({ message: 'Nome do candidato é obrigatório.' });
    }

    if (membro_id) {
        const [[membro]] = await pool.query(
            'SELECT id FROM membros WHERE id = ? AND igreja_id = ?', [Number(membro_id), igrejaId]
        );
        if (!membro) return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    const validStatus = ['Pendente', 'Confirmado', 'Desistiu'];
    const [result] = await pool.query(`
        INSERT INTO batismo_candidatos (batismo_id, igreja_id, nome, telefone, status, membro_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `, [
        batismoId, igrejaId, String(nome).trim(),
        telefone || null,
        validStatus.includes(status) ? status : 'Pendente',
        membro_id ? Number(membro_id) : null,
    ]);

    const [[cand]] = await pool.query(
        'SELECT * FROM batismo_candidatos WHERE id = ?', [result.insertId]
    );
    audit('batismo.addCandidato', req, { batismoId, candidatoId: result.insertId, nome: String(nome).trim() });
    return res.status(201).json(cand);
}

async function updateCandidato(req, res) {
    const igrejaId  = getIgrejaId(req.auth);
    const batismoId = Number(req.params.id);
    const cid       = Number(req.params.cid);

    const [[cand]] = await pool.query(
        'SELECT id FROM batismo_candidatos WHERE id = ? AND batismo_id = ? AND igreja_id = ?',
        [cid, batismoId, igrejaId]
    );
    if (!cand) return res.status(404).json({ message: 'Candidato não encontrado.' });

    const { nome, telefone, status, membro_id } = req.body || {};
    const validStatus = ['Pendente', 'Confirmado', 'Desistiu'];

    if (membro_id) {
        const [[membro]] = await pool.query(
            'SELECT id FROM membros WHERE id = ? AND igreja_id = ?', [Number(membro_id), igrejaId]
        );
        if (!membro) return res.status(404).json({ message: 'Membro não encontrado.' });
    }

    await pool.query(`
        UPDATE batismo_candidatos SET
          nome = COALESCE(?, nome),
          telefone = ?,
          status = COALESCE(?, status),
          membro_id = ?
        WHERE id = ?
    `, [
        nome ? String(nome).trim() : null,
        telefone !== undefined ? (telefone || null) : undefined,
        validStatus.includes(status) ? status : null,
        membro_id !== undefined ? (membro_id ? Number(membro_id) : null) : undefined,
        cid,
    ]);

    const [[updated]] = await pool.query(
        'SELECT * FROM batismo_candidatos WHERE id = ?', [cid]
    );
    return res.json(updated);
}

async function deleteCandidato(req, res) {
    const igrejaId  = getIgrejaId(req.auth);
    const batismoId = Number(req.params.id);
    const cid       = Number(req.params.cid);

    const [[cand]] = await pool.query(
        'SELECT id FROM batismo_candidatos WHERE id = ? AND batismo_id = ? AND igreja_id = ?',
        [cid, batismoId, igrejaId]
    );
    if (!cand) return res.status(404).json({ message: 'Candidato não encontrado.' });

    await pool.query('DELETE FROM batismo_candidatos WHERE id = ? AND igreja_id = ?', [cid, igrejaId]);
    audit('batismo.deleteCandidato', req, { batismoId, candidatoId: cid });
    return res.json({ message: 'Candidato removido.' });
}

module.exports = {
    listBatismos, getBatismo, createBatismo, updateBatismo, deleteBatismo,
    addCandidato, updateCandidato, deleteCandidato,
};
