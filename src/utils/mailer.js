const nodemailer = require('nodemailer');

const smtpHost = process.env.SMTP_HOST;
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const smtpFrom = process.env.SMTP_FROM || '"LDFP Sistema" <no-reply@ldfp.com.br>';

const transporter = smtpHost
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpSecure,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })
    : null;

async function sendMail({ to, subject, html }) {
    if (!transporter) {
        console.log(`[MAILER] SMTP não configurado. E-mail para ${to} | Assunto: ${subject}`);
        return;
    }
    await transporter.sendMail({ from: smtpFrom, to, subject, html });
}

module.exports = { sendMail };
