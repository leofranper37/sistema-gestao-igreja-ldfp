const Joi = require('joi');

const JOI_MESSAGES = {
    'any.required': 'O campo {#label} é obrigatório.',
    'any.only': 'O campo {#label} deve ser um dos valores permitidos: {#valids}.',
    'string.base': 'O campo {#label} deve ser um texto.',
    'string.empty': 'O campo {#label} não pode estar vazio.',
    'string.min': 'O campo {#label} deve ter no mínimo {#limit} caracteres.',
    'string.max': 'O campo {#label} deve ter no máximo {#limit} caracteres.',
    'string.email': 'O campo {#label} deve ser um e-mail válido.',
    'string.pattern.base': 'O campo {#label} está em formato inválido.',
    'number.base': 'O campo {#label} deve ser um número.',
    'alternatives.types': 'O campo {#label} está em formato inválido.'
};

const emailSchema = Joi.string().trim().email({ tlds: { allow: false } }).max(255);

const decimalInput = Joi.alternatives().try(Joi.number(), Joi.string().trim()).required();

const createContaSchema = Joi.object({
    igreja: Joi.string().trim().min(2).max(255).required().label('Igreja'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    email: emailSchema.required().label('E-mail'),
    senha: Joi.string().min(8).max(72).required().label('Senha')
});

const loginSchema = Joi.object({
    email: emailSchema.required().label('E-mail'),
    senha: Joi.string().min(1).max(72).required().label('Senha')
});

const transacaoSchema = Joi.object({
    descricao: Joi.string().trim().min(1).max(255).required().label('Descrição'),
    tipo: Joi.string().valid('entrada', 'saida').required().label('Tipo'),
    valor: decimalInput.label('Valor')
});

const saldoInicialSchema = Joi.object({
    competencia: Joi.string().trim().pattern(/^(0[1-9]|1[0-2])\/\d{4}$/).required().label('Competência'),
    saldoInicial: decimalInput.label('Saldo inicial')
});

const cargoSchema = Joi.object({
    descricao: Joi.string().trim().min(1).max(255).required().label('Descrição')
});

const membroSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome'),
    email: emailSchema.allow('', null).label('E-mail'),
    telefone: Joi.string().trim().max(50).allow('', null).label('Telefone'),
    apelido: Joi.string().trim().max(255).allow('', null),
    nascimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    sexo: Joi.string().trim().max(50).allow('', null),
    estadoCivil: Joi.string().trim().max(100).allow('', null),
    estado_civil: Joi.string().trim().max(100).allow('', null),
    profissao: Joi.string().trim().max(255).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    numero: Joi.string().trim().max(50).allow('', null),
    bairro: Joi.string().trim().max(255).allow('', null),
    cidade: Joi.string().trim().max(255).allow('', null),
    estado: Joi.string().trim().max(100).allow('', null),
    celular: Joi.string().trim().max(50).allow('', null),
    cpf: Joi.string().trim().max(50).allow('', null),
    rg: Joi.string().trim().max(50).allow('', null),
    nacionalidade: Joi.string().trim().max(100).allow('', null),
    naturalidade: Joi.string().trim().max(255).allow('', null)
});

const visitanteSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome do visitante'),
    telefone: Joi.string().trim().max(50).allow('', null).label('Telefone'),
    data: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required().label('Data da visita'),
    observacao: Joi.string().trim().max(4000).allow('', null),
    nascimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    sexo: Joi.string().trim().max(50).allow('', null),
    estadoCivil: Joi.string().trim().max(100).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    numero: Joi.string().trim().max(50).allow('', null),
    bairro: Joi.string().trim().max(150).allow('', null),
    cidade: Joi.string().trim().max(150).allow('', null),
    estado: Joi.string().trim().max(50).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    celular: Joi.string().trim().max(50).allow('', null),
    email: emailSchema.allow('', null).label('E-mail'),
    congregacao: Joi.string().trim().max(255).allow('', null),
    aceitouJesusEm: Joi.string().trim().max(120).allow('', null),
    retornoEm: Joi.string().trim().max(120).allow('', null)
});

const visitanteFiltroSchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const congregadoSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome do congregado'),
    nascimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    sexo: Joi.string().trim().max(50).allow('', null),
    estadoCivil: Joi.string().trim().max(100).allow('', null),
    cpf: Joi.string().trim().max(50).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    numero: Joi.string().trim().max(50).allow('', null),
    bairro: Joi.string().trim().max(150).allow('', null),
    cidade: Joi.string().trim().max(150).allow('', null),
    estado: Joi.string().trim().max(50).allow('', null),
    telefone: Joi.string().trim().max(50).allow('', null),
    celular: Joi.string().trim().max(50).allow('', null),
    email: emailSchema.allow('', null).label('E-mail'),
    dataCadastro: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    obs: Joi.string().trim().max(4000).allow('', null),
    fotoUrl: Joi.string().trim().max(255).allow('', null)
});

const congregadoFiltroSchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const criancaSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome da criança'),
    nascimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    apresentacao: Joi.string().trim().max(120).allow('', null),
    sexo: Joi.string().trim().max(50).allow('', null),
    situacao: Joi.string().trim().max(120).allow('', null),
    pai: Joi.string().trim().max(255).allow('', null),
    mae: Joi.string().trim().max(255).allow('', null),
    nomePai: Joi.string().trim().max(255).allow('', null),
    nomeMae: Joi.string().trim().max(255).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    numero: Joi.string().trim().max(50).allow('', null),
    bairro: Joi.string().trim().max(150).allow('', null),
    complemento: Joi.string().trim().max(255).allow('', null),
    cidade: Joi.string().trim().max(150).allow('', null),
    estado: Joi.string().trim().max(50).allow('', null),
    telefone: Joi.string().trim().max(50).allow('', null),
    celular: Joi.string().trim().max(50).allow('', null),
    email: emailSchema.allow('', null).label('E-mail'),
    fotoUrl: Joi.string().trim().max(255).allow('', null)
});

const criancaFiltroSchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const oracaoSchema = Joi.object({
    pedido: Joi.string().trim().min(1).max(4000).required().label('Pedido de oração'),
    privado: Joi.alternatives().try(
        Joi.boolean(),
        Joi.number().valid(0, 1),
        Joi.string().valid('Sim', 'Não', 'sim', 'não', 'nao', 'true', 'false', '1', '0')
    ).optional().label('Privado')
});

const oracaoRespostaSchema = Joi.object({
    resposta: Joi.string().trim().max(4000).allow('', null).label('Resposta'),
    status: Joi.string().valid('pendente', 'respondido').optional().label('Situação')
});

const oracaoFiltroSchema = Joi.object({
    status: Joi.string().valid('pendente', 'respondido').optional().label('Situação')
});

const outrasIgrejasSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome da igreja'),
    sede: Joi.string().trim().max(255).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    bairro: Joi.string().trim().max(150).allow('', null),
    cidade: Joi.string().trim().max(150).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    estado: Joi.string().trim().max(50).allow('', null),
    telefone: Joi.string().trim().max(50).allow('', null),
    celular: Joi.string().trim().max(50).allow('', null),
    email: emailSchema.allow('', null).label('E-mail'),
    responsavel: Joi.string().trim().max(255).allow('', null),
    cargo: Joi.string().trim().max(255).allow('', null),
    nascimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
    declaracao: Joi.string().trim().max(255).allow('', null)
});

const outrasIgrejasQuerySchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const missionariosSchema = Joi.object({
    nome: Joi.string().trim().min(1).max(255).required().label('Nome'),
    titulo: Joi.string().trim().max(255).allow('', null),
    cep: Joi.string().trim().max(20).allow('', null),
    endereco: Joi.string().trim().max(255).allow('', null),
    bairro: Joi.string().trim().max(150).allow('', null),
    cidade: Joi.string().trim().max(150).allow('', null),
    estado: Joi.string().trim().max(50).allow('', null),
    pais: Joi.string().trim().max(100).allow('', null),
    telefone: Joi.string().trim().max(50).allow('', null),
    telefone2: Joi.string().trim().max(50).allow('', null),
    email: emailSchema.allow('', null).label('E-mail'),
    email2: emailSchema.allow('', null).label('E-mail secundário'),
    banco: Joi.string().trim().max(255).allow('', null),
    nomeAgencia: Joi.string().trim().max(255).allow('', null),
    agencia: Joi.string().trim().max(100).allow('', null),
    tipoConta: Joi.string().trim().max(50).allow('', null),
    numeroConta: Joi.string().trim().max(100).allow('', null),
    nomeContato: Joi.string().trim().max(255).allow('', null),
    parentescoContato: Joi.string().trim().max(100).allow('', null),
    cepContato: Joi.string().trim().max(20).allow('', null),
    enderecoContato: Joi.string().trim().max(255).allow('', null),
    bairroContato: Joi.string().trim().max(150).allow('', null),
    cidadeContato: Joi.string().trim().max(150).allow('', null),
    estadoContato: Joi.string().trim().max(50).allow('', null),
    paisContato: Joi.string().trim().max(100).allow('', null),
    telefoneContato: Joi.string().trim().max(50).allow('', null),
    telefone2Contato: Joi.string().trim().max(50).allow('', null),
    emailContato: emailSchema.allow('', null).label('E-mail de contato'),
    obs: Joi.string().trim().max(4000).allow('', null)
});

const missionariosQuerySchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const agendaEventoSchema = Joi.object({
    titulo: Joi.string().trim().min(1).max(255).required().label('Título'),
    descricao: Joi.string().trim().max(4000).allow('', null).label('Descrição'),
    inicio: Joi.date().iso().required().label('Início'),
    fim: Joi.date().iso().required().label('Fim')
});

const agendaEventoQuerySchema = Joi.object({
    start: Joi.date().iso().optional().label('Início do período'),
    end: Joi.date().iso().optional().label('Fim do período')
});

const whatsappTemplateSchema = Joi.object({
    nome: Joi.string().trim().min(3).max(120).required().label('Nome do template'),
    gatilho: Joi.string().trim().valid('visitante_boas_vindas', 'evento_lembrete', 'oracao_resposta', 'manual').required().label('Gatilho'),
    conteudo: Joi.string().trim().min(5).max(4000).required().label('Conteúdo'),
    ativo: Joi.boolean().optional().default(true).label('Ativo')
});

const whatsappDispatchSchema = Joi.object({
    gatilho: Joi.string().trim().min(3).max(80).required().label('Gatilho'),
    destino: Joi.string().trim().min(8).max(40).required().label('Destino'),
    mensagem: Joi.string().trim().max(4000).allow('', null).optional().label('Mensagem'),
    variaveis: Joi.object().optional().label('Variáveis')
});

const whatsappLogQuerySchema = Joi.object({
    limit: Joi.number().integer().min(1).max(500).optional().label('Limite')
});

const triggerVisitanteSchema = Joi.object({
    destino: Joi.string().trim().min(8).max(40).required().label('Telefone destino'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome')
});

const triggerEventoSchema = Joi.object({
    destino: Joi.string().trim().min(8).max(40).required().label('Telefone destino'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    evento: Joi.string().trim().min(2).max(255).required().label('Evento'),
    data: Joi.string().trim().min(2).max(120).required().label('Data')
});

const triggerOracaoSchema = Joi.object({
    destino: Joi.string().trim().min(8).max(40).required().label('Telefone destino'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    resposta: Joi.string().trim().min(2).max(4000).required().label('Resposta')
});

const autocadastroPublicoSchema = Joi.object({
    igrejaId: Joi.number().integer().min(1).optional().label('Igreja'),
    igrejaNome: Joi.string().trim().max(255).allow('', null).optional().label('Nome da igreja'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    email: emailSchema.allow('', null).optional().label('E-mail'),
    telefone: Joi.string().trim().max(50).allow('', null).optional().label('Telefone'),
    cidade: Joi.string().trim().max(150).allow('', null).optional().label('Cidade'),
    ministerioInteresse: Joi.string().trim().max(255).allow('', null).optional().label('Interesse ministerial'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const autocadastroStatusQuerySchema = Joi.object({
    status: Joi.string().valid('pendente', 'aprovado', 'rejeitado').optional().label('Status')
});

const autocadastroAprovarSchema = Joi.object({
    criarAcesso: Joi.boolean().optional().default(false).label('Criar acesso'),
    senhaTemp: Joi.string().min(6).max(72).allow('', null).optional().label('Senha temporária'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const checkinSchema = Joi.object({
    visitanteId: Joi.number().integer().min(1).allow(null).optional().label('Visitante'),
    nomeVisitante: Joi.string().trim().min(2).max(255).required().label('Nome do visitante'),
    telefone: Joi.string().trim().max(50).allow('', null).optional().label('Telefone'),
    evento: Joi.string().trim().max(255).allow('', null).optional().label('Evento'),
    origem: Joi.string().valid('manual', 'qr').optional().label('Origem'),
    codigoQr: Joi.string().trim().max(255).allow('', null).optional().label('Código QR'),
    status: Joi.string().valid('entrada', 'saida').optional().label('Status')
});

const portariaCheckinQuerySchema = Joi.object({
    data: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().label('Data')
});

const pagamentoLinkSchema = Joi.object({
    descricao: Joi.string().trim().min(2).max(255).required().label('Descrição'),
    valor: decimalInput.label('Valor'),
    provider: Joi.string().trim().max(60).allow('', null).optional().label('Provedor'),
    pixKey: Joi.string().trim().max(255).allow('', null).optional().label('Chave PIX'),
    cardCheckoutUrl: Joi.string().trim().uri().max(2000).allow('', null).optional().label('Link de cartão')
});

const qrSessionSchema = Joi.object({
    evento: Joi.string().trim().min(2).max(255).required().label('Evento'),
    expiraEm: Joi.date().iso().optional().label('Expira em')
});

const visitanteQrPublicoSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    telefone: Joi.string().trim().max(50).allow('', null).optional().label('Telefone'),
    email: emailSchema.allow('', null).optional().label('E-mail'),
    cidade: Joi.string().trim().max(150).allow('', null).optional().label('Cidade'),
    pedidoOracao: Joi.string().trim().max(4000).allow('', null).optional().label('Pedido de oração'),
    autorizaTelao: Joi.boolean().optional().default(false).label('Autoriza telão')
});

const midiaVisitanteQuerySchema = Joi.object({
    status: Joi.string().valid('novo', 'selecionado', 'exibido', 'arquivado').optional().label('Status')
});

const midiaVisitanteStatusSchema = Joi.object({
    status: Joi.string().valid('selecionado', 'exibido', 'arquivado', 'novo').required().label('Status')
});

const paginationSchemaPart = {
    page: Joi.number().integer().min(1).optional().label('Página'),
    limit: Joi.number().integer().min(1).max(200).optional().label('Limite'),
    sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC').optional().label('Ordem'),
    meta: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('1', '0', 'true', 'false')).optional().label('Meta')
};

const dizimoSchema = Joi.object({
    membroId: Joi.number().integer().min(1).allow(null).optional().label('Membro'),
    membroNome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    valor: decimalInput.label('Valor'),
    competencia: Joi.string().trim().pattern(/^(0[1-9]|1[0-2])\/\d{4}$/).required().label('Competência'),
    tipo: Joi.string().valid('dizimo', 'oferta', 'missoes', 'outros').optional().default('dizimo').label('Tipo'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const dizimoFiltroSchema = Joi.object({
    competencia: Joi.string().trim().pattern(/^(0[1-9]|1[0-2])\/\d{4}$/).optional().label('Competência'),
    tipo: Joi.string().valid('dizimo', 'oferta', 'missoes', 'outros').optional().label('Tipo'),
    membroNome: Joi.string().trim().max(255).allow('', null).optional().label('Nome'),
    ...paginationSchemaPart
});

const tipoReceitaSchema = Joi.object({
    descricao: Joi.string().trim().min(2).max(255).required().label('Descrição'),
    planoConta: Joi.string().trim().min(2).max(255).required().label('Plano de Conta')
});

const tipoReceitaUpdateSchema = Joi.object({
    descricao: Joi.string().trim().min(2).max(255).required().label('Descrição'),
    planoConta: Joi.string().trim().min(2).max(255).required().label('Plano de Conta')
});

const tipoReceitaFiltroSchema = Joi.object({
    search: Joi.string().trim().max(255).allow('', null).optional().label('Busca')
});

const bancoContaSchema = Joi.object({
    nome: Joi.string().trim().min(2).max(255).required().label('Nome da conta'),
    banco: Joi.string().trim().max(120).allow('', null).optional().label('Banco'),
    agencia: Joi.string().trim().max(20).allow('', null).optional().label('Agência'),
    conta: Joi.string().trim().max(30).allow('', null).optional().label('Conta'),
    tipo: Joi.string().valid('corrente', 'poupanca', 'caixa_interno', 'investimento', 'outro').optional().default('corrente').label('Tipo'),
    saldoInicial: decimalInput.label('Saldo inicial'),
    ativo: Joi.boolean().optional().default(true).label('Ativo'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const bancoLancamentoSchema = Joi.object({
    descricao: Joi.string().trim().min(1).max(255).required().label('Descrição'),
    tipo: Joi.string().valid('entrada', 'saida').required().label('Tipo'),
    valor: decimalInput.label('Valor'),
    dataLancamento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required().label('Data'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const contaPagarSchema = Joi.object({
    descricao: Joi.string().trim().min(2).max(255).required().label('Descrição'),
    fornecedor: Joi.string().trim().max(255).allow('', null).optional().label('Fornecedor'),
    valor: decimalInput.label('Valor'),
    vencimento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required().label('Vencimento'),
    categoria: Joi.string().trim().max(120).allow('', null).optional().label('Categoria'),
    observacao: Joi.string().trim().max(2000).allow('', null).optional().label('Observação')
});

const transacaoFiltroSchema = Joi.object({
    tipo: Joi.string().valid('entrada', 'saida').optional().label('Tipo'),
    descricao: Joi.string().trim().max(255).allow('', null).optional().label('Descrição'),
    startDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().label('Data inicial'),
    endDate: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).optional().label('Data final'),
    sortBy: Joi.string().valid('id', 'created_at', 'amount', 'description', 'type').optional().label('Ordenar por'),
    ...paginationSchemaPart
});

const contabilidadePlanoContaSchema = Joi.object({
    codigo: Joi.string().trim().min(2).max(50).required().label('Código'),
    nome: Joi.string().trim().min(2).max(255).required().label('Nome'),
    natureza: Joi.string().valid('ativo', 'passivo', 'receita', 'despesa').required().label('Natureza')
});

const contabilidadeBalanceteSchema = Joi.object({
    conta: Joi.string().trim().min(2).max(255).required().label('Conta'),
    debito: decimalInput.label('Débito'),
    credito: decimalInput.label('Crédito')
});

const contabilidadeLancamentoSchema = Joi.object({
    dataLancamento: Joi.string().trim().pattern(/^\d{4}-\d{2}-\d{2}$/).required().label('Data'),
    historico: Joi.string().trim().min(2).max(500).required().label('Histórico'),
    contaDebito: Joi.string().trim().min(2).max(255).required().label('Conta Débito'),
    contaCredito: Joi.string().trim().min(2).max(255).required().label('Conta Crédito'),
    valor: decimalInput.label('Valor')
});

const contabilidadeEncerramentoSchema = Joi.object({
    observacao: Joi.string().trim().min(4).max(500).required().label('Observação')
});

const membroFiltroSchema = Joi.object({
    nome: Joi.string().trim().max(255).allow('', null).label('Nome'),
    email: Joi.string().trim().max(255).allow('', null).label('E-mail'),
    telefone: Joi.string().trim().max(50).allow('', null).label('Telefone'),
    cidade: Joi.string().trim().max(255).allow('', null).label('Cidade'),
    sortBy: Joi.string().valid('id', 'created_at', 'nome', 'email', 'cidade').optional().label('Ordenar por'),
    churchId: Joi.alternatives().try(Joi.number(), Joi.string()).optional()
}).keys(paginationSchemaPart);

function formatJoiError(error) {
    if (!error?.details?.length) {
        return 'Dados inválidos.';
    }

    const messages = error.details.map((detail) => detail.message.replace(/"/g, ''));
    return messages.join(' ');
}

function validateBody(schema) {
    return (req, res, next) => {
        const { value, error } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            messages: JOI_MESSAGES
        });

        if (error) {
            return res.status(400).json({ error: formatJoiError(error) });
        }

        req.validatedBody = value;
        return next();
    };
}

function validateQuery(schema) {
    return (req, res, next) => {
        const { value, error } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
            messages: JOI_MESSAGES
        });

        if (error) {
            return res.status(400).json({ error: formatJoiError(error) });
        }

        req.validatedQuery = value;
        return next();
    };
}

module.exports = {
    agendaEventoQuerySchema,
    agendaEventoSchema,
    dizimoFiltroSchema,
    dizimoSchema,
    autocadastroAprovarSchema,
    autocadastroPublicoSchema,
    autocadastroStatusQuerySchema,
    cargoSchema,
    checkinSchema,
    congregadoFiltroSchema,
    congregadoSchema,
    criancaFiltroSchema,
    criancaSchema,
    createContaSchema,
    loginSchema,
    missionariosQuerySchema,
    missionariosSchema,
    midiaVisitanteQuerySchema,
    midiaVisitanteStatusSchema,
    oracaoFiltroSchema,
    oracaoRespostaSchema,
    oracaoSchema,
    pagamentoLinkSchema,
    portariaCheckinQuerySchema,
    qrSessionSchema,
    transacaoFiltroSchema,
    triggerEventoSchema,
    triggerOracaoSchema,
    triggerVisitanteSchema,
    tipoReceitaFiltroSchema,
    tipoReceitaSchema,
    tipoReceitaUpdateSchema,
    membroFiltroSchema,
    membroSchema,
    outrasIgrejasQuerySchema,
    outrasIgrejasSchema,
    saldoInicialSchema,
    transacaoSchema,
    bancoContaSchema,
    bancoLancamentoSchema,
    contaPagarSchema,
    contabilidadeBalanceteSchema,
    contabilidadeEncerramentoSchema,
    contabilidadeLancamentoSchema,
    contabilidadePlanoContaSchema,
    validateBody,
    validateQuery,
    visitanteQrPublicoSchema,
    whatsappDispatchSchema,
    whatsappLogQuerySchema,
    whatsappTemplateSchema,
    visitanteFiltroSchema,
    visitanteSchema
};