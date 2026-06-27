const systemService = require('../services/systemService');
const { audit } = require('../services/auditService');
const { createHttpError } = require('../utils/httpError');

function getIgrejaId(auth) {
    const id = Number(auth?.igrejaId);
    if (!id) throw createHttpError(401, 'Token inválido: igrejaId ausente. Faça login novamente.');
    return id;
}

async function listMembros(req, res) {
    const query = req.validatedQuery || {};
    const igrejaId = getIgrejaId(req.auth);

    const hasAdvancedQuery = Boolean(
        query.page || query.limit || query.sortBy || query.sortOrder
    );

    const baseFilters = {
        igrejaId,
        nome: String(query.nome || '').trim(),
        email: String(query.email || '').trim(),
        telefone: String(query.telefone || '').trim(),
        cidade: String(query.cidade || '').trim()
    };

    if (!hasAdvancedQuery && !['1', 'true', true].includes(query.meta)) {
        const rows = await systemService.listMembros(baseFilters);
        return res.json(rows);
    }

    const result = await systemService.listMembrosWithFilters({
        ...baseFilters,
        page: query.page,
        limit: query.limit || 50,
        sortBy: query.sortBy || 'id',
        sortOrder: query.sortOrder || 'desc'
    });

    return res.json(result);
}

async function createMembro(req, res) {
    const payload = req.validatedBody;
    const igrejaId = getIgrejaId(req.auth);
    const maxCadastros = Number(req.auth.maxCadastros || 0);

    if (maxCadastros > 0) {
        const totalAtual = Number(await systemService.getTotalMembros(igrejaId));
        if (totalAtual >= maxCadastros) {
            throw createHttpError(
                403,
                `Limite do plano atingido: seu plano permite até ${maxCadastros} cadastros de membros. Faça upgrade para continuar.`
            );
        }
    }

    const parseFlag = (value) => {
        if (value === true || value === 1 || value === '1') return 1;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === 'sim') return 1;
        }
        return 0;
    };
    const member = {
        nome: payload.nome,
        email: payload.email || null,
        telefone: payload.telefone || null,
        cargo: payload.cargo || null,
        apelido: payload.apelido || null,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || payload.estado_civil || null,
        profissao: payload.profissao || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        celular: payload.celular || null,
        cpf: payload.cpf || null,
        rg: payload.rg || null,
        nacionalidade: payload.nacionalidade || null,
        naturalidade: payload.naturalidade || null,
        fotoUrl: payload.fotoUrl || null,
        situacao: payload.situacao || 'Ativo',
        observacoes: payload.observacoes || null,
        acesso_app_midia: parseFlag(payload.acesso_app_midia),
        gerenciar_midias: parseFlag(payload.gerenciar_midias)
    };

    await systemService.createMembro({ ...member, igrejaId });
    audit('membro.create', req, { nome: member.nome, email: member.email });

    res.status(201).json({ message: 'Membro salvo com sucesso.' });
}

async function updateMembro(req, res) {
    const payload = req.validatedBody;
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);

    if (isNaN(id) || id <= 0) {
        throw createHttpError(400, 'ID de membro inválido.');
    }

    const parseFlag = (value) => {
        if (value === true || value === 1 || value === '1') return 1;
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (normalized === 'true' || normalized === 'sim') return 1;
        }
        return 0;
    };

    const member = {
        igrejaId,
        nome: payload.nome,
        email: payload.email || null,
        telefone: payload.telefone || null,
        cargo: payload.cargo || null,
        apelido: payload.apelido || null,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || payload.estado_civil || null,
        profissao: payload.profissao || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        celular: payload.celular || null,
        cpf: payload.cpf || null,
        rg: payload.rg || null,
        nacionalidade: payload.nacionalidade || null,
        naturalidade: payload.naturalidade || null,
        fotoUrl: payload.fotoUrl || null,
        situacao: payload.situacao || 'Ativo',
        observacoes: payload.observacoes || null,
        acesso_app_midia: parseFlag(payload.acesso_app_midia),
        gerenciar_midias: parseFlag(payload.gerenciar_midias)
    };

    await systemService.updateMembro(id, member);
    audit('membro.update', req, { id, nome: member.nome, email: member.email });

    res.json({ message: 'Membro atualizado com sucesso.' });
}

async function deleteMembro(req, res) {
    const igrejaId = getIgrejaId(req.auth);
    const id = Number(req.params.id);

    if (isNaN(id) || id <= 0) {
        throw createHttpError(400, 'ID de membro inválido.');
    }

    await systemService.deleteMembro(id, igrejaId);
    audit('membro.delete', req, { id });

    res.json({ message: 'Membro excluído com sucesso.' });
}

async function listVisitantes(req, res) {
    const query = req.validatedQuery || {};
    const rows = await systemService.listVisitantes({
        igrejaId: getIgrejaId(req.auth),
        search: String(query.search || '').trim()
    });
    res.json(rows);
}

async function createVisitante(req, res) {
    const payload = req.validatedBody;
    const visitante = {
        nome: payload.nome,
        telefone: payload.telefone || null,
        data: payload.data,
        observacao: payload.observacao || null,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        cep: payload.cep || null,
        celular: payload.celular || null,
        email: payload.email || null,
        congregacao: payload.congregacao || null,
        aceitouJesusEm: payload.aceitouJesusEm || null,
        retornoEm: payload.retornoEm || null
    };

    await systemService.createVisitante({ ...visitante, igrejaId: getIgrejaId(req.auth) });
    audit('visitante.create', req, { nome: visitante.nome, data: visitante.data });

    res.status(201).json({ message: 'Visitante registrado com sucesso.' });
}

async function updateVisitante(req, res) {
    const payload = req.validatedBody;
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const visitante = {
        id,
        igrejaId,
        nome: payload.nome,
        telefone: payload.telefone || null,
        data: payload.data,
        observacao: payload.observacao || null,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        cep: payload.cep || null,
        celular: payload.celular || null,
        email: payload.email || null,
        congregacao: payload.congregacao || null,
        aceitouJesusEm: payload.aceitouJesusEm || null,
        retornoEm: payload.retornoEm || null
    };

    const affected = await systemService.updateVisitante(visitante);
    if (!affected) {
        throw createHttpError(404, 'Visitante não encontrado.');
    }

    audit('visitante.update', req, { id, nome: visitante.nome, data: visitante.data });
    res.json({ message: 'Visitante atualizado com sucesso.' });
}

async function deleteVisitante(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const affected = await systemService.deleteVisitante({ id, igrejaId });
    if (!affected) {
        throw createHttpError(404, 'Visitante não encontrado.');
    }

    audit('visitante.delete', req, { id });
    res.json({ message: 'Visitante removido com sucesso.' });
}

async function listCongregados(req, res) {
    const query = req.validatedQuery || {};
    const rows = await systemService.listCongregados({
        igrejaId: getIgrejaId(req.auth),
        search: String(query.search || '').trim()
    });
    res.json(rows);
}

async function createCongregado(req, res) {
    const payload = req.validatedBody;
    const congregado = {
        nome: payload.nome,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || null,
        cpf: payload.cpf || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        telefone: payload.telefone || null,
        celular: payload.celular || null,
        email: payload.email || null,
        dataCadastro: payload.dataCadastro || null,
        obs: payload.obs || null,
        fotoUrl: payload.fotoUrl || null
    };

    await systemService.createCongregado({ ...congregado, igrejaId: getIgrejaId(req.auth) });
    audit('congregado.create', req, { nome: congregado.nome, cidade: congregado.cidade, telefone: congregado.telefone });

    res.status(201).json({ message: 'Congregado registrado com sucesso.' });
}

async function updateCongregado(req, res) {
    const payload = req.validatedBody;
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const congregado = {
        id,
        igrejaId,
        nome: payload.nome,
        nascimento: payload.nascimento || null,
        sexo: payload.sexo || null,
        estadoCivil: payload.estadoCivil || null,
        cpf: payload.cpf || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        telefone: payload.telefone || null,
        celular: payload.celular || null,
        email: payload.email || null,
        dataCadastro: payload.dataCadastro || null,
        obs: payload.obs || null,
        fotoUrl: payload.fotoUrl || null
    };

    const affected = await systemService.updateCongregado(congregado);
    if (!affected) {
        throw createHttpError(404, 'Congregado não encontrado.');
    }

    audit('congregado.update', req, { id, nome: congregado.nome, cidade: congregado.cidade, telefone: congregado.telefone });
    res.json({ message: 'Congregado atualizado com sucesso.' });
}

async function deleteCongregado(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const affected = await systemService.deleteCongregado({ id, igrejaId });
    if (!affected) {
        throw createHttpError(404, 'Congregado não encontrado.');
    }

    audit('congregado.delete', req, { id });
    res.json({ message: 'Congregado removido com sucesso.' });
}

async function listCriancas(req, res) {
    const query = req.validatedQuery || {};
    const rows = await systemService.listCriancas({
        igrejaId: getIgrejaId(req.auth),
        search: String(query.search || '').trim()
    });
    res.json(rows);
}

async function createCrianca(req, res) {
    const payload = req.validatedBody;
    const crianca = {
        nome: payload.nome,
        nascimento: payload.nascimento || null,
        apresentacao: payload.apresentacao || null,
        sexo: payload.sexo || null,
        situacao: payload.situacao || null,
        pai: payload.pai || null,
        mae: payload.mae || null,
        nomePai: payload.nomePai || null,
        nomeMae: payload.nomeMae || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        complemento: payload.complemento || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        telefone: payload.telefone || null,
        celular: payload.celular || null,
        email: payload.email || null,
        fotoUrl: payload.fotoUrl || null
    };

    await systemService.createCrianca({ ...crianca, igrejaId: getIgrejaId(req.auth) });
    audit('crianca.create', req, { nome: crianca.nome, cidade: crianca.cidade, pai: crianca.pai, mae: crianca.mae });

    res.status(201).json({ message: 'Criança registrada com sucesso.' });
}

async function updateCrianca(req, res) {
    const payload = req.validatedBody;
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const crianca = {
        id,
        igrejaId,
        nome: payload.nome,
        nascimento: payload.nascimento || null,
        apresentacao: payload.apresentacao || null,
        sexo: payload.sexo || null,
        situacao: payload.situacao || null,
        pai: payload.pai || null,
        mae: payload.mae || null,
        nomePai: payload.nomePai || null,
        nomeMae: payload.nomeMae || null,
        cep: payload.cep || null,
        endereco: payload.endereco || null,
        numero: payload.numero || null,
        bairro: payload.bairro || null,
        complemento: payload.complemento || null,
        cidade: payload.cidade || null,
        estado: payload.estado || null,
        telefone: payload.telefone || null,
        celular: payload.celular || null,
        email: payload.email || null,
        fotoUrl: payload.fotoUrl || null
    };

    const affected = await systemService.updateCrianca(crianca);
    if (!affected) {
        throw createHttpError(404, 'Criança não encontrada.');
    }

    audit('crianca.update', req, { id, nome: crianca.nome, cidade: crianca.cidade, pai: crianca.pai, mae: crianca.mae });
    res.json({ message: 'Criança atualizada com sucesso.' });
}

async function deleteCrianca(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const affected = await systemService.deleteCrianca({ id, igrejaId });
    if (!affected) {
        throw createHttpError(404, 'Criança não encontrada.');
    }

    audit('crianca.delete', req, { id });
    res.json({ message: 'Criança removida com sucesso.' });
}

function parsePrivado(value) {
    if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'sim') {
        return 1;
    }

    return 0;
}

function canManageOracao(req, row) {
    if (!row) return false;
    if (['admin', 'secretaria'].includes(req.auth?.role)) return true;
    return Number(row.user_id) === Number(req.auth?.id);
}

async function listMyOracoes(req, res) {
    const query = req.validatedQuery || {};
    const rows = await systemService.listOracoesMy({
        igrejaId: getIgrejaId(req.auth),
        userId: Number(req.auth.id),
        status: query.status || null
    });

    res.json(rows);
}

async function listMuralOracoes(req, res) {
    const rows = await systemService.listOracoesMural({
        igrejaId: getIgrejaId(req.auth)
    });

    res.json(rows);
}

async function createOracao(req, res) {
    const payload = req.validatedBody;

    const data = {
        igrejaId: getIgrejaId(req.auth),
        userId: Number(req.auth.id),
        userName: req.auth.nome || req.auth.email || 'Usuário',
        pedido: payload.pedido,
        isPrivate: parsePrivado(payload.privado),
        status: 'pendente'
    };

    await systemService.createOracao(data);
    audit('oracao.create', req, { isPrivate: data.isPrivate });

    res.status(201).json({ message: 'Pedido de oração registrado com sucesso.' });
}

async function updateOracao(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);
    const payload = req.validatedBody;

    const row = await systemService.getOracaoById({ igrejaId, id });
    if (!row) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    if (!canManageOracao(req, row)) {
        throw createHttpError(403, 'Você não tem permissão para editar este pedido.');
    }

    const affected = await systemService.updateOracao({
        id,
        igrejaId,
        pedido: payload.pedido,
        isPrivate: parsePrivado(payload.privado),
        status: payload.status || row.status || 'pendente'
    });

    if (!affected) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    audit('oracao.update', req, { id });
    res.json({ message: 'Pedido de oração atualizado com sucesso.' });
}

async function updateOracaoResposta(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);
    const payload = req.validatedBody;

    const row = await systemService.getOracaoById({ igrejaId, id });
    if (!row) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    if (!['admin', 'secretaria'].includes(req.auth.role)) {
        throw createHttpError(403, 'Somente administração/secretaria pode responder pedidos.');
    }

    const affected = await systemService.updateOracaoResposta({
        id,
        igrejaId,
        resposta: payload.resposta || null,
        status: payload.status || (payload.resposta ? 'respondido' : row.status || 'pendente')
    });

    if (!affected) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    audit('oracao.reply', req, { id });
    res.json({ message: 'Resposta de oração atualizada com sucesso.' });
}

async function deleteOracao(req, res) {
    const id = Number(req.params.id);
    const igrejaId = getIgrejaId(req.auth);

    const row = await systemService.getOracaoById({ igrejaId, id });
    if (!row) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    if (!canManageOracao(req, row)) {
        throw createHttpError(403, 'Você não tem permissão para excluir este pedido.');
    }

    const affected = await systemService.deleteOracao({ id, igrejaId });
    if (!affected) {
        throw createHttpError(404, 'Pedido de oração não encontrado.');
    }

    audit('oracao.delete', req, { id });
    res.json({ message: 'Pedido de oração removido com sucesso.' });
}

async function getTotalVisitantes(req, res) {
    try {
        const total = await systemService.getTotalVisitantes(getIgrejaId(req.auth));
        res.json({ total });
    } catch (error) {
        res.json({ total: 0 });
    }
}

async function getHealth(req, res) {
    try {
        const health = await systemService.getHealthStatus();
        res.json(health);
    } catch (error) {
        res.status(503).json({
            status: 'error',
            database: 'down',
            error: 'Banco de dados indisponível.',
            timestamp: new Date().toISOString()
        });
    }
}

module.exports = {
    createCrianca,
    createCongregado,
    createMembro,
    updateMembro,
    deleteMembro,
    createOracao,
    createVisitante,
    deleteCrianca,
    deleteCongregado,
    deleteOracao,
    deleteVisitante,
    getHealth,
    getTotalVisitantes,
    listMuralOracoes,
    listMyOracoes,
    listCriancas,
    listCongregados,
    listMembros,
    listVisitantes,
    updateCrianca,
    updateCongregado,
    updateOracao,
    updateOracaoResposta,
    updateVisitante
};