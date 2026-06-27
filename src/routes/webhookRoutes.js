const crypto = require('crypto');
const { exec } = require('child_process');
const express = require('express');

const router = express.Router();

const DEPLOY_DIR = process.env.DEPLOY_DIR;
const DEPLOY_BRANCH = process.env.DEPLOY_BRANCH || 'main';

function verifyGithubSignature(req) {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) return false;

    const received = req.headers['x-hub-signature-256'] || '';
    if (!received.startsWith('sha256=')) return false;

    const rawBody = req.rawBody;
    if (!rawBody || !rawBody.length) return false;

    const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    // timingSafeEqual requires equal-length buffers
    const receivedBuf = Buffer.from(received);
    const expectedBuf = Buffer.from(expected);
    if (receivedBuf.length !== expectedBuf.length) return false;

    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
}

router.post('/', (req, res) => {
    if (!process.env.GITHUB_WEBHOOK_SECRET) {
        console.error('[webhook/github] GITHUB_WEBHOOK_SECRET não configurado.');
        return res.status(503).json({ error: 'Webhook não configurado no servidor.' });
    }

    if (!DEPLOY_DIR) {
        console.error('[webhook/github] DEPLOY_DIR não configurado.');
        return res.status(503).json({ error: 'Diretório de deploy não configurado no servidor.' });
    }

    if (!verifyGithubSignature(req)) {
        return res.status(401).json({ error: 'Assinatura inválida.' });
    }

    // Only act on push events
    const event = req.headers['x-github-event'];
    if (event !== 'push') {
        return res.status(200).json({ message: `Evento "${event}" ignorado.` });
    }

    // Only deploy when the configured branch is pushed
    const ref = req.body?.ref || '';
    if (ref !== `refs/heads/${DEPLOY_BRANCH}`) {
        return res.status(200).json({ message: `Ref "${ref}" ignorado.` });
    }

    // Respond immediately — GitHub retries if we take too long
    res.status(202).json({ message: 'Deploy iniciado.' });

    const cmd = `cd ${DEPLOY_DIR} && git pull origin ${DEPLOY_BRANCH} && touch tmp/restart.txt`;
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
        if (error) {
            console.error('[webhook/github] Erro no deploy:', error.message);
            if (stderr) console.error('[webhook/github] stderr:', stderr.trim());
            return;
        }
        console.log('[webhook/github] Deploy concluído:', stdout.trim());
    });
});

module.exports = router;
