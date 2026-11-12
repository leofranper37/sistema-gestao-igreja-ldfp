'use strict';

/**
 * Lote 7 — Verificação em duas etapas: configuração pelo próprio usuário do painel
 * (qualquer papel, inclusive super-admin — '/api/2fa/' está liberado no churchGuard).
 *
 *  GET  /api/2fa/status
 *  POST /api/2fa/iniciar        { senha }            → segredo + otpauth (QR)
 *  POST /api/2fa/ativar         { codigo }           → códigos de recuperação (mostrados 1 vez)
 *  POST /api/2fa/desativar      { senha, codigo }
 *  POST /api/2fa/recuperacao    { codigo }           → novos códigos de recuperação
 *  POST /api/saas/usuarios/:id/2fa/desativar         (super-admin: usuário perdeu o celular)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const { requireAuth, authorize } = require('../middlewares/auth');
const { createHttpError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const doisFatores = require('../services/doisFatoresService');

const router = express.Router();

function usuarioPainel(req) {
    if (req.auth?.app_mode) throw createHttpError(403, 'Disponível apenas para usuários do painel.');
    const id = Number(req.auth?.id);
    if (!id) throw createHttpError(401, 'Sessão inválida.');
    return id;
}

router.get('/api/2fa/status', requireAuth, async (req, res) => {
    res.json(await doisFatores.status(usuarioPainel(req)));
});

router.post('/api/2fa/iniciar', requireAuth, async (req, res) => {
    const id = usuarioPainel(req);
    res.json(await doisFatores.iniciar(id, req.body?.senha, bcrypt));
});

router.post('/api/2fa/ativar', requireAuth, async (req, res) => {
    const id = usuarioPainel(req);
    const r = await doisFatores.ativar(id, req.body?.codigo);
    audit('account.2fa.ativado', req, { userId: id });
    res.json(r);
});

router.post('/api/2fa/desativar', requireAuth, async (req, res) => {
    const id = usuarioPainel(req);
    await doisFatores.desativar(id, req.body?.senha, req.body?.codigo, bcrypt);
    audit('account.2fa.desativado', req, { userId: id });
    res.json({ ok: true });
});

router.post('/api/2fa/recuperacao', requireAuth, async (req, res) => {
    const id = usuarioPainel(req);
    const r = await doisFatores.novosCodigos(id, req.body?.codigo);
    audit('account.2fa.novos_codigos', req, { userId: id });
    res.json(r);
});

router.post('/api/saas/usuarios/:id/2fa/desativar', requireAuth, authorize(['super-admin']), async (req, res) => {
    const alvo = Number(req.params.id);
    if (!Number.isInteger(alvo) || alvo <= 0) throw createHttpError(400, 'Usuário inválido.');
    const u = await doisFatores.lerUsuario(alvo);
    if (!u) throw createHttpError(404, 'Usuário não encontrado.');
    await doisFatores.desligar(alvo);
    audit('saas.usuario.2fa_desativado', req, { alvo, email: u.email });
    res.json({ ok: true, message: `Verificação em duas etapas desligada para ${u.email}.` });
});

module.exports = router;
