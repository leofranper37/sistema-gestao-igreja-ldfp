const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../config');
const accountModel = require('../models/accountModel');

function normalizePlanoSlug(plano) {
    const normalized = String(plano || '').trim().toLowerCase();
    if (normalized === 'edon') {
        return 'eden';
    }

    return plano;
}

function buildAuthResponse(userRecord) {
    const normalizedPlano = normalizePlanoSlug(userRecord.plano);
    const user = {
        id: userRecord.id,
        nome: userRecord.nome,
        email: userRecord.email,
        igreja: userRecord.igreja,
        igrejaId: userRecord.igreja_id,
        role: userRecord.role,
        plano: normalizedPlano || 'teste-7-dias',
        statusAssinatura: userRecord.status_assinatura || 'trial',
        trialStartsAt: userRecord.trial_starts_at || null,
        trialEndsAt: userRecord.trial_ends_at || null,
        maxCadastros: userRecord.max_cadastros || 40,
        maxCongregacoes: userRecord.max_congregacoes || 1
    };

    const token = jwt.sign(
        {
            sub: userRecord.id,
            email: userRecord.email,
            igreja: userRecord.igreja,
            igrejaId: userRecord.igreja_id,
            role: userRecord.role,
            nome: userRecord.nome,
            plano: user.plano,
            statusAssinatura: user.statusAssinatura
        },
        config.security.jwtSecret,
        { expiresIn: config.security.jwtExpiresIn }
    );

    return { token, user };
}

async function registerAccount(payload) {
    const passwordHash = await bcrypt.hash(payload.senha, config.security.passwordSaltRounds);

    const existingChurch = await accountModel.findChurchByName(payload.igreja);
    let igrejaId = existingChurch?.id;
    let churchMetadata = existingChurch || null;

    if (!igrejaId) {
        igrejaId = await accountModel.createChurch(payload.igreja);
        churchMetadata = await accountModel.findChurchByName(payload.igreja);
    }

    const userId = await accountModel.createUser({
        igreja: payload.igreja,
        igrejaId,
        nome: payload.nome,
        email: payload.email,
        passwordHash,
        role: 'admin'
    });

    return buildAuthResponse({
        id: userId,
        igreja: payload.igreja,
        igreja_id: igrejaId,
        nome: payload.nome,
        email: payload.email,
        role: 'admin',
        plano: churchMetadata?.plano,
        status_assinatura: churchMetadata?.status_assinatura,
        trial_starts_at: churchMetadata?.trial_starts_at,
        trial_ends_at: churchMetadata?.trial_ends_at,
        max_cadastros: churchMetadata?.max_cadastros,
        max_congregacoes: churchMetadata?.max_congregacoes
    });
}

async function login(payload) {
    const userRecord = await accountModel.findUserByEmail(payload.email);

    if (!userRecord) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(payload.senha, userRecord.password_hash);

    if (!passwordMatches) {
        return null;
    }

    return buildAuthResponse(userRecord);
}

async function requestPasswordReset(email) {
    const userRecord = await accountModel.findUserByEmail(email);
    if (!userRecord) return; // silencia: não revela se e-mail existe

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await accountModel.createPasswordResetToken(userRecord.id, token, expiresAt);

    const baseUrl = process.env.APP_BASE_URL || process.env.APP_PUBLIC_BASE_URL || 'https://ldfp.com.br';
    const link = `${baseUrl}/redefinir_senha.html?token=${token}`;

    await sendMail({
        to: email,
        subject: 'Redefinição de senha – LDFP',
        html: `
            <div style="font-family:'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:24px;">
                <h2 style="color:#111;margin-bottom:8px;">Redefinição de senha</h2>
                <p>Olá, <strong>${userRecord.nome}</strong>!</p>
                <p>Você solicitou a redefinição de sua senha no sistema LDFP. Clique no botão abaixo para criar uma nova senha:</p>
                <p style="text-align:center;margin:28px 0;">
                    <a href="${link}" style="background:#f59e0b;color:#111;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:15px;">Redefinir minha senha</a>
                </p>
                <p style="color:#555;font-size:13px;">Este link é válido por <strong>1 hora</strong>. Se você não solicitou, ignore este e-mail.</p>
            </div>
        `
    });
}

async function resetPassword(token, novaSenha) {
    const record = await accountModel.findPasswordResetToken(token);
    if (!record) {
        throw createHttpError(400, 'Token inválido ou já utilizado.');
    }

    const expires = new Date(record.expires_at);
    if (expires < new Date()) {
        throw createHttpError(400, 'Token expirado. Solicite um novo link de recuperação.');
    }

    const passwordHash = await bcrypt.hash(novaSenha, config.security.passwordSaltRounds);
    await accountModel.updateUserPassword(record.usuario_id, passwordHash);
    await accountModel.markTokenUsed(token);
}

module.exports = {
    login,
    registerAccount,
    requestPasswordReset,
    resetPassword
};