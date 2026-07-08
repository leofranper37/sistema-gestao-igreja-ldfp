'use strict';
const { pool } = require('../config/db');
const { audit } = require('../services/auditService');
const getIgrejaId = require('../utils/getIgrejaId');

function fmtDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d.toISOString().slice(0, 10);
    return String(d).slice(0, 10);
}

function formatRow(row) {
    if (!row) return row;
    return {
        ...row,
        nascimento:   fmtDate(row.nascimento),
        created_at:   row.created_at ? String(row.created_at) : null,
        updated_at:   row.updated_at ? String(row.updated_at) : null,
    };
}

async function listCriancas(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const { search, limit = 200, page = 1 } = req.query;

    let where = 'WHERE igreja_id = ?';
    const params = [igrejaId];

    if (search) {
        const like = `%${search}%`;
        where += ' AND (nome LIKE ? OR nome_pai LIKE ? OR nome_mae LIKE ? OR pai LIKE ? OR mae LIKE ? OR telefone LIKE ? OR celular LIKE ? OR cidade LIKE ?)';
        params.push(like, like, like, like, like, like, like, like);
    }

    const offset = (Number(page) - 1) * Number(limit);
    const [rows] = await pool.query(
        `SELECT * FROM criancas ${where} ORDER BY nome ASC LIMIT ? OFFSET ?`,
        [...params, Number(limit), offset]
    );

    return res.json(rows.map(formatRow));
}

async function getCrianca(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const [[row]] = await pool.query(
        'SELECT * FROM criancas WHERE id = ? AND igreja_id = ? LIMIT 1',
        [id, igrejaId]
    );
    if (!row) return res.status(404).json({ message: 'Criança não encontrada.' });

    return res.json(formatRow(row));
}

async function createCrianca(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const {
        nome, nascimento, apresentacao, sexo, situacao,
        pai, mae, nomePai, nomeMae,
        cep, endereco, numero, bairro, complemento, cidade, estado,
        telefone, celular, email, fotoUrl
    } = req.body || {};

    if (!nome || !String(nome).trim()) {
        return res.status(400).json({ message: 'Nome é obrigatório.' });
    }

    const [result] = await pool.query(
        `INSERT INTO criancas
         (igreja_id, nome, nascimento, apresentacao, sexo, situacao,
          pai, mae, nome_pai, nome_mae,
          cep, endereco, numero, bairro, complemento, cidade, estado,
          telefone, celular, email, foto_url)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
            igrejaId,
            String(nome).trim(),
            nascimento || null,
            apresentacao || null,
            sexo || null,
            situacao || null,
            pai || null,
            mae || null,
            nomePai || null,
            nomeMae || null,
            cep || null,
            endereco || null,
            numero || null,
            bairro || null,
            complemento || null,
            cidade || null,
            estado || null,
            telefone || null,
            celular || null,
            email || null,
            fotoUrl || null,
        ]
    );

    audit('crianca.create', req, { id: result.insertId, nome: String(nome).trim() });
    return res.status(201).json({ id: result.insertId, message: 'Criança cadastrada com sucesso.' });
}

async function updateCrianca(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const {
        nome, nascimento, apresentacao, sexo, situacao,
        pai, mae, nomePai, nomeMae,
        cep, endereco, numero, bairro, complemento, cidade, estado,
        telefone, celular, email, fotoUrl
    } = req.body || {};

    if (!nome || !String(nome).trim()) {
        return res.status(400).json({ message: 'Nome é obrigatório.' });
    }

    const [result] = await pool.query(
        `UPDATE criancas SET
         nome=?, nascimento=?, apresentacao=?, sexo=?, situacao=?,
         pai=?, mae=?, nome_pai=?, nome_mae=?,
         cep=?, endereco=?, numero=?, bairro=?, complemento=?, cidade=?, estado=?,
         telefone=?, celular=?, email=?, foto_url=?
         WHERE id = ? AND igreja_id = ?`,
        [
            String(nome).trim(),
            nascimento || null,
            apresentacao || null,
            sexo || null,
            situacao || null,
            pai || null,
            mae || null,
            nomePai || null,
            nomeMae || null,
            cep || null,
            endereco || null,
            numero || null,
            bairro || null,
            complemento || null,
            cidade || null,
            estado || null,
            telefone || null,
            celular || null,
            email || null,
            fotoUrl || null,
            id,
            igrejaId,
        ]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Criança não encontrada.' });
    audit('crianca.update', req, { id });
    return res.json({ message: 'Criança atualizada com sucesso.' });
}

async function deleteCrianca(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID inválido.' });

    const [result] = await pool.query(
        'DELETE FROM criancas WHERE id = ? AND igreja_id = ?',
        [id, igrejaId]
    );

    if (!result.affectedRows) return res.status(404).json({ message: 'Criança não encontrada.' });
    audit('crianca.delete', req, { id });
    return res.json({ message: 'Criança removida com sucesso.' });
}

module.exports = { listCriancas, getCrianca, createCrianca, updateCrianca, deleteCrianca };
