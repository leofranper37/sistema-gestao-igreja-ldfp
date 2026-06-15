/**
 * paymentService.js
 * Integração com Mercado Pago — PIX e Cartão de Crédito (Checkout Pro).
 */

const { MercadoPagoConfig, Payment, Preference } = require('mercadopago');
const crypto = require('crypto');
const { pool } = require('../config/db');

// ── Planos fixos (slug → dados) ──────────────────────────────────────────────
// Mantidos aqui como fallback; a tabela saas_planos é a fonte principal.
const PLANOS_FALLBACK = {
    eden:          { nome: 'Éden',         preco_mensal: 0,    preco_anual: 0,    dias: 30 },
    hebrom:        { nome: 'Hebrom',       preco_mensal: 50,   preco_anual: 500,  dias: 30 },
    betel:         { nome: 'Betel',        preco_mensal: 80,   preco_anual: 800,  dias: 30 },
    siao:          { nome: 'Sião',         preco_mensal: 100,  preco_anual: 1000, dias: 30 },
    'teste-7-dias':{ nome: 'Trial 7 dias', preco_mensal: 0,    preco_anual: 0,    dias: 7  },
};

function getMpClient() {
    const token = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!token || token.startsWith('APP_USR-COLE')) {
        throw new Error('Token do Mercado Pago não configurado. Defina MP_ACCESS_TOKEN (ou MERCADOPAGO_ACCESS_TOKEN) no .env/painel de deploy.');
    }
    return new MercadoPagoConfig({ accessToken: token });
}

async function getPlano(slug) {
    try {
        const [rows] = await pool.query(
            'SELECT slug, nome, preco_mensal, preco_anual FROM saas_planos WHERE slug = ? AND ativo = 1 LIMIT 1',
            [slug]
        );
        if (rows && rows[0]) return rows[0];
    } catch (_) { /* fallback abaixo */ }
    return PLANOS_FALLBACK[slug] || null;
}

function gerarReference() {
    return `LDFP-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

function normalizePixText(value, maxLen) {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 .\-]/g, '')
        .toUpperCase()
        .trim();
    return maxLen ? normalized.slice(0, maxLen) : normalized;
}

function pixField(id, value) {
    const str = String(value || '');
    return `${id}${String(str.length).padStart(2, '0')}${str}`;
}

function crc16(payload) {
    let crc = 0xffff;
    for (let i = 0; i < payload.length; i += 1) {
        crc ^= payload.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j += 1) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function buildManualPixPayload({ key, name, city, amount, txid }) {
    // BACEN spec: campo 26 sem descrição para máxima compatibilidade
    const gui = pixField('00', 'br.gov.bcb.pix');
    const pixKey = pixField('01', key);
    const merchantInfo = pixField('26', `${gui}${pixKey}`);

    // BACEN spec: txid campo 62.05 deve ser estritamente [a-zA-Z0-9]{1,25}
    const cleanTxid = String(txid || '')
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 25) || 'LDFP';

    const payloadSemCrc = [
        pixField('00', '01'),
        merchantInfo,
        pixField('52', '0000'),
        pixField('53', '986'),
        pixField('54', Number(amount).toFixed(2)),
        pixField('58', 'BR'),
        pixField('59', normalizePixText(name, 25) || 'RECEBEDOR'),
        pixField('60', normalizePixText(city, 15) || 'SAO PAULO'),
        pixField('62', pixField('05', cleanTxid)),
        '6304',
    ].join('');

    return `${payloadSemCrc}${crc16(payloadSemCrc)}`;
}

// ── PIX via Mercado Pago ─────────────────────────────────────────────────────
async function gerarPix({ igrejaId, nomeIgreja, emailPagador, planoSlug, ciclo }) {
    const plano = await getPlano(planoSlug);
    if (!plano) throw new Error(`Plano "${planoSlug}" não encontrado.`);

    const valor = ciclo === 'anual' ? Number(plano.preco_anual) : Number(plano.preco_mensal);
    if (!valor || valor <= 0) throw new Error('Este plano não possui cobrança (valor zero).');

    const referenceCode = gerarReference();
    const descricao = `LDFP — ${plano.nome} (${ciclo === 'anual' ? 'Anual' : 'Mensal'})`;
    const diasDuracao = ciclo === 'anual' ? 365 : 30;

    const mpToken = process.env.MP_ACCESS_TOKEN || process.env.MERCADOPAGO_ACCESS_TOKEN;
    const hasMpToken = !!mpToken && !mpToken.startsWith('APP_USR-COLE');

    if (!hasMpToken) {
        const manualPixKey = process.env.PIX_KEY || process.env.PIX_CHAVE || process.env.MP_PIX_KEY;
        if (!manualPixKey) {
            throw new Error('Chave PIX não configurada. Defina PIX_KEY no .env/painel de deploy.');
        }
        const receiverName = process.env.PIX_RECEIVER_NAME || 'LDFP SISTEMA';
        const receiverCity = process.env.PIX_RECEIVER_CITY || 'SAO PAULO';

        const payloadPix = buildManualPixPayload({
            key: manualPixKey,
            name: receiverName,
            city: receiverCity,
            amount: valor,
            txid: referenceCode,
        });

        await pool.query(
            `INSERT INTO payment_links
                (igreja_id, reference_code, descricao, valor, provider, payment_method, status,
                 provider_external_id, plano_destino, plano_duracao_dias, created_at)
             VALUES (?, ?, ?, ?, 'manual_pix', 'pix', 'pendente', ?, ?, ?, NOW())`,
            [igrejaId, referenceCode, descricao, valor, null, planoSlug, diasDuracao]
        );

        return {
            referenceCode,
            valor,
            qrCode: payloadPix,
            qrCodeBase64: null,
            qrCodeImageUrl: `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(payloadPix)}`,
            expiresAt: null,
            descricao,
            provider: 'manual_pix_key',
            statusMessage: 'PIX gerado com sua chave. A confirmação do pagamento será manual.',
        };
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min de validade do QR

    const client = getMpClient();
    const paymentApi = new Payment(client);

    const mpResponse = await paymentApi.create({
        body: {
            transaction_amount: valor,
            description: descricao,
            payment_method_id: 'pix',
            payer: {
                email: emailPagador || process.env.MP_DEFAULT_PAYER_EMAIL || 'pagador@ldfp.com.br',
            },
            date_of_expiration: expiresAt.toISOString(),
            external_reference: referenceCode,
        }
    });

    const pixData = mpResponse.point_of_interaction?.transaction_data;
    if (!pixData?.qr_code) {
        throw new Error('Mercado Pago não retornou QR Code PIX. Verifique o token de acesso.');
    }

    // Salva o link de pagamento
    await pool.query(
        `INSERT INTO payment_links
            (igreja_id, reference_code, descricao, valor, provider, payment_method, status,
             provider_external_id, plano_destino, plano_duracao_dias, created_at)
         VALUES (?, ?, ?, ?, 'mercadopago', 'pix', 'pendente', ?, ?, ?, NOW())`,
        [igrejaId, referenceCode, descricao, valor, String(mpResponse.id), planoSlug, diasDuracao]
    );

    return {
        referenceCode,
        mpPaymentId: mpResponse.id,
        valor,
        qrCode: pixData.qr_code,
        qrCodeBase64: pixData.qr_code_base64 || null,
        expiresAt: expiresAt.toISOString(),
        descricao,
    };
}

// ── Cartão de Crédito — Checkout Pro ────────────────────────────────────────
async function gerarCheckoutCartao({ igrejaId, nomeIgreja, emailPagador, planoSlug, ciclo }) {
    const plano = await getPlano(planoSlug);
    if (!plano) throw new Error(`Plano "${planoSlug}" não encontrado.`);

    const valor = ciclo === 'anual' ? Number(plano.preco_anual) : Number(plano.preco_mensal);
    if (!valor || valor <= 0) throw new Error('Este plano não possui cobrança (valor zero).');

    const referenceCode = gerarReference();
    const descricao = `LDFP — ${plano.nome} (${ciclo === 'anual' ? 'Anual' : 'Mensal'})`;
    const diasDuracao = ciclo === 'anual' ? 365 : 30;

    const baseUrl = process.env.APP_PUBLIC_BASE_URL || process.env.APP_BASE_URL || 'https://ldfp.com.br';

    const client = getMpClient();
    const preferenceApi = new Preference(client);

    const mpResponse = await preferenceApi.create({
        body: {
            items: [{
                title: descricao,
                quantity: 1,
                unit_price: valor,
                currency_id: 'BRL',
            }],
            payer: { email: emailPagador },
            external_reference: referenceCode,
            back_urls: {
                success: `${baseUrl}/pagamento_sucesso.html?ref=${referenceCode}`,
                failure: `${baseUrl}/assinar.html?erro=pagamento_falhou`,
                pending: `${baseUrl}/assinar.html?pendente=1`,
            },
            auto_return: 'approved',
            notification_url: process.env.MP_WEBHOOK_URL,
        }
    });

    await pool.query(
        `INSERT INTO payment_links
            (igreja_id, reference_code, descricao, valor, payment_method, status,
             mp_payment_id, plano_destino, plano_duracao_dias, created_at)
         VALUES (?, ?, ?, ?, 'cartao', 'pendente', ?, ?, ?, NOW())`,
        [igrejaId, referenceCode, descricao, valor, String(mpResponse.id), planoSlug, diasDuracao]
    );

    return {
        referenceCode,
        mpPreferenceId: mpResponse.id,
        checkoutUrl: mpResponse.init_point,      // URL de pagamento no MP
        sandboxUrl: mpResponse.sandbox_init_point,
        valor,
        descricao,
    };
}

// ── Processar Webhook do Mercado Pago ────────────────────────────────────────
async function processarWebhook({ mpPaymentId, status, externalReference }) {
    if (status !== 'approved') {
        // Atualiza status no banco mesmo que rejeitado/pendente
        if (externalReference) {
            await pool.query(
                `UPDATE payment_links SET status = ?, mp_payment_id = ?, paid_at = NULL WHERE reference_code = ?`,
                [status === 'rejected' ? 'rejeitado' : 'pendente', String(mpPaymentId), externalReference]
            ).catch(() => {});
        }
        return { activated: false };
    }

    // Busca o registro pelo id do MP ou pela referência
    const [rows] = await pool.query(
        `SELECT * FROM payment_links WHERE reference_code = ? OR mp_payment_id = ? LIMIT 1`,
        [externalReference || '', String(mpPaymentId)]
    );
    const link = rows?.[0];
    if (!link) return { activated: false, reason: 'payment_link_not_found' };
    if (link.status === 'pago') return { activated: true, reason: 'already_processed' };

    const agora = new Date();
    const proximoVencimento = new Date(agora.getTime() + link.plano_duracao_dias * 24 * 60 * 60 * 1000);

    const conn = await pool.getConnection();
    try {
        await conn.query('BEGIN');

        await conn.query(
            `UPDATE igrejas SET
                plano = ?,
                status_assinatura = 'ativa',
                ultimo_pagamento = NOW(),
                proximo_vencimento = ?
             WHERE id = ?`,
            [link.plano_destino, proximoVencimento.toISOString(), link.igreja_id]
        );

        await conn.query(
            `UPDATE payment_links SET status = 'pago', paid_at = NOW(), mp_payment_id = ? WHERE id = ?`,
            [String(mpPaymentId), link.id]
        );

        await conn.query('COMMIT');
    } catch (err) {
        await conn.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        conn.release();
    }

    return { activated: true, igrejaId: link.igreja_id, plano: link.plano_destino };
}

// ── Verificar assinatura HMAC do webhook ─────────────────────────────────────
function verificarAssinaturaWebhook(rawBody, signatureHeader) {
    const secret = process.env.MP_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) return false;

    // O MP envia: ts=...;v1=...
    const parts = signatureHeader.split(';');
    const tsPart = parts.find(p => p.startsWith('ts='));
    const v1Part = parts.find(p => p.startsWith('v1='));
    if (!tsPart || !v1Part) return false;

    const ts = tsPart.replace('ts=', '');
    const v1 = v1Part.replace('v1=', '');
    const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(`id:${rawBody};request-id:;ts:${ts}`)
        .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(v1));
}

module.exports = {
    gerarPix,
    gerarCheckoutCartao,
    processarWebhook,
    verificarAssinaturaWebhook,
    getPlano,
};
