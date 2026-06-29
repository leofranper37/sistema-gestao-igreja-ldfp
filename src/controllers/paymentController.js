const paymentService = require('../services/paymentService');
const { pool } = require('../config/db');
const { createHttpError } = require('../utils/httpError');

// POST /api/pagamentos/pix
async function gerarPix(req, res) {
    const { planoSlug, ciclo = 'mensal' } = req.validatedBody || req.body;
    if (!planoSlug) throw createHttpError(400, 'planoSlug é obrigatório.');

    const igrejaId = req.auth?.igrejaId;
    const nomeIgreja = req.auth?.igreja || '';
    const emailPagador = req.auth?.email || process.env.MP_DEFAULT_PAYER_EMAIL;

    const result = await paymentService.gerarPix({ igrejaId, nomeIgreja, emailPagador, planoSlug, ciclo });
    res.json(result);
}

// POST /api/pagamentos/cartao
async function gerarCartao(req, res) {
    const { planoSlug, ciclo = 'mensal' } = req.validatedBody || req.body;
    if (!planoSlug) throw createHttpError(400, 'planoSlug é obrigatório.');

    const igrejaId = req.auth?.igrejaId;
    const nomeIgreja = req.auth?.igreja || '';
    const emailPagador = req.auth?.email || process.env.MP_DEFAULT_PAYER_EMAIL;

    const result = await paymentService.gerarCheckoutCartao({ igrejaId, nomeIgreja, emailPagador, planoSlug, ciclo });
    res.json(result);
}

// GET /api/pagamentos/planos  — lista planos disponíveis (com fallback garantido)
async function listarPlanos(req, res) {
    // Fallback padrão se tudo falhar
    const FALLBACK_PLANOS = [
        {
            slug: 'hebrom',
            nome: 'Hebrom',
            subtitulo: 'Igrejas em formacao',
            preco_mensal: 50,
            preco_anual: 500,
            max_cadastros: 150,
            max_congregacoes: 1,
            modulo_app_membro: 0,
            features_json: '["App Web Instalavel (PWA)","150 cadastros","1 congregacao","Suporte via e-mail"]'
        },
        {
            slug: 'betel',
            nome: 'Betel',
            subtitulo: 'Igrejas em crescimento',
            preco_mensal: 80,
            preco_anual: 800,
            max_cadastros: 300,
            max_congregacoes: 5,
            modulo_app_membro: 1,
            features_json: '["App do Membro","300 cadastros","5 congregacoes","Suporte via e-mail e WhatsApp"]'
        },
        {
            slug: 'siao',
            nome: 'Siao',
            subtitulo: 'Operacao avancada',
            preco_mensal: 100,
            preco_anual: 1000,
            max_cadastros: 500,
            max_congregacoes: 10,
            modulo_app_membro: 1,
            features_json: '["App do Membro","500 cadastros","10 congregacoes","Suporte prioritario"]'
        }
    ];

    try {
        const [rows] = await pool.query(
            `SELECT slug, nome, subtitulo, preco_mensal, preco_anual,
                    max_cadastros, max_congregacoes, modulo_app_membro, features_json
             FROM saas_planos
             WHERE ativo = 1 AND LOWER(slug) NOT IN ('eden', 'edon')
             ORDER BY preco_mensal ASC`
        );

        if (Array.isArray(rows) && rows.length > 0) {
            const result = rows.map(r => {
                // Se o admin já preencheu os benefícios, usa eles
                let features = [];
                try { features = JSON.parse(r.features_json || '[]'); } catch (_) {}

                // Se estiver vazio, gera lista automática a partir dos dados do plano
                if (!features.length) {
                    if (r.max_cadastros > 0) features.push(`Até ${r.max_cadastros} membros cadastrados`);
                    if (r.max_congregacoes > 1) features.push(`Até ${r.max_congregacoes} congregações`);
                    else features.push('1 congregação');
                    if (r.modulo_app_membro) features.push('App do Membro (iOS e Android)');
                    features.push('Suporte via e-mail');
                }

                return { ...r, features_json: JSON.stringify(features) };
            });

            return res.json(result);
        }
    } catch (err) {
        console.error('[paymentController] Erro ao consultar saas_planos:', err.message);
    }

    // Fallback: retorna planos padrão se banco falhar ou estiver vazio
    res.json(FALLBACK_PLANOS);
}

// GET /api/pagamentos/status  — status da assinatura da igreja logada
async function statusAssinatura(req, res) {
    const igrejaId = req.auth?.igrejaId;
    if (!igrejaId) return res.json({ status: 'sem_igreja' });

    const [rows] = await pool.query(
        `SELECT plano, status_assinatura, trial_ends_at, proximo_vencimento, ultimo_pagamento
         FROM igrejas WHERE id = ? LIMIT 1`,
        [igrejaId]
    );
    const ig = rows?.[0];
    if (!ig) return res.json({ status: 'nao_encontrado' });

    const agora = new Date();
    let statusEfetivo = ig.status_assinatura;

    if (statusEfetivo === 'trial' && ig.trial_ends_at && new Date(ig.trial_ends_at) < agora) {
        statusEfetivo = 'expirado';
    }

    res.json({
        plano: ig.plano,
        status: statusEfetivo,
        trialEndsAt: ig.trial_ends_at,
        proximoVencimento: ig.proximo_vencimento,
        ultimoPagamento: ig.ultimo_pagamento,
    });
}

// POST /api/pagamentos/webhook/mercado-pago  — notificação do MP
async function webhookMercadoPago(req, res) {
    // Valida assinatura secreta do Mercado Pago (MP_WEBHOOK_SECRET)
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (secret) {
        try {
            const crypto = require('crypto');
            const xSignature = req.headers['x-signature'] || '';
            const xRequestId = req.headers['x-request-id'] || '';
            const dataId = req.query['data.id'] || req.body?.data?.id || '';

            // Extrai ts e v1 do header x-signature (formato: ts=...;v1=...)
            const parts = Object.fromEntries(xSignature.split(';').map(p => p.split('=')));
            const ts = parts['ts'] || '';
            const v1 = parts['v1'] || '';

            const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
            const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

            if (!v1 || v1 !== expected) {
                return res.sendStatus(401);
            }
        } catch (_) {
            // Se falhar a validação por erro interno, deixa passar mas loga
            console.warn('[webhook/mp] Falha na validação de assinatura');
        }
    }

    // Responde 200 imediatamente para o MP (prazo máximo ~5s)
    res.sendStatus(200);

    try {
        const body = req.body || {};
        const tipo = body.type || body.action || '';

        // Suporta tanto eventos "payment" quanto "merchant_order"
        if (!['payment', 'payment.updated', 'payment.created'].some(t => tipo.startsWith(t))) {
            return; // ignora tipos que não são pagamento
        }

        const mpPaymentId = body.data?.id || body.id;
        if (!mpPaymentId) return;

        // Busca detalhes do pagamento no MP para confirmar o status real
        const { MercadoPagoConfig, Payment } = require('mercadopago');
        const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
        if (!token || token.startsWith('APP_USR-COLE')) return;

        const client = new MercadoPagoConfig({ accessToken: token });
        const paymentApi = new Payment(client);
        const mpData = await paymentApi.get({ id: String(mpPaymentId) });

        await paymentService.processarWebhook({
            mpPaymentId: mpData.id,
            status: mpData.status,
            externalReference: mpData.external_reference,
        });
    } catch (err) {
        // Log silencioso — não podemos retornar erro (já enviamos 200)
        console.error('[webhook/mp] Erro ao processar:', err.message);
    }
}

module.exports = {
    gerarPix,
    gerarCartao,
    listarPlanos,
    statusAssinatura,
    webhookMercadoPago,
};
