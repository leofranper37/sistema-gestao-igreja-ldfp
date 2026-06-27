(function initSpeedInsights() {
    if (window.__ldfpSpeedInsightsLoaded) {
        return;
    }

    window.__ldfpSpeedInsightsLoaded = true;

    var host = (window.location && window.location.hostname ? window.location.hostname : '').toLowerCase();
    var isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');
    var isVercelPreview = host.endsWith('.vercel.app');

    if (!isLocal && !isVercelPreview) {
        return;
    }

    // Queue calls until the remote SDK is ready.
    window.si = window.si || function siQueue() {
        (window.siq = window.siq || []).push(arguments);
    };

    var script = document.createElement('script');
    script.defer = true;
    script.src = isLocal
        ? 'https://va.vercel-scripts.com/v1/speed-insights/script.debug.js'
        : '/_vercel/speed-insights/script.js';

    if (isLocal) {
        script.setAttribute('data-debug', '1');
    }

    script.onerror = function onSpeedInsightsError() {
        if (window.console && typeof window.console.warn === 'function') {
            window.console.warn('Speed Insights: nao foi possivel carregar o script.');
        }
    };

    document.head.appendChild(script);
})();
