const realtime = require('../services/realtimeService');

function sendSseEvent(res, eventName, payload) {
    res.write(`event: ${eventName}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function streamEvents(req, res) {
    const requestedChannel = String(req.query.channel || 'broadcast').trim();
    const igrejaId = req.auth?.igrejaId || null;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    sendSseEvent(res, 'connected', {
        channel: requestedChannel,
        igrejaId,
        time: new Date().toISOString()
    });

    const unsubscribe = realtime.subscribe(requestedChannel === 'broadcast' ? null : requestedChannel, (event) => {
        if (igrejaId && event?.payload?.igrejaId && Number(event.payload.igrejaId) !== Number(igrejaId)) {
            return;
        }
        sendSseEvent(res, requestedChannel, event);
    });

    const keepAlive = setInterval(() => {
        sendSseEvent(res, 'ping', { time: new Date().toISOString() });
    }, 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        unsubscribe();
        res.end();
    });
}

module.exports = {
    streamEvents
};
