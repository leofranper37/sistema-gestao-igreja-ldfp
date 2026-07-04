const cron = require('node-cron');
const { pool } = require('../config/db');
const { sendMail } = require('../utils/mailer');

// ── Log de e-mails enviados ──────────────────────────────────────────────────
// Tabela criada automaticamente na primeira execução.
// UNIQUE KEY (igreja_id, tipo, referencia) garante que INSERT IGNORE bloqueia
// duplicatas mesmo se o cron for chamado duas vezes seguidas.

async function ensureLogTable() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS saas_email_log (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            igreja_id   INT NOT NULL,
            tipo        VARCHAR(50) NOT NULL,
            referencia  VARCHAR(30) NOT NULL,
            enviado_em  DATETIME NOT NULL,
            UNIQUE KEY uq_log (igreja_id, tipo, referencia)
        )
    `);
}

// Retorna true se o e-mail deste tipo+referência já foi enviado para a igreja.
async function jaEnviado(igrejaId, tipo, referencia) {
    const [rows] = await pool.query(
        'SELECT id FROM saas_email_log WHERE igreja_id = ? AND tipo = ? AND referencia = ? LIMIT 1',
        [igrejaId, tipo, referencia]
    );
    return rows.length > 0;
}

// Registra o envio. INSERT IGNORE: se a UNIQUE KEY já existe, não faz nada.
async function registrarEnvio(igrejaId, tipo, referencia) {
    await pool.query(
        'INSERT IGNORE INTO saas_email_log (igreja_id, tipo, referencia, enviado_em) VALUES (?, ?, ?, NOW())',
        [igrejaId, tipo, referencia]
    );
}

// ── Templates ────────────────────────────────────────────────────────────────

function htmlAviso3d(nome, dias, trialEndsAt) {
    const dataFmt = new Date(trialEndsAt).toLocaleDateString('pt-BR');
    return `
<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <div style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:28px 32px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;color:#fff;font-size:1.3rem">Seu teste expira em ${dias} dia(s)</h1>
    <p style="margin:8px 0 0;color:#fef3c7;font-size:.9rem">Não perca o acesso ao sistema</p>
  </div>
  <div style="background:#fffbeb;padding:28px 32px;border:1px solid #fde68a;border-top:none">
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>Seu período de avaliação gratuita termina em <strong>${dataFmt}</strong>.</p>
    <p>Para continuar usando o LDFP Sistema sem interrupção, ative seu plano antes dessa data.</p>
    <p style="margin-top:24px">
      <a href="https://ldfp.com.br" style="background:#f59e0b;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">
        Acessar o sistema
      </a>
    </p>
    <p style="margin-top:24px;font-size:.85rem;color:#92400e">
      Dúvidas? Entre em contato com o suporte LDFP.
    </p>
  </div>
</div>`;
}

function htmlSuspensao(nome) {
    return `
<div style="font-family:'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1e293b">
  <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);padding:28px 32px;border-radius:12px 12px 0 0">
    <h1 style="margin:0;color:#fff;font-size:1.3rem">Conta suspensa</h1>
    <p style="margin:8px 0 0;color:#fecaca;font-size:.9rem">Período de avaliação encerrado</p>
  </div>
  <div style="background:#fef2f2;padding:28px 32px;border:1px solid #fecaca;border-top:none">
    <p>Olá, <strong>${nome}</strong>!</p>
    <p>O período de avaliação gratuita da sua conta encerrou e o acesso foi temporariamente suspenso.</p>
    <p>Para reativar sua conta, entre em contato com o suporte LDFP.</p>
    <p style="margin-top:24px;font-size:.85rem;color:#991b1b">
      Seus dados estão preservados e serão restaurados após a reativação.
    </p>
  </div>
</div>`;
}

// ── Job principal ─────────────────────────────────────────────────────────────

async function rodarCobranca() {
    try {
        await ensureLogTable();

        const hoje = new Date().toISOString().slice(0, 10);

        // 1. Aviso 3 dias antes — referência = data de expiração do trial
        const [proximos] = await pool.query(`
            SELECT id, nome, email_admin, trial_ends_at
            FROM igrejas
            WHERE is_system = 0
              AND status_assinatura = 'trial'
              AND trial_ends_at IS NOT NULL
              AND trial_ends_at > NOW()
              AND trial_ends_at <= DATE_ADD(NOW(), INTERVAL 3 DAY)
        `);

        for (const ig of proximos) {
            const refDate = String(ig.trial_ends_at).slice(0, 10);
            if (await jaEnviado(ig.id, 'aviso_trial_3d', refDate)) continue;

            const dias = Math.ceil((new Date(ig.trial_ends_at) - new Date()) / 86400000);
            await sendMail({
                to: ig.email_admin,
                subject: `Seu período de teste expira em ${dias} dia(s) — LDFP Sistema`,
                html: htmlAviso3d(ig.nome, dias, ig.trial_ends_at)
            });
            await registrarEnvio(ig.id, 'aviso_trial_3d', refDate);
            console.log(`[CRON] Aviso trial enviado → igreja ${ig.id} (${ig.nome})`);
        }

        // 2. Suspender trials expirados — referência = hoje (evita duplicata no mesmo dia)
        const [expirados] = await pool.query(`
            SELECT id, nome, email_admin
            FROM igrejas
            WHERE is_system = 0
              AND status_assinatura = 'trial'
              AND trial_ends_at IS NOT NULL
              AND trial_ends_at < NOW()
        `);

        for (const ig of expirados) {
            // Suspende no banco independente do e-mail
            await pool.query(
                "UPDATE igrejas SET status_assinatura = 'suspensa' WHERE id = ? AND status_assinatura = 'trial'",
                [ig.id]
            );

            if (await jaEnviado(ig.id, 'suspensao', hoje)) continue;

            await sendMail({
                to: ig.email_admin,
                subject: 'Sua conta foi suspensa — LDFP Sistema',
                html: htmlSuspensao(ig.nome)
            });
            await registrarEnvio(ig.id, 'suspensao', hoje);
            console.log(`[CRON] Suspensão enviada → igreja ${ig.id} (${ig.nome})`);
        }
    } catch (err) {
        console.error('[CRON cobranca] Erro:', err.message);
    }
}

// ── Inicialização ─────────────────────────────────────────────────────────────

function iniciarCronCobranca() {
    // Roda todo dia às 11:00 UTC = 08:00 BRT
    cron.schedule('0 11 * * *', rodarCobranca);
    console.log('[CRON] Cron de cobrança iniciado — executa às 08:00 BRT (11:00 UTC)');
}

module.exports = { iniciarCronCobranca, rodarCobranca };
