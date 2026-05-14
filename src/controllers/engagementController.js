const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHttpError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const engagementService = require('../services/engagementService');
const realtime = require('../services/realtimeService');
const { pool } = require('../config/db');
const config = require('../config');

// ── APP DE MEMBROS: Auth por CPF ───────────────────────────────────

async function loginMembroApp(req, res) {
    const { cpf, senha, igreja_nome } = req.body || {};
    if (!cpf || !senha) {
        throw createHttpError(400, 'CPF e senha são obrigatórios.');
    }

    const cpfLimpo = String(cpf).replace(/\D/g, '');

    // Busca o membro pelo CPF — opcionalmente filtrando por nome de igreja
    let sql = `SELECT m.*, i.nome AS nome_igreja, i.id AS igreja_id_num
               FROM membros m
               INNER JOIN igrejas i ON i.id = m.igreja_id
               WHERE REPLACE(REPLACE(REPLACE(m.cpf, '.', ''), '-', ''), '/', '') = $1`;
    const params = [cpfLimpo];

    if (igreja_nome) {
        sql += ` AND LOWER(i.nome) = LOWER($2)`;
        params.push(String(igreja_nome).trim());
    }

    sql += ` LIMIT 1`;

    const [rows] = await pool.query(sql, params);
    const membro = rows[0];

    if (!membro) {
        throw createHttpError(404, 'Membro não encontrado. Verifique o CPF e o nome da igreja.');
    }

    // Verifica senha (hash bcrypt armazenado no campo app_senha)
    if (!membro.app_senha) {
        throw createHttpError(401, 'Este membro ainda não criou uma senha para o App. Use "Primeiro Acesso" para criar.');
    }

    const ok = await bcrypt.compare(String(senha), String(membro.app_senha));
    if (!ok) {
        throw createHttpError(401, 'Senha incorreta.');
    }

    const payload = {
        id: membro.id,
        nome: membro.nome,
        email: membro.email || '',
        igrejaId: membro.igreja_id,
        nome_igreja: membro.nome_igreja,
        role: 'membro',
        membro_id: membro.id,
        cpf: cpfLimpo,
        app_mode: true
    };

    const token = jwt.sign(payload, config.security.jwtSecret, { expiresIn: '30d' });
    res.json({ token, membro: payload, message: 'Login realizado com sucesso.' });
}

async function primeiroAcessoMembroApp(req, res) {
    const { cpf, senha, igreja_nome } = req.body || {};
    if (!cpf || !senha) {
        throw createHttpError(400, 'CPF e senha são obrigatórios.');
    }
    if (String(senha).length < 6) {
        throw createHttpError(400, 'A senha deve ter pelo menos 6 caracteres.');
    }

    const cpfLimpo = String(cpf).replace(/\D/g, '');

    let sql = `SELECT m.id, m.nome, m.cpf, m.app_senha, m.igreja_id, i.nome AS nome_igreja
               FROM membros m
               INNER JOIN igrejas i ON i.id = m.igreja_id
               WHERE REPLACE(REPLACE(REPLACE(m.cpf, '.', ''), '-', ''), '/', '') = $1`;
    const params = [cpfLimpo];

    if (igreja_nome) {
        sql += ` AND LOWER(i.nome) = LOWER($2)`;
        params.push(String(igreja_nome).trim());
    }
    sql += ` LIMIT 1`;

    const [rows] = await pool.query(sql, params);
    const membro = rows[0];

    if (!membro) {
        throw createHttpError(404, 'CPF não encontrado. Entre em contato com a secretaria da sua igreja.');
    }

    if (membro.app_senha) {
        throw createHttpError(409, 'Este CPF já possui senha cadastrada. Use a opção de login.');
    }

    const hash = await bcrypt.hash(String(senha), 10);
    await pool.query(`UPDATE membros SET app_senha = $1 WHERE id = $2`, [hash, membro.id]);

    const payload = {
        id: membro.id,
        nome: membro.nome,
        email: membro.email || '',
        igrejaId: membro.igreja_id,
        nome_igreja: membro.nome_igreja,
        role: 'membro',
        membro_id: membro.id,
        cpf: cpfLimpo,
        app_mode: true
    };

    const token = jwt.sign(payload, config.security.jwtSecret, { expiresIn: '30d' });
    res.json({ token, membro: payload, message: 'Senha criada com sucesso! Bem-vindo ao App da Igreja.' });
}

async function getMeuPerfilApp(req, res) {
    // Suporta tanto membro-jwt (app_mode) quanto admin-jwt (membro_id no payload)
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token) throw createHttpError(401, 'Token não informado.');

    let payload;
    try {
        payload = jwt.verify(token, config.security.jwtSecret);
    } catch (err) {
        throw createHttpError(401, 'Token inválido ou expirado.');
    }

    const membroId = payload.membro_id || payload.id;
    const igrejaId = payload.igrejaId;

    if (!payload.app_mode) throw createHttpError(403, 'Rota exclusiva do App de Membros.');

    const [rows] = await pool.query(
        `SELECT m.*, i.nome AS nome_igreja, i.plano, i.status_assinatura
         FROM membros m
         INNER JOIN igrejas i ON i.id = m.igreja_id
         WHERE m.id = $1 AND m.igreja_id = $2
         LIMIT 1`,
        [membroId, igrejaId]
    );

    const membro = rows[0];
    if (!membro) throw createHttpError(404, 'Perfil não encontrado.');

    // Nunca retornar campos sensíveis
    const { app_senha: _, senha: __, ...safe } = membro;
    res.json(safe);
}

async function listWhatsAppTemplates(req, res) {
    const templates = await engagementService.listTemplates(req.auth.igrejaId);
    res.json(templates);
}

async function createWhatsAppTemplate(req, res) {
    const id = await engagementService.createTemplate(req.auth.igrejaId, req.validatedBody);
    audit('whatsapp.template.create', req, { id, gatilho: req.validatedBody.gatilho });
    res.status(201).json({ id, message: 'Template criado com sucesso.' });
}

async function updateWhatsAppTemplate(req, res) {
    await engagementService.updateTemplate(req.auth.igrejaId, Number(req.params.id), req.validatedBody);
    audit('whatsapp.template.update', req, { id: Number(req.params.id) });
    res.json({ message: 'Template atualizado com sucesso.' });
}

async function listWhatsAppLogs(req, res) {
    const logs = await engagementService.listWhatsAppLogs(req.auth.igrejaId, req.validatedQuery.limit);
    res.json(logs);
}

async function dispatchWhatsApp(req, res) {
    const result = await engagementService.dispatchWhatsApp(req.auth.igrejaId, req.validatedBody, req.auth.id);
    audit('whatsapp.dispatch', req, { gatilho: req.validatedBody.gatilho, destino: req.validatedBody.destino });
    res.status(201).json(result);
}

async function triggerVisitanteBoasVindas(req, res) {
    const body = req.validatedBody;
    const result = await engagementService.dispatchWhatsApp(req.auth.igrejaId, {
        gatilho: 'visitante_boas_vindas',
        destino: body.destino,
        variaveis: {
            nome: body.nome
        }
    }, req.auth.id);

    audit('whatsapp.trigger.visitante_boas_vindas', req, { destino: body.destino });
    res.status(201).json(result);
}

async function triggerEventoLembrete(req, res) {
    const body = req.validatedBody;
    const result = await engagementService.dispatchWhatsApp(req.auth.igrejaId, {
        gatilho: 'evento_lembrete',
        destino: body.destino,
        variaveis: {
            nome: body.nome,
            evento: body.evento,
            data: body.data
        }
    }, req.auth.id);

    audit('whatsapp.trigger.evento_lembrete', req, { destino: body.destino, evento: body.evento });
    res.status(201).json(result);
}

async function triggerOracaoResposta(req, res) {
    const body = req.validatedBody;
    const result = await engagementService.dispatchWhatsApp(req.auth.igrejaId, {
        gatilho: 'oracao_resposta',
        destino: body.destino,
        variaveis: {
            nome: body.nome,
            resposta: body.resposta
        }
    }, req.auth.id);

    audit('whatsapp.trigger.oracao_resposta', req, { destino: body.destino });
    res.status(201).json(result);
}

async function createAutocadastro(req, res) {
    const id = await engagementService.createAutocadastro(req.validatedBody);
    res.status(201).json({
        id,
        message: 'Seu cadastro foi recebido e está aguardando aprovação da secretaria.'
    });
}

async function listAutocadastros(req, res) {
    const items = await engagementService.listAutocadastros(req.auth.igrejaId, req.validatedQuery.status);
    res.json(items);
}

async function approveAutocadastro(req, res) {
    const result = await engagementService.approveAutocadastro(
        req.auth.igrejaId,
        Number(req.params.id),
        req.validatedBody,
        req.auth.id
    );

    if (!result) {
        throw createHttpError(404, 'Autocadastro não encontrado para esta igreja.');
    }

    audit('autocadastro.aprovar', req, { id: Number(req.params.id), criarAcesso: Boolean(req.validatedBody.criarAcesso) });
    res.json({
        message: 'Autocadastro aprovado com sucesso.',
        result
    });
}

async function rejectAutocadastro(req, res) {
    const result = await engagementService.rejectAutocadastro(
        req.auth.igrejaId,
        Number(req.params.id),
        req.validatedBody,
        req.auth.id
    );

    if (!result) {
        throw createHttpError(404, 'Autocadastro não encontrado para esta igreja.');
    }

    audit('autocadastro.rejeitar', req, { id: Number(req.params.id) });
    res.json({ message: 'Autocadastro rejeitado.', result });
}

async function createPortariaCheckin(req, res) {
    const result = await engagementService.createPortariaCheckin(req.auth.igrejaId, req.validatedBody, req.auth.id);
    audit('portaria.checkin.create', req, { id: result.id, evento: req.validatedBody.evento || null });
    realtime.publish('portaria.checkins', {
        igrejaId: req.auth.igrejaId,
        id: result.id,
        evento: req.validatedBody.evento || null
    });
    res.status(201).json({ message: 'Check-in registrado.', ...result });
}

async function listPortariaCheckins(req, res) {
    const items = await engagementService.listPortariaCheckins(req.auth.igrejaId, req.validatedQuery.data);
    res.json(items);
}

async function createPaymentLink(req, res) {
    const result = await engagementService.createPaymentLink(req.auth.igrejaId, req.validatedBody, req.auth.id);
    audit('payment.link.create', req, { id: result.id, provider: result.provider });
    res.status(201).json({ message: 'Link de pagamento criado.', ...result });
}

async function listPaymentLinks(req, res) {
    const items = await engagementService.listPaymentLinks(req.auth.igrejaId);
    res.json(items);
}

async function getPaymentLinkPublic(req, res) {
    const item = await engagementService.getPaymentLinkPublic(req.params.referenceCode);
    if (!item) {
        throw createHttpError(404, 'Link de pagamento não encontrado.');
    }

    res.json(item);
}

async function reportPaymentAsPaidByClient(req, res) {
    const result = await engagementService.reportPaymentAsPaidByClient(req.params.referenceCode, req.body || {});
    if (!result) {
        throw createHttpError(404, 'Link de pagamento não encontrado.');
    }

    if (result.alreadyReported) {
        return res.json({ message: 'Pagamento já sinalizado anteriormente.', status: result.status });
    }

    res.json({ message: 'Pagamento sinalizado. Aguarde confirmação da igreja.', status: result.status });
}

async function markPaymentAsPaid(req, res) {
    await engagementService.markPaymentAsPaid(req.auth.igrejaId, Number(req.params.id));
    audit('payment.link.markPaid', req, { id: Number(req.params.id) });
    res.json({ message: 'Pagamento marcado como pago.' });
}

async function getMemberAppContext(req, res) {
    const context = await engagementService.getMemberAppContext(req.auth.igrejaId, req.auth);
    res.json(context);
}

async function getMemberPermissions(req, res) {
    const data = engagementService.getMemberPermissions(req.auth.role);
    res.json(data);
}

async function createQrSession(req, res) {
    const result = await engagementService.createQrSession(req.auth.igrejaId, req.validatedBody, req.auth.id);
    audit('portaria.qr_session.create', req, { id: result.id, evento: result.evento });
    realtime.publish('portaria.qr', {
        igrejaId: req.auth.igrejaId,
        id: result.id,
        evento: result.evento,
        token: result.token
    });
    res.status(201).json(result);
}

async function getQrSessionPublic(req, res) {
    const data = await engagementService.getQrSessionPublic(req.params.token);
    if (!data) {
        throw createHttpError(404, 'QR inválido ou expirado.');
    }
    res.json(data);
}

async function submitPublicVisitorByToken(req, res) {
    const result = await engagementService.submitPublicVisitorByToken(req.params.token, req.validatedBody);
    if (!result) {
        throw createHttpError(404, 'QR inválido ou expirado.');
    }
    realtime.publish('midia.visitantes', {
        igrejaId: result.igrejaId,
        id: result.id,
        evento: result.evento,
        autorizaTelao: result.autorizaTelao
    });
    res.status(201).json({
        message: 'Cadastro recebido com sucesso.',
        ...result
    });
}

async function listMidiaVisitors(req, res) {
    const data = await engagementService.listMidiaVisitors(req.auth.igrejaId, req.validatedQuery.status);
    res.json(data);
}

async function updateMidiaVisitorStatus(req, res) {
    await engagementService.updateMidiaVisitorStatus(
        req.auth.igrejaId,
        Number(req.params.id),
        req.validatedBody.status,
        req.auth.id
    );

    audit('midia.visitante.status', req, { id: Number(req.params.id), status: req.validatedBody.status });
    realtime.publish('midia.telao', {
        igrejaId: req.auth.igrejaId,
        id: Number(req.params.id),
        status: req.validatedBody.status
    });
    res.json({ message: 'Status atualizado com sucesso.' });
}

async function listTelaoVisitors(req, res) {
    const data = await engagementService.listTelaoVisitors(req.auth.igrejaId);
    res.json(data);
}

async function getAuthMe(req, res) {
    res.json({
        id: req.auth.id,
        nome: req.auth.nome,
        email: req.auth.email,
        igreja: req.auth.igreja,
        igrejaId: req.auth.igrejaId,
        role: req.auth.role,
        plano: req.auth.plano,
        statusAssinatura: req.auth.statusAssinatura,
        trialStartsAt: req.auth.trialStartsAt,
        trialEndsAt: req.auth.trialEndsAt,
        maxCadastros: req.auth.maxCadastros,
        maxCongregacoes: req.auth.maxCongregacoes,
        customConfig: req.auth.customConfig || {},
        modules: req.auth.modules || {}
    });
}

module.exports = {
    approveAutocadastro,
    createAutocadastro,
    createPaymentLink,
    createPortariaCheckin,
    createWhatsAppTemplate,
    dispatchWhatsApp,
    getAuthMe,
    getMemberPermissions,
    getMemberAppContext,
    getQrSessionPublic,
    getPaymentLinkPublic,
    listAutocadastros,
    listMidiaVisitors,
    listPaymentLinks,
    listPortariaCheckins,
    listTelaoVisitors,
    listWhatsAppLogs,
    listWhatsAppTemplates,
    markPaymentAsPaid,
    reportPaymentAsPaidByClient,
    rejectAutocadastro,
    createQrSession,
    submitPublicVisitorByToken,
    triggerEventoLembrete,
    triggerOracaoResposta,
    triggerVisitanteBoasVindas,
    updateMidiaVisitorStatus,
    updateWhatsAppTemplate,
    loginMembroApp,
    primeiroAcessoMembroApp,
    getMeuPerfilApp
};
