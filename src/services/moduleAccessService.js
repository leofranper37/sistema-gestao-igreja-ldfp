const { pool } = require('../config/db');

function toBool(value) {
    return Number(value) === 1 || value === true;
}

function normalizeSlug(value) {
    return String(value || '').trim().toLowerCase();
}

function normalizeIcon(value) {
    return String(value || '')
        .trim()
        .replace(/^fa-solid\s+/i, '')
        .replace(/^fa-brands\s+/i, '')
        .replace(/^fa-regular\s+/i, '')
        .replace(/^fa-/i, '') || 'puzzle-piece';
}

async function listCatalog(activeOnly = false) {
    const where = activeOnly ? 'WHERE ativo = 1' : '';
    const [rows] = await pool.query(
        `SELECT id, slug, nome, descricao, icon, feature_key, route_path, ativo, created_at, updated_at
         FROM saas_modulos
         ${where}
         ORDER BY nome ASC`
    );

    return (rows || []).map((row) => ({
        ...row,
        ativo: toBool(row.ativo)
    }));
}

async function createModule(payload) {
    const slug = normalizeSlug(payload.slug);
    const nome = String(payload.nome || '').trim();
    const descricao = String(payload.descricao || '').trim();
    const featureKey = String(payload.feature_key || '').trim();
    const icon = normalizeIcon(payload.icon);
    const routePath = String(payload.route_path || '').trim() || null;

    if (!slug || !nome || !featureKey) {
        throw new Error('Campos obrigatórios: slug, nome e feature_key.');
    }

    await pool.query(
        `INSERT INTO saas_modulos (slug, nome, descricao, icon, feature_key, route_path, ativo, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [slug, nome, descricao || null, icon, featureKey, routePath]
    );

    return getModuleBySlug(slug);
}

async function updateModule(slugInput, payload) {
    const slug = normalizeSlug(slugInput);
    const fields = [];
    const values = [];

    const set = (column, value) => {
        if (value !== undefined) {
            fields.push(`${column} = ?`);
            values.push(value);
        }
    };

    if (payload.slug !== undefined) {
        set('slug', normalizeSlug(payload.slug));
    }
    if (payload.nome !== undefined) {
        set('nome', String(payload.nome || '').trim());
    }
    if (payload.descricao !== undefined) {
        set('descricao', String(payload.descricao || '').trim() || null);
    }
    if (payload.icon !== undefined) {
        set('icon', normalizeIcon(payload.icon));
    }
    if (payload.feature_key !== undefined) {
        set('feature_key', String(payload.feature_key || '').trim());
    }
    if (payload.route_path !== undefined) {
        set('route_path', String(payload.route_path || '').trim() || null);
    }
    if (payload.ativo !== undefined) {
        set('ativo', payload.ativo ? 1 : 0);
    }

    if (!fields.length) {
        throw new Error('Nenhum campo para atualizar.');
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(slug);

    await pool.query(`UPDATE saas_modulos SET ${fields.join(', ')} WHERE slug = ?`, values);

    const nextSlug = payload.slug !== undefined ? normalizeSlug(payload.slug) : slug;
    return getModuleBySlug(nextSlug);
}

async function getModuleBySlug(slugInput) {
    const slug = normalizeSlug(slugInput);
    const [rows] = await pool.query(
        `SELECT id, slug, nome, descricao, icon, feature_key, route_path, ativo, created_at, updated_at
         FROM saas_modulos
         WHERE slug = ?
         LIMIT 1`,
        [slug]
    );

    const found = rows?.[0];
    if (!found) {
        return null;
    }

    return {
        ...found,
        ativo: toBool(found.ativo)
    };
}

async function getPlanModuleMap(planSlugInput) {
    const planSlug = normalizeSlug(planSlugInput);
    const [rows] = await pool.query(
        `SELECT modulo_slug, ativo
         FROM saas_plano_modulos
         WHERE plano_slug = ?`,
        [planSlug]
    );

    const map = new Map();
    (rows || []).forEach((row) => {
        map.set(normalizeSlug(row.modulo_slug), toBool(row.ativo));
    });

    return map;
}

async function getChurchOverrideMap(churchId) {
    const [rows] = await pool.query(
        `SELECT modulo_slug, ativo
         FROM igreja_modulos
         WHERE igreja_id = ?`,
        [Number(churchId)]
    );

    const map = new Map();
    (rows || []).forEach((row) => {
        map.set(normalizeSlug(row.modulo_slug), toBool(row.ativo));
    });

    return map;
}

async function getPlanModules(planSlugInput) {
    const planSlug = normalizeSlug(planSlugInput);
    const catalog = await listCatalog(false);
    const planMap = await getPlanModuleMap(planSlug);

    return catalog.map((module) => ({
        ...module,
        plano_slug: planSlug,
        enabled: planMap.get(module.slug) === true
    }));
}

async function replacePlanModules(planSlugInput, modules = []) {
    const planSlug = normalizeSlug(planSlugInput);
    const normalized = Array.isArray(modules)
        ? modules.map((entry) => ({
            modulo_slug: normalizeSlug(entry.modulo_slug || entry.slug),
            ativo: entry.ativo ? 1 : 0
        })).filter((entry) => entry.modulo_slug)
        : [];

    await pool.query(`DELETE FROM saas_plano_modulos WHERE plano_slug = ?`, [planSlug]);

    for (const entry of normalized) {
        await pool.query(
            `INSERT INTO saas_plano_modulos (plano_slug, modulo_slug, ativo, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [planSlug, entry.modulo_slug, entry.ativo]
        );
    }

    return getPlanModules(planSlug);
}

async function getChurchModules(churchId, planSlugInput) {
    const igrejaId = Number(churchId);
    const planSlug = normalizeSlug(planSlugInput);
    const catalog = await listCatalog(false);
    const planMap = await getPlanModuleMap(planSlug);
    const overrideMap = await getChurchOverrideMap(igrejaId);

    return catalog.map((module) => {
        const planEnabled = planMap.get(module.slug) === true;
        const hasOverride = overrideMap.has(module.slug);
        const overrideEnabled = hasOverride ? overrideMap.get(module.slug) === true : null;
        const effectiveEnabled = hasOverride ? overrideEnabled : planEnabled;

        return {
            ...module,
            igreja_id: igrejaId,
            plano_slug: planSlug,
            plan_enabled: planEnabled,
            override_enabled: overrideEnabled,
            effective_enabled: !!effectiveEnabled
        };
    });
}

async function replaceChurchOverrides(churchId, modules = []) {
    const igrejaId = Number(churchId);
    const normalized = Array.isArray(modules)
        ? modules.map((entry) => {
            const slug = normalizeSlug(entry.modulo_slug || entry.slug);
            const mode = String(entry.mode || '').trim().toLowerCase();
            if (!slug) return null;

            if (mode === 'inherit') {
                return { modulo_slug: slug, ativo: null };
            }

            if (entry.ativo === null || entry.ativo === undefined) {
                return { modulo_slug: slug, ativo: null };
            }

            return { modulo_slug: slug, ativo: entry.ativo ? 1 : 0 };
        }).filter(Boolean)
        : [];

    await pool.query(`DELETE FROM igreja_modulos WHERE igreja_id = ?`, [igrejaId]);

    for (const entry of normalized) {
        if (entry.ativo === null) {
            continue;
        }

        await pool.query(
            `INSERT INTO igreja_modulos (igreja_id, modulo_slug, ativo, updated_at)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [igrejaId, entry.modulo_slug, entry.ativo]
        );
    }

    const [churchRows] = await pool.query(`SELECT plano FROM igrejas WHERE id = ? LIMIT 1`, [igrejaId]);
    const planSlug = normalizeSlug(churchRows?.[0]?.plano || 'eden');
    return getChurchModules(igrejaId, planSlug);
}

async function getEffectiveAccessForChurch(churchId, planSlugInput) {
    const modules = await getChurchModules(churchId, planSlugInput);
    const enabledModules = modules.filter((entry) => entry.effective_enabled);

    return {
        modules: enabledModules,
        featureKeys: enabledModules.map((entry) => entry.feature_key).filter(Boolean)
    };
}

module.exports = {
    createModule,
    getChurchModules,
    getEffectiveAccessForChurch,
    getModuleBySlug,
    getPlanModules,
    listCatalog,
    replaceChurchOverrides,
    replacePlanModules,
    updateModule
};
