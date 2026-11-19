const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createHttpError } = require('../utils/httpError');
const { audit } = require('../services/auditService');
const engagementService = require('../services/engagementService');
const realtime = require('../services/realtimeService');
const { pool } = require('../config/db');
const config = require('../config');

// ── APP DE MEMBROS: Auth por CPF ───────────────────────────────────
//
// Senha padrão do primeiro acesso = 6 primeiros dígitos do CPF (fraca e fácil de
// adivinhar). Enquanto o membro estiver com ela (ou após reset pelo admin), o login
// NÃO devolve o token do app: devolve só um "token de troca" (15 min) que serve
// exclusivamente para PUT /app-membro/trocar-senha. requireAuth recusa esse token.
// Detecção sem depender de coluna nova: app_senha nulo, flag precisa_trocar_senha
// (se a coluna existir) ou a senha digitada ser a padrão / o próprio CPF.

const APP_SENHA_MIN = 8;
const TROCA_TOKEN_TTL = '15m';

function limparCpf(cpf) {
    return String(cpf || '').replace(/\D/g, '');
}

function senhaPadraoDoCpf(cpfLimpo) {
    return String(cpfLimpo || '').substring(0, 6);
}

/** Senha é a padrão (6 primeiros dígitos) ou o CPF inteiro (com ou sem pontuação). */
function ehSenhaFraca(senha, cpfLimpo) {
    const cpf = String(cpfLimpo || '');
    if (!cpf) return false;
    const digitos = String(senha || '').replace(/[.\-\s/]/g, '');
    return digitos === senhaPadraoDoCpf(cpf) || digitos === cpf;
}

function validarNovaSenhaApp(novaSenha, cpfLimpo) {
    const s = String(novaSenha || '');
    if (s.length < APP_SENHA_MIN) {
        throw createHttpError(400, `A nova senha deve ter pelo menos ${APP_SENHA_MIN} caracteres.`);
    }
    if (ehSenhaFraca(s, cpfLimpo)) {
        throw createHttpError(400, 'A nova senha não pode ser a senha padrão nem o seu CPF.');
    }
}

/**
 * UPDATE que também mexe em precisa_trocar_senha; se a coluna não existir no banco
 * (instalação antiga), repete sem ela — a detecção da senha padrão continua valendo
 * por app_senha nulo / comparação com a senha derivada do CPF.
 */
async function updateComFlagTroca(sqlComFlag, paramsComFlag, sqlSemFlag, paramsSemFlag) {
    try {
        await pool.query(sqlComFlag, paramsComFlag);
    } catch (err) {
        const msg = String(err && (err.code || '') + ' ' + (err.message || ''));
        if (!/precisa_trocar_senha|ER_BAD_FIELD_ERROR|no such column/i.test(msg)) throw err;
        await pool.query(sqlSemFlag, paramsSemFlag);
    }
}

async function buscarIgrejaTk(igrejaId) {
    try {
        const [rows] = await pool.query('SELECT public_token FROM igrejas WHERE id = ? LIMIT 1', [igrejaId]);
        return rows[0]?.public_token || null;
    } catch (_) {
        return null;
    }
}

function montarPayloadApp(membro, cpfLimpo) {
    return {
        id: membro.id,
        nome: membro.nome,
        email: membro.email || '',
        cargo: membro.cargo || '',
        foto_url: membro.foto_url || null,
        igrejaId: membro.igreja_id,
        nome_igreja: membro.nome_igreja,
        role: 'membro',
        membro_id: membro.id,
        cpf: cpfLimpo,
        app_mode: true,
        acesso_app_midia: membro.acesso_app_midia ? true : false,
        gerenciar_midias: membro.gerenciar_midias ? true : false
    };
}

async function emitirSessaoApp(membro, cpfLimpo) {
    const payload = montarPayloadApp(membro, cpfLimpo);
    const igrejaTk = await buscarIgrejaTk(membro.igreja_id);
    const token = jwt.sign(payload, config.security.jwtSecret, { expiresIn: '30d' });
    return { token, membro: { ...payload, igrejaTk } };
}

async function loginMembroApp(req, res) {
    const { cpf, senha, igreja_nome } = req.body || {};
    if (!cpf || !senha) {
        throw createHttpError(400, 'CPF e senha são obrigatórios.');
    }

    const cpfLimpo = limparCpf(cpf);

    let sql = `SELECT m.*, i.nome AS nome_igreja, i.id AS igreja_id_num
               FROM membros m
               INNER JOIN igrejas i ON i.id = m.igreja_id
               WHERE REPLACE(REPLACE(REPLACE(m.cpf, '.', ''), '-', ''), '/', '') = ?`;
    const params = [cpfLimpo];

    if (igreja_nome) {
        sql += ` AND LOWER(i.nome) = LOWER(?)`;
        params.push(String(igreja_nome).trim());
    }
    sql += ` LIMIT 1`;

    const [rows] = await pool.query(sql, params);
    const membro = rows[0];

    if (!membro) {
        throw createHttpError(404, 'Membro não encontrado. Verifique o CPF e o nome da igreja.');
    }

    let precisaTrocar = false;

    if (!membro.app_senha) {
        // Sem senha cadastrada — senha padrão são os 6 primeiros dígitos do CPF
        if (String(senha) !== senhaPadraoDoCpf(cpfLimpo)) {
            throw createHttpError(401, 'Senha incorreta. No primeiro acesso, use os 6 primeiros dígitos do seu CPF.');
        }
        precisaTrocar = true;
    } else {
        const ok = await bcrypt.compare(String(senha), String(membro.app_senha));
        if (!ok) {
            throw createHttpError(401, 'Senha incorreta.');
        }
        if (membro.precisa_trocar_senha || ehSenhaFraca(senha, cpfLimpo)) {
            precisaTrocar = true;
        }
    }

    if (precisaTrocar) {
        // Nada de token do app aqui: só o token restrito de troca de senha.
        const trocaToken = jwt.sign(
            { app_troca_senha: true, membro_id: membro.id, troca_igreja_id: membro.igreja_id },
            config.security.jwtSecret,
            { expiresIn: TROCA_TOKEN_TTL }
        );
        return res.json({
            precisa_trocar: true,
            troca_token: trocaToken,
            membro: { nome: membro.nome, nome_igreja: membro.nome_igreja },
            message: `Crie uma senha pessoal (mínimo ${APP_SENHA_MIN} caracteres) para continuar.`
        });
    }

    const sessao = await emitirSessaoApp(membro, cpfLimpo);
    res.json({ ...sessao, precisa_trocar: false, message: 'Login realizado com sucesso.' });
}

/**
 * Autenticação da troca de senha do app: aceita o token restrito de troca
 * (emitido no login com senha padrão) OU o token normal do app (troca voluntária).
 * Membro e igreja vêm SEMPRE do token assinado pelo servidor, nunca do body.
 */
function authTrocaSenhaApp(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return next(createHttpError(401, 'Token de acesso não informado.'));

    let payload;
    try {
        payload = jwt.verify(token, config.security.jwtSecret);
    } catch (_) {
        return next(createHttpError(401, 'Sessão expirada. Entre novamente com CPF e senha.'));
    }

    if (payload && payload.app_troca_senha) {
        req.trocaSenha = { membroId: Number(payload.membro_id), igrejaId: Number(payload.troca_igreja_id), restrito: true };
        return next();
    }
    if (payload && payload.app_mode) {
        req.trocaSenha = { membroId: Number(payload.membro_id || payload.id), igrejaId: Number(payload.igrejaId), restrito: false };
        return next();
    }
    return next(createHttpError(403, 'Rota exclusiva do App de Membros.'));
}

async function trocarSenhaMembroApp(req, res) {
    const { novaSenha } = req.body || {};
    const ctx = req.trocaSenha;
    if (!ctx || !ctx.membroId || !ctx.igrejaId) {
        throw createHttpError(403, 'Rota exclusiva do App de Membros.');
    }

    const [rows] = await pool.query(
        `SELECT m.*, i.nome AS nome_igreja
         FROM membros m
         INNER JOIN igrejas i ON i.id = m.igreja_id
         WHERE m.id = ? AND m.igreja_id = ?
         LIMIT 1`,
        [ctx.membroId, ctx.igrejaId]
    );
    const membro = rows[0];
    if (!membro) throw createHttpError(404, 'Membro não encontrado.');

    const cpfLimpo = limparCpf(membro.cpf);
    validarNovaSenhaApp(novaSenha, cpfLimpo);

    if (ctx.restrito) {
        // O token de troca só vale enquanto o membro ainda está com a senha padrão
        let aindaPrecisa = !membro.app_senha || !!membro.precisa_trocar_senha;
        if (!aindaPrecisa) {
            aindaPrecisa = await bcrypt.compare(senhaPadraoDoCpf(cpfLimpo), String(membro.app_senha))
                || await bcrypt.compare(cpfLimpo, String(membro.app_senha));
        }
        if (!aindaPrecisa) {
            throw createHttpError(409, 'Sua senha já foi trocada. Entre com o CPF e a nova senha.');
        }
    }

    const hash = await bcrypt.hash(String(novaSenha), config.security.passwordSaltRounds);
    await updateComFlagTroca(
        `UPDATE membros SET app_senha = ?, precisa_trocar_senha = 0 WHERE id = ? AND igreja_id = ?`,
        [hash, membro.id, ctx.igrejaId],
        `UPDATE membros SET app_senha = ? WHERE id = ? AND igreja_id = ?`,
        [hash, membro.id, ctx.igrejaId]
    );

    if (ctx.restrito) {
        // Troca concluída: agora sim libera o app
        const sessao = await emitirSessaoApp(membro, cpfLimpo);
        return res.json({ ...sessao, message: 'Senha criada com sucesso.' });
    }
    res.json({ message: 'Senha atualizada com sucesso.' });
}

async function resetarSenhaMembroApp(req, res) {
    const membroId = Number(req.params.id);
    const igrejaId = req.auth.igrejaId;

    const [rows] = await pool.query(
        `SELECT id FROM membros WHERE id = ? AND igreja_id = ? LIMIT 1`,
        [membroId, igrejaId]
    );
    if (!rows || !rows.length) {
        throw createHttpError(404, 'Membro não encontrado.');
    }

    // Limpa a senha — próximo login usa os 6 primeiros dígitos do CPF e exige troca
    await updateComFlagTroca(
        `UPDATE membros SET app_senha = NULL, precisa_trocar_senha = 1 WHERE id = ? AND igreja_id = ?`,
        [membroId, igrejaId],
        `UPDATE membros SET app_senha = NULL WHERE id = ? AND igreja_id = ?`,
        [membroId, igrejaId]
    );

    res.json({ message: 'Senha resetada. No próximo acesso o membro entra com os 6 primeiros dígitos do CPF e será obrigado a criar uma senha nova.' });
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
         WHERE m.id = ? AND m.igreja_id = ?
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

// Desativado: aceitava igrejaId vindo do navegador (ou caía na igreja 1).
// O cadastro público agora é POST /api/ficha, identificado pelo código da igreja.
async function createAutocadastro(req, res) {
    res.status(410).json({
        error: 'Este formulário mudou. Peça à secretaria da sua igreja o link ou QR Code de cadastro.'
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
    const b = req.body || {};
    const destino = /^(caixa|banco:\d+)$/.test(String(b.destino || '')) ? b.destino : null;
    const data = /^\d{4}-\d{2}-\d{2}$/.test(String(b.data || '')) ? b.data : null;
    if (destino && !data) throw createHttpError(400, 'Informe a data do recebimento.');
    await engagementService.markPaymentAsPaid(req.auth.igrejaId, Number(req.params.id),
        { destino, data, contaContabil: typeof b.contaContabil === 'string' ? b.contaContabil.trim().slice(0, 255) : null }, req.auth.id);
    audit('payment.link.markPaid', req, { id: Number(req.params.id), destino });
    res.json({ message: destino ? 'Pagamento confirmado e lançado.' : 'Pagamento confirmado.' });
}

async function unmarkPaymentAsPaid(req, res) {
    await engagementService.unmarkPaymentAsPaid(req.auth.igrejaId, Number(req.params.id));
    audit('payment.link.unmarkPaid', req, { id: Number(req.params.id) });
    res.json({ message: 'Confirmação desfeita. O recebimento foi retirado do caixa/banco.' });
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
    unmarkPaymentAsPaid,
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
    authTrocaSenhaApp,
    trocarSenhaMembroApp,
    resetarSenhaMembroApp,
    getMeuPerfilApp
};
