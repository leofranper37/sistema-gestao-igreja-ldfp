const { createHttpError } = require('../utils/httpError');
const accountService = require('../services/accountService');
const { audit } = require('../services/auditService');

async function createConta(req, res) {
    const payload = req.validatedBody;

    try {
        const auth = await accountService.registerAccount(payload);
        audit('account.create', req, { email: payload.email, igreja: payload.igreja });

        res.status(201).json({
            message: 'Conta criada com sucesso.',
            token: auth.token,
            user: auth.user
        });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            throw createHttpError(409, 'Já existe uma conta cadastrada com esse e-mail.');
        }
        throw error;
    }
}

async function login(req, res) {
    const payload = req.validatedBody;
    const auth = await accountService.login(payload);

    if (!auth) {
        throw createHttpError(401, 'E-mail ou senha inválidos.');
    }

    if (auth.requer2fa) {
        audit('account.login.2fa_pendente', req, { email: payload.email });
        return res.json({
            requer_2fa: true,
            desafio: auth.desafio,
            message: 'Digite o código do seu aplicativo autenticador.'
        });
    }

    audit('account.login', req, { email: payload.email, userId: auth.user.id });

    res.json({
        message: 'Login realizado com sucesso.',
        token: auth.token,
        user: auth.user
    });
}

async function login2fa(req, res) {
    const { desafio, codigo } = req.body || {};
    if (!desafio || !codigo) throw createHttpError(400, 'Informe o código.');
    const auth = await accountService.concluirLogin2fa(desafio, codigo);
    audit('account.login', req, { email: auth.user.email, userId: auth.user.id, segundaEtapa: auth.via });
    const resp = { message: 'Login realizado com sucesso.', token: auth.token, user: auth.user };
    if (auth.via === 'recuperacao') {
        resp.aviso = `Você usou um código de recuperação. Restam ${auth.codigosRestantes}. Gere novos em Segurança da Conta se estiverem acabando.`;
    }
    res.json(resp);
}

module.exports = {
    createConta,
    login,
    login2fa,
    esqueciSenha,
    redefinirSenha
};

async function esqueciSenha(req, res) {
    const { email } = req.body || {};
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        throw createHttpError(400, 'Informe um e-mail válido.');
    }
    await accountService.requestPasswordReset(email.toLowerCase().trim());
    // Sempre retorna 200 para não revelar se o e-mail existe
    res.json({ message: 'Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha.' });
}

async function redefinirSenha(req, res) {
    const { token, senha } = req.body || {};
    if (!token || !senha || senha.length < 8) {
        throw createHttpError(400, 'Token e nova senha (mínimo 8 caracteres) são obrigatórios.');
    }
    await accountService.resetPassword(token, senha);
    res.json({ message: 'Senha redefinida com sucesso! Você já pode fazer login.' });
}