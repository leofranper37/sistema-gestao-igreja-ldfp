'use strict';

const express = require('express');
const Joi = require('joi');
const { authorize, requireAuth } = require('../middlewares/auth');
const { validateBody } = require('../utils/validation');
const getIgrejaId = require('../utils/getIgrejaId');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');
const model = require('../models/cadastrosTesourariaModel');

const router = express.Router();

const LEITURA = ['admin', 'financeiro', 'tesoureiro', 'secretaria', 'pastor'];
const ESCRITA = ['admin', 'financeiro', 'tesoureiro', 'secretaria'];

const txt = (max) => Joi.string().trim().max(max).allow('', null).optional();

const SCHEMAS = {
    fornecedores: Joi.object({
        nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
        cpf_cnpj: txt(30).label('CPF/CNPJ'),
        telefone: txt(60).label('Telefone'),
        email: Joi.string().trim().email({ tlds: { allow: false } }).max(255).allow('', null).optional().label('E-mail'),
        endereco: txt(255).label('Endereço'),
        cidade: txt(120).label('Cidade'),
        observacao: txt(2000).label('Observação'),
        ativo: Joi.boolean().optional()
    }),
    'centros-custo': Joi.object({
        codigo: txt(30).label('Código'),
        nome: Joi.string().trim().min(2).max(150).required().label('Nome'),
        descricao: txt(255).label('Descrição'),
        ativo: Joi.boolean().optional()
    }),
    'tipos-documento': Joi.object({
        nome: Joi.string().trim().min(2).max(100).required().label('Nome'),
        ativo: Joi.boolean().optional()
    })
};

const RECURSOS = Object.keys(SCHEMAS);

function validar(req, res, next) {
    const schema = SCHEMAS[req.params.recurso];
    if (!schema) return next(createHttpError(404, 'Cadastro inválido.'));
    return validateBody(schema)(req, res, next);
}

function checarRecurso(req, _res, next) {
    if (!RECURSOS.includes(req.params.recurso)) return next(createHttpError(404, 'Cadastro inválido.'));
    return next();
}

const base = '/api/tesouraria/:recurso';

router.get(base, requireAuth, authorize(LEITURA), checarRecurso, async (req, res) => {
    const itens = await model.listar(req.params.recurso, getIgrejaId(req.auth), { todos: req.query.todos === '1' });
    res.set('Cache-Control', 'no-store');
    res.json({ items: itens });
});

router.post(base, requireAuth, authorize(ESCRITA), validar, async (req, res) => {
    const igrejaId = getIgrejaId(req.auth);
    const id = await model.criar(req.params.recurso, igrejaId, req.validatedBody, req.auth.id);
    audit(`tesouraria.${req.params.recurso}.create`, req, { id });
    res.status(201).json({ id, message: 'Cadastro salvo.' });
});

router.put(`${base}/:id`, requireAuth, authorize(ESCRITA), validar, async (req, res) => {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const n = await model.atualizar(req.params.recurso, id, igrejaId, req.validatedBody);
    if (!n) throw createHttpError(404, 'Registro não encontrado.');
    audit(`tesouraria.${req.params.recurso}.update`, req, { id });
    res.json({ message: 'Cadastro atualizado.' });
});

router.delete(`${base}/:id`, requireAuth, authorize(ESCRITA), checarRecurso, async (req, res) => {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);
    const n = await model.desativar(req.params.recurso, id, igrejaId);
    if (!n) throw createHttpError(404, 'Registro não encontrado.');
    audit(`tesouraria.${req.params.recurso}.desativar`, req, { id });
    res.json({ message: 'Cadastro desativado.' });
});

module.exports = router;
