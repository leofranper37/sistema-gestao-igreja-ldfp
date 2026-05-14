(function () {
    const STORAGE_KEY = 'ldfpAuth';
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
            return raw ? JSON.parse(raw) : null;
        } catch (error) {
            localStorage.removeItem(STORAGE_KEY);
            return null;
        }
    }

    function saveAuthSession(payload) {
        if (!payload || !payload.token || !payload.user) {
            return;
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            token: payload.token,
            user: payload.user
        }));
    }

    function clearAuthSession() {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem('ldfpUser');
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

        attachLogoutHandlers();
        return true;
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

        const response = await originalFetch(input, nextInit);

        if (response.status === 401 && !isAuthRoute(requestUrl)) {
            clearAuthSession();
            redirectToLogin();
        }

        return response;
    };

    window.getStoredAuth = getStoredAuth;
    window.saveAuthSession = saveAuthSession;
    window.clearAuthSession = clearAuthSession;
    window.requireAuthSession = requireAuthSession;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startLayoutGuard);
    } else {
        startLayoutGuard();
    }
})();