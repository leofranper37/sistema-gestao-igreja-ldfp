(function () {
    const STORAGE_KEY = 'ldfpAuth';
    const LEGACY_TOKEN_KEY = 'token';
    const originalFetch = window.fetch.bind(window);

    function keepOnlyFirst(selector) {
        const nodes = Array.from(document.querySelectorAll(selector));
        if (nodes.length <= 1) {
            return;
        }

        nodes.slice(1).forEach((node) => node.remove());
    }

    function cleanupDuplicatedLayout() {
        // Shell enterprise deve existir no maximo 1 vez.
        keepOnlyFirst('#enterpriseSidebar');
        keepOnlyFirst('aside.enterprise-sidebar');
        keepOnlyFirst('aside.legacy-shell-sidebar');
        keepOnlyFirst('.enterprise-top-header');
        keepOnlyFirst('main.enterprise-main');
        keepOnlyFirst('main.main-content');
    }

    function hasDuplicatedLayout() {
        return document.querySelectorAll('#enterpriseSidebar').length > 1
            || document.querySelectorAll('aside.enterprise-sidebar').length > 1
            || document.querySelectorAll('aside.legacy-shell-sidebar').length > 1
            || document.querySelectorAll('.enterprise-top-header').length > 1
            || document.querySelectorAll('main.enterprise-main').length > 1
            || document.querySelectorAll('main.main-content').length > 1;
    }

    function startLayoutGuard() {
        cleanupDuplicatedLayout();

        if (!document.body) {
            return;
        }

        let cleanupQueued = false;
        const observer = new MutationObserver(() => {
            if (cleanupQueued || !hasDuplicatedLayout()) {
                return;
            }

            cleanupQueued = true;
            window.requestAnimationFrame(() => {
                cleanupDuplicatedLayout();
                cleanupQueued = false;
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });

        // Em produção com cache antigo, o shell pode reinjetar layout tardiamente.
        // Mantemos uma guarda leve por mais tempo para cortar duplicações residuais.
        window.setTimeout(() => {
            observer.disconnect();
            cleanupDuplicatedLayout();
        }, 45000);
    }

    function getStoredAuth() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;

            if (parsed?.token) {
                // Mantem compatibilidade com paginas antigas que leem token direto.
                localStorage.setItem(LEGACY_TOKEN_KEY, parsed.token);
                sessionStorage.setItem(LEGACY_TOKEN_KEY, parsed.token);
                return parsed;
            }

            const legacyToken = sessionStorage.getItem(LEGACY_TOKEN_KEY) || localStorage.getItem(LEGACY_TOKEN_KEY);
            if (!legacyToken) {
                return null;
            }

            let legacyUser = null;
            try {
                legacyUser = JSON.parse(localStorage.getItem('ldfpUser') || 'null');
            } catch (ignore) {
                legacyUser = null;
            }

            return {
                token: legacyToken,
                user: legacyUser
            };
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(LEGACY_TOKEN_KEY);
            sessionStorage.removeItem(LEGACY_TOKEN_KEY);
            return null;
        }
    }

    function normalizeRole(role) {
        return String(role || '').trim().toLowerCase();
    }

    function getRoleFromToken(token) {
        try {
            if (!token || !token.includes('.')) {
                return '';
            }

            const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
            return normalizeRole(JSON.parse(atob(payload)).role);
        } catch (error) {
            return '';
        }
    }

    function getCurrentRole() {
        const auth = getStoredAuth();
        return normalizeRole(auth?.user?.role || auth?.user?.perfil || getRoleFromToken(auth?.token));
    }

    function isMemberOnlyRole(role) {
        return ['membro', 'visitante'].includes(normalizeRole(role));
    }

    function saveAuthSession(payload) {
        if (!payload || !payload.token || !payload.user) {
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            token: payload.token,
            user: payload.user
        }));

        localStorage.setItem(LEGACY_TOKEN_KEY, payload.token);
        sessionStorage.setItem(LEGACY_TOKEN_KEY, payload.token);
    }

    function clearAuthSession() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ldfpUser');
        localStorage.removeItem(LEGACY_TOKEN_KEY);
        sessionStorage.removeItem(LEGACY_TOKEN_KEY);
    }

    function getAuthToken() {
        return getStoredAuth()?.token || '';
    }

    function isSameOriginRequest(resourceUrl) {
        try {
            const url = new URL(resourceUrl, window.location.origin);
            return url.origin === window.location.origin;
        } catch (error) {
            return false;
        }
    }

    function isAuthRoute(resourceUrl) {
        return /\/login$|\/criar-conta$/i.test(resourceUrl);
    }

    function redirectToLogin() {
        if (!/\/login\.html$/i.test(window.location.pathname)) {
            window.location.href = 'login.html';
        }
    }

    function redirectToMemberApp() {
        if (!/\/app_(?:login|membro(?:_v2)?)\.html$/i.test(window.location.pathname)) {
            window.location.href = 'app_login.html';
        }
    }

    function attachLogoutHandlers() {
        document.querySelectorAll('a[href="index.html"]').forEach((anchor) => {
            if (anchor.dataset.logoutBound === 'true') {
                return;
            }

            if (!/sair/i.test(anchor.textContent || '')) {
                return;
            }

            anchor.dataset.logoutBound = 'true';
            anchor.addEventListener('click', () => {
                clearAuthSession();
            });
        });
    }

    function requireAuthSession() {
        if (!getAuthToken()) {
            redirectToLogin();
            return false;
        }

        if (isMemberOnlyRole(getCurrentRole())) {
            clearAuthSession();
            redirectToMemberApp();
            return false;
        }

        attachLogoutHandlers();
        return true;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function internalFetchWithRetry(input, init, retries = 3, delay = 1000) {
        const url = typeof input === 'string' ? input : input?.url || '';
        for (let i = 0; i < retries; i++) {
            try {
                const response = await originalFetch(input, init);
                if (response.status === 429 || response.status === 503) {
                    const retryAfter = response.headers.get('Retry-After');
                    const waitTime = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay * Math.pow(2, i);
                    console.warn(`Requisição para ${url} recebeu ${response.status}. Tentando novamente em ${waitTime / 1000}s...`);
                    await sleep(waitTime);
                    continue;
                }
                return response;
            } catch (error) {
                if (i === retries - 1) {
                    throw error;
                }
                console.error(`Erro na requisição para ${url} (tentativa ${i + 1}/${retries}):`, error);
                await sleep(delay * Math.pow(2, i));
            }
        }
        throw new Error(`Falha na requisição para ${url} após ${retries} tentativas.`);
    }

    window.fetch = async function (input, init = {}) {
        const requestUrl = typeof input === 'string' ? input : input?.url || '';
        const nextInit = { ...init };
        const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined) || undefined);
        const token = getAuthToken();

        if (token && isSameOriginRequest(requestUrl) && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`);
        }

        nextInit.headers = headers;

        // O retry e anexação do token ocorrem de forma integrada e transparente!
        const response = await internalFetchWithRetry(input, nextInit);

        if (response.status === 401 && !isAuthRoute(requestUrl)) {
            // Verifica se já estamos no login para não criar um loop
            if (!/\/login\.html$/i.test(window.location.pathname)) {
                console.error("⛔ Sessão inválida (401). Apagando Token e enviando para o Login.");
                clearAuthSession();
                redirectToLogin();
            }
        }

        return response;
    };

    // Mantemos as versões legadas que lançam erro nativamente, mas 
    // elas apenas chamam a nossa window.fetch blindada acima.
    async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
        const response = await window.fetch(url, options);
        if (!response.ok && response.status !== 401) {
            throw new Error(`Erro na rota ${url}: ${response.status} ${response.statusText}`);
        }
        return response;
    }

    async function fetchWithSessionCache(url) {
        const cacheKey = `req_cache_${url}`;
        const cachedData = sessionStorage.getItem(cacheKey);
        if (cachedData) return JSON.parse(cachedData);

        const response = await fetchWithRetry(url);
        const data = await response.json();
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        return data;
    }

    async function fetchSemCache(url) {
        const response = await fetchWithRetry(url);
        return response.json();
    }

    window.getStoredAuth = getStoredAuth;
    window.getAuthToken = getAuthToken;
    window.getCurrentRole = getCurrentRole;
    window.isMemberOnlyRole = isMemberOnlyRole;
    window.saveAuthSession = saveAuthSession;
    window.clearAuthSession = clearAuthSession;
    window.requireAuthSession = requireAuthSession;
    window.fetchWithRetry = fetchWithRetry;
    window.fetchWithSessionCache = fetchWithSessionCache;
    window.fetchSemCache = fetchSemCache;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLayoutGuard);
    } else {
        startLayoutGuard();
    }
})();
