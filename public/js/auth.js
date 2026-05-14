(function () {
    async function apiFetchJson(url, options = {}) {
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            throw new Error(errorBody.error || errorBody.message || `Falha ao carregar ${url}`);
        }

        return response.json();
    }

    async function getClientePainel() {
        try {
            return await apiFetchJson('/api/cliente/painel');
        } catch (_error) {
            return null;
        }
    }

    async function getModulosLiberados() {
        const painel = await getClientePainel();
        return Array.isArray(painel?.modulos) ? painel.modulos : [];
    }

    window.apiFetchJson = apiFetchJson;
    window.getClientePainel = getClientePainel;
    window.getModulosLiberados = getModulosLiberados;
})();
