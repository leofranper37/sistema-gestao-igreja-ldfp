const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

function buildChannelEvent(channel, payload = {}) {
    return {
        channel,
        payload,
        timestamp: new Date().toISOString()
    };
}

function publish(channel, payload = {}) {
    const event = buildChannelEvent(channel, payload);
    emitter.emit('broadcast', event);
    emitter.emit(`channel:${channel}`, event);
    return event;
}

function subscribe(channel, handler) {
    const eventName = channel ? `channel:${channel}` : 'broadcast';
    emitter.on(eventName, handler);
    return () => emitter.off(eventName, handler);
}

module.exports = {
    publish,
    subscribe
};
