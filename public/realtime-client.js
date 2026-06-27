(function () {
    function getRealtimeToken() {
        if (typeof window.getStoredAuth !== 'function') {
            return '';
        }

        return window.getStoredAuth()?.token || '';
    }

    function subscribeRealtime(channel, onMessage, onError) {
        const token = getRealtimeToken();
        if (!token || typeof EventSource === 'undefined') {
            return null;
        }

        const source = new EventSource(`/realtime/events?channel=${encodeURIComponent(channel)}&token=${encodeURIComponent(token)}`);

        source.addEventListener(channel, (event) => {
            try {
                const payload = JSON.parse(event.data);
                onMessage?.(payload);
            } catch (error) {
                onError?.(error);
            }
        });

        source.addEventListener('connected', () => {});
        source.addEventListener('ping', () => {});

        source.onerror = function (error) {
            onError?.(error);
        };

        return source;
    }

    window.subscribeRealtime = subscribeRealtime;
})();
