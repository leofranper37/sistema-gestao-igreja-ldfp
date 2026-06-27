const { pool } = require('../config/db');

exports.gerarPix = async (req, res) => {
    try {
        const { valor, descricao, tipo } = req.body;
        const igrejaId = req.auth.igrejaId;
        const membroId = req.auth.id;

        if (!valor || isNaN(valor) || valor <= 0) {
            return res.status(400).json({ error: 'Valor inválido.' });
        }

        const mpToken = process.env.MP_ACCESS_TOKEN;
        if (!mpToken) {
            return res.status(500).json({ error: 'Integração Mercado Pago não configurada no servidor (token ausente).' });
        }

        const reference = `PIX-${igrejaId}-${membroId}-${Date.now()}`;
        
        // Payload exigido pelo Mercado Pago para criar um PIX
        const paymentData = {
            transaction_amount: Number(valor),
            description: `${tipo || 'Contribuição'}: ${descricao || 'Dízimo/Oferta'}`,
            payment_method_id: 'pix',
            payer: {
                email: req.auth.email || `membro_${membroId}@igreja.local`,
                first_name: req.auth.nome || 'Membro'
            },
            external_reference: reference,
            notification_url: `${process.env.APP_BASE_URL || 'https://ldfp.com.br'}/api/pagamentos/webhook/mercado-pago`
        };

        // Chamada direta à API do Mercado Pago
        const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${mpToken}`,
                'X-Idempotency-Key': reference
            },
            body: JSON.stringify(paymentData)
        });

        const mpJson = await mpRes.json();

        if (!mpRes.ok || !mpJson.point_of_interaction) {
            console.error('[PIX] Erro Mercado Pago:', mpJson);
            throw new Error('Falha ao gerar PIX no gateway de pagamento.');
        }

        const qrCode = mpJson.point_of_interaction.transaction_data.qr_code;
        const qrCodeBase64 = mpJson.point_of_interaction.transaction_data.qr_code_base64;

        // Salvar intenção de pagamento no banco (será dado baixa pelo Webhook)
        await pool.query(
            `INSERT INTO payment_links (igreja_id, descricao, valor, provider, payment_method, status, reference_code, provider_external_id, qr_code, qr_code_base64, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [igrejaId, paymentData.description, valor, 'mercado_pago', 'pix', 'pendente', reference, mpJson.id, qrCode, qrCodeBase64, membroId]
        );

        res.json({ qr_code: qrCode, qr_code_base64: qrCodeBase64, reference, valor });
    } catch (error) {
        console.error('[PIX] Erro gerarPix:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao gerar PIX.' });
    }
};