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

// GET /api/pagamentos/planos  — lista planos disponíveis
async function listarPlanos(req, res) {
    try {
        const [rows] = await pool.query(
            `SELECT slug, nome, subtitulo, preco_mensal, preco_anual,
                    max_cadastros, max_congregacoes, modulo_app_membro, features_json
             FROM saas_planos
             WHERE ativo = 1 AND LOWER(slug) <> 'eden'
             ORDER BY preco_mensal ASC`
        );
        res.json(rows || []);
    } catch (_) {
        res.json([]);
    }
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
