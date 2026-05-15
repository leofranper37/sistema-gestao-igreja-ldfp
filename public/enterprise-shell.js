(function () {
    const SHELL_INITIALIZED_KEY = '__ldfpShellInitialized';
    const SHELL_INITIALIZING_KEY = '__ldfpShellInitializing';

    function keepOnlyFirst(selector) {
        const nodes = Array.from(document.querySelectorAll(selector));
        if (nodes.length <= 1) {
            return;
        }

        nodes.slice(1).forEach((node) => node.remove());
    }

    function cleanupShellDuplicates() {
        keepOnlyFirst('#enterpriseSidebar');
        keepOnlyFirst('aside.enterprise-sidebar');
        keepOnlyFirst('aside.legacy-shell-sidebar');
        keepOnlyFirst('.enterprise-top-header');
        keepOnlyFirst('main.enterprise-main');
        keepOnlyFirst('main.main-content');
    }

    const ROLE_FEATURES = {
        super_admin: ['dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda', 'missionarios', 'igrejas', 'financeiro', 'cargos', 'midia', 'configuracoes', 'whatsapp', 'autocadastro', 'portaria_qr', 'pagamentos', 'app_midia', 'telao', 'planos'],
        admin: ['dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda', 'missionarios', 'igrejas', 'financeiro', 'cargos', 'midia', 'configuracoes', 'whatsapp', 'autocadastro', 'portaria_qr', 'pagamentos', 'app_midia', 'telao'],
        secretaria: ['dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda', 'missionarios', 'igrejas', 'financeiro', 'cargos', 'midia', 'whatsapp', 'autocadastro', 'portaria_qr', 'pagamentos', 'app_midia', 'telao'],
        pastor: ['dashboard', 'membros', 'visitantes', 'criancas', 'oracoes', 'agenda', 'missionarios', 'igrejas', 'cargos', 'whatsapp', 'autocadastro', 'app_midia', 'telao'],
        oficial: ['membros', 'visitantes', 'agenda', 'oracoes', 'portaria_qr'],
        ministerio: ['membros', 'oracoes', 'agenda', 'criancas'],
        midia: ['agenda', 'membros', 'midia', 'app_midia', 'telao'],
        membro: ['oracoes', 'agenda'],
        visitante: ['oracoes', 'agenda']
    };

    const ROLE_ALIASES = {
        'super_admin': 'super_admin',
        superadmin: 'super_admin',
        'super-administrador': 'super_admin',
        'super administrador': 'super_admin',
        administrador: 'admin',
        adm: 'admin',
        tesouraria: 'financeiro',
        financeiro: 'financeiro',
        secretaria: 'secretaria',
        pastor: 'pastor',
        oficial: 'oficial',
        ministerio: 'ministerio',
        midia: 'midia',
        membro: 'membro',
        visitante: 'visitante'
    };

    const PAGE_FEATURES = {
        'dashboard.html': 'dashboard',
        'membros.html': 'membros',
        'cadastro.html': 'membros',
        'cargos.html': 'cargos',
        'situacoes.html': 'membros',
        'congregacoes.html': 'membros',
        'historico_pastoral.html': 'membros',
        'tipos_historico.html': 'membros',
        'grupos.html': 'membros',
        'grupo_novo.html': 'membros',
        'grupos_categorias.html': 'membros',
        'grupos_reunioes.html': 'membros',
        'escalas.html': 'agenda',
        'ebd_alunos.html': 'criancas',
        'ebd_turmas.html': 'criancas',
        'ebd_grades.html': 'criancas',
        'batismos.html': 'membros',
        'batismo_novo.html': 'membros',
        'batismos_inscricoes.html': 'membros',
        'lista_membros.html': 'membros',
        'agenda.html': 'agenda',
        'outras_igrejas.html': 'igrejas',
        'missionarios.html': 'missionarios',
        'visitantes.html': 'visitantes',
        'congregados.html': 'membros',
        'criancas.html': 'criancas',
        'oracoes.html': 'oracoes',
        'comunicacao_whatsapp.html': 'whatsapp',
        'autocadastro_aprovacoes.html': 'autocadastro',
        'portaria_checkin.html': 'portaria_qr',
        'app_midia.html': 'app_midia',
        'telao_visitantes.html': 'telao',
        'financeiro.html': 'financeiro',
        'dizimos.html': 'financeiro',
        'tesouraria_dizimos.html': 'financeiro',
        'dizimos_lancamentos.html': 'financeiro',
        'dizimos_tipos_receita.html': 'financeiro',
        'tesouraria_caixa.html': 'financeiro',
        'caixa_lancamentos.html': 'financeiro',
        'caixa_ativar_mes.html': 'financeiro',
        'caixa_saldo_inicial.html': 'financeiro',
        'bancos_lancamentos.html': 'financeiro',
        'banco.html': 'financeiro',
        'tesouraria_bancos.html': 'financeiro',
        'importacao_extrato.html': 'financeiro',
        'pagamentos.html': 'pagamentos',
        'contas_pagar.html': 'financeiro',
        'recibo.html': 'financeiro',
        'transferencias.html': 'financeiro',
        'plano_contas.html': 'financeiro',
        'balancete_abertura.html': 'financeiro',
        'lancamentos_contabeis.html': 'financeiro',
        'encerramento_exercicio.html': 'financeiro',
        'graficos_secretaria.html': 'financeiro',
        'graficos_tesouraria.html': 'financeiro',
        'relatorios_secretaria.html': 'financeiro',
        'relatorios_tesouraria.html': 'financeiro',
        'relatorios_contabilidade.html': 'financeiro',
        'configuracoes.html': 'configuracoes',
        'planos_lista.html': 'planos',
        'planos_editar.html': 'planos',
        'app_membro.html': 'app_membro',
        'dashboard_membro.html': 'app_membro'
    };

    let dynamicFeatureAllowList = null;

    const FEATURE_KEY_ALIASES = {
        ebd: 'criancas',
        ebd_dominical: 'criancas',
        credencial_membro: 'app_membro',
        credencial: 'app_membro',
        congregacoes: 'igrejas',
        outras_igrejas: 'igrejas',
        portaria: 'portaria_qr',
        app_midia: 'app_midia',
        app_membro: 'app_membro',
        relatorios: 'financeiro',
        grupos: 'membros',
        grupos_celulas: 'membros'
    };

    function normalizeFeatureKey(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) {
            return '';
        }

        return FEATURE_KEY_ALIASES[raw] || raw;
    }

    function normalizeFeatureAllowList(featureKeys) {
        if (!Array.isArray(featureKeys)) {
            return null;
        }

        const normalized = featureKeys
            .map((key) => normalizeFeatureKey(key))
            .filter(Boolean);

        return normalized.length ? Array.from(new Set(normalized)) : null;
    }

    function getAuthUser() {
        if (typeof window.getStoredAuth !== 'function') {
            return null;
        }

        return window.getStoredAuth()?.user || null;
    }

    function getUserLabel(user) {
        return user?.name || user?.nome || user?.email || 'Leonardo';
    }

    function getUserRole(user) {
        const rawRole = String(user?.role || user?.perfil || '').trim().toLowerCase();
        return ROLE_ALIASES[rawRole] || rawRole || 'visitante';
    }

    function getRoleVisibleFeatures(user) {
        const role = getUserRole(user);
        const roleFeatures = ROLE_FEATURES[role];

        if (roleFeatures) {
            return roleFeatures;
        }

        // Keep authenticated users productive even if backend sends a custom role label.
        if (user) {
            return ROLE_FEATURES.admin;
        }

        return ROLE_FEATURES.visitante;
    }

    function getEnabledFeatures(user) {
        const roleFeatures = getRoleVisibleFeatures(user);

        if (Array.isArray(dynamicFeatureAllowList)) {
            return roleFeatures.filter((feature) => dynamicFeatureAllowList.includes(feature));
        }

        return roleFeatures;
    }

    function normalizeLinkItem(item) {
        if (Array.isArray(item)) {
            const [href, icon, label, feature] = item;
            return { href, icon, label, feature };
        }

        return item || {};
    }

    function canUseFeature(user, feature) {
        if (!feature) {
            return true;
        }

        return getEnabledFeatures(user).includes(feature);
    }

    function canDisplayFeature(user, feature) {
        if (!feature) {
            return true;
        }

        return getRoleVisibleFeatures(user).includes(feature);
    }

    function filterLinksByRole(links, user) {
        return links
            .map(normalizeLinkItem)
            .filter((item) => canDisplayFeature(user, item.feature));
    }

    function renderMenuLink(item, activePath, user) {
        const href = item.href;
        const label = item.label || '';
        const feature = item.feature || '';
        const isLocked = feature ? !canUseFeature(user, feature) : false;
        const activeClass = isLinkActive(href, activePath) ? 'active-link' : '';
        const lockClass = isLocked ? 'menu-link-locked' : '';
        const classes = [activeClass, lockClass].filter(Boolean).join(' ');
        const safeHref = isLocked ? '#' : href;
        const dataFeature = feature ? `data-feature="${feature}"` : '';
        const lockIcon = isLocked ? '<i class="fa-solid fa-lock menu-link-lock" aria-hidden="true"></i>' : '';

        return `<a href="${safeHref}" class="${classes}" data-href="${href}" data-label="${label}" ${dataFeature} ${isLocked ? 'data-locked="true"' : ''}><i class="${item.icon}"></i><span>${label}</span>${lockIcon}</a>`;
    }

    function ensureLockStyles() {
        if (document.getElementById('ldfp-shell-lock-styles')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'ldfp-shell-lock-styles';
        style.textContent = `
            .menu-link-locked {
                opacity: .58;
                cursor: not-allowed;
            }

            .menu-link-locked:hover {
                transform: none;
            }

            .menu-link-lock {
                margin-left: auto;
                font-size: .72rem;
                color: #f59e0b;
            }

            .ldfp-upgrade-modal {
                position: fixed;
                inset: 0;
                background: rgba(2, 6, 23, .7);
                display: none;
                align-items: center;
                justify-content: center;
                z-index: 9999;
                padding: 20px;
            }

            .ldfp-upgrade-modal.is-open {
                display: flex;
            }

            .ldfp-upgrade-card {
                width: min(520px, 100%);
                background: #ffffff;
                border-radius: 14px;
                border: 1px solid #e5e7eb;
                box-shadow: 0 25px 50px rgba(2, 6, 23, .25);
                overflow: hidden;
            }

            .ldfp-upgrade-head {
                background: linear-gradient(135deg, #0f172a, #1e293b);
                color: #f8fafc;
                padding: 14px 18px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
            }

            .ldfp-upgrade-head h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 700;
            }

            .ldfp-upgrade-close {
                border: 0;
                background: transparent;
                color: #f8fafc;
                font-size: 18px;
                line-height: 1;
                cursor: pointer;
            }

            .ldfp-upgrade-body {
                padding: 18px;
                color: #0f172a;
                font-size: 14px;
                line-height: 1.55;
            }

            .ldfp-upgrade-resource {
                font-weight: 700;
                color: #b45309;
            }

            .ldfp-upgrade-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                margin-top: 16px;
            }

            .ldfp-upgrade-btn {
                border: 1px solid #cbd5e1;
                background: #f8fafc;
                color: #0f172a;
                padding: 9px 14px;
                border-radius: 9px;
                font-weight: 600;
                text-decoration: none;
                cursor: pointer;
            }

            .ldfp-upgrade-btn.primary {
                background: #f59e0b;
                color: #111827;
                border-color: #f59e0b;
            }
        `;

        document.head.appendChild(style);
    }

    function ensureUpgradeModal() {
        if (document.getElementById('ldfpUpgradeModal')) {
            return;
        }

        const modal = document.createElement('div');
        modal.id = 'ldfpUpgradeModal';
        modal.className = 'ldfp-upgrade-modal';
        modal.innerHTML = `
            <div class="ldfp-upgrade-card" role="dialog" aria-modal="true" aria-labelledby="ldfpUpgradeTitle">
                <div class="ldfp-upgrade-head">
                    <h3 id="ldfpUpgradeTitle">Recurso indisponível no plano atual</h3>
                    <button type="button" class="ldfp-upgrade-close" data-upgrade-close="true" aria-label="Fechar">&times;</button>
                </div>
                <div class="ldfp-upgrade-body">
                    <p><span class="ldfp-upgrade-resource" id="ldfpUpgradeResource">Este módulo</span> não está incluído no plano da sua igreja.</p>
                    <p>Solicite ativação no painel administrativo ou faça upgrade para liberar este recurso.</p>
                    <div class="ldfp-upgrade-actions">
                        <a href="assinar.html" class="ldfp-upgrade-btn primary" id="ldfpUpgradePlansLink">Ver planos</a>
                        <a href="mailto:contato@ldfp.com.br?subject=Upgrade%20de%20plano%20-%20LDFP" class="ldfp-upgrade-btn">Falar com suporte</a>
                        <button type="button" class="ldfp-upgrade-btn" data-upgrade-close="true">Fechar</button>
                    </div>
                </div>
            </div>
        `;

        modal.addEventListener('click', (event) => {
            const closeRequested = event.target === modal || event.target?.dataset?.upgradeClose === 'true';
            if (closeRequested) {
                modal.classList.remove('is-open');
            }
        });

        document.body.appendChild(modal);
    }

    function getSuggestedPlanByFeature(feature) {
        const featurePlanMap = {
            whatsapp: 'hebrom',
            autocadastro: 'betel',
            portaria_qr: 'betel',
            app_midia: 'betel',
            telao: 'siao',
            missionarios: 'siao',
            igrejas: 'siao',
            pagamentos: 'betel',
            financeiro: 'betel'
        };

        return featurePlanMap[String(feature || '').trim()] || 'betel';
    }

    function openUpgradeModal(resourceName, feature) {
        const modal = document.getElementById('ldfpUpgradeModal');
        if (!modal) {
            return;
        }

        const target = modal.querySelector('#ldfpUpgradeResource');
        if (target) {
            target.textContent = resourceName || 'Este módulo';
        }

        const plansLink = modal.querySelector('#ldfpUpgradePlansLink');
        if (plansLink) {
            const suggestedPlan = getSuggestedPlanByFeature(feature);
            const query = new URLSearchParams({
                origem: 'menu_bloqueado',
                feature: String(feature || '').trim(),
                feature_nome: resourceName || 'modulo',
                plano: suggestedPlan
            });
            plansLink.href = `assinar.html?${query.toString()}`;
        }

        modal.classList.add('is-open');
    }

    function showLockedFeatureMessage(anchor) {
        const feature = String(anchor?.dataset?.feature || '').trim();
        const label = String(anchor?.dataset?.label || 'Este módulo').trim();
        const featureLabelMap = {
            whatsapp: 'Módulo de WhatsApp',
            autocadastro: 'Aprovação de Cadastro',
            portaria_qr: 'Portaria QR',
            telao: 'Telão',
            igrejas: 'Congregações e Outras Igrejas',
            missionarios: 'Missionários',
            app_midia: 'App de Mídia',
            pagamentos: 'Links de Pagamento',
            financeiro: 'Módulo Financeiro'
        };

        const resourceName = featureLabelMap[feature] || label;
        openUpgradeModal(resourceName, feature);
    }

    function normalizePath(href) {
        const raw = String(href || '').trim();
        if (!raw) {
            return '';
        }

        try {
            const url = new URL(raw, window.location.origin + window.location.pathname);
            const fileName = url.pathname.split('/').pop() || '';
            return `${fileName}${url.search}`;
        } catch (_error) {
            return raw.replace(/^\.\//, '');
        }
    }

    function isLinkActive(href, activePath) {
        return normalizePath(href) === normalizePath(activePath);
    }

    function renderLegacyGroup(title, icon, links, activePath, openByDefault = false, user = null) {
        const allowedLinks = filterLinksByRole(links, user);
        if (!allowedLinks.length) {
            return '';
        }

        const hasActiveLink = allowedLinks.some(({ href }) => isLinkActive(href, activePath));
        const buttonClass = hasActiveLink ? 'dropdown-btn active' : 'dropdown-btn';
        const displayStyle = hasActiveLink || openByDefault ? 'display: block;' : 'display: none;';

        const linksHtml = allowedLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        return `
            <button class="${buttonClass}" type="button">
                <span><i class="${icon} icon-left"></i> ${title}</span>
                <i class="fa-solid fa-chevron-right arrow"></i>
            </button>
            <div class="dropdown-container" style="${displayStyle}">
                ${linksHtml}
            </div>
        `;
    }

    function renderSecretariaGroup(activePath, user) {
        const membrosLinks = [
            ['lista_membros.html', 'fa-solid fa-address-book', 'Lista de Membros', 'membros'],
            ['membros.html', 'fa-solid fa-user-plus', 'Cadastrar Novo Membro', 'membros'],
            ['cargos.html', 'fa-solid fa-briefcase', 'Cargos', 'cargos'],
            ['situacoes.html', 'fa-solid fa-toggle-on', 'Situações', 'membros'],
            ['congregacoes.html', 'fa-solid fa-church', 'Congregações', 'membros']
        ];

        const historicoLinks = [
            ['historico_pastoral.html', 'fa-solid fa-book-bible', 'Histórico Pastoral', 'membros'],
            ['tipos_historico.html', 'fa-solid fa-list-check', 'Tipo de Histórico', 'membros']
        ];

        const grupoLinks = [
            ['grupos.html', 'fa-solid fa-people-group', 'Grupos', 'membros']
        ];

        const escalaLinks = [
            ['escalas.html?tab=eventos', 'fa-regular fa-calendar', 'Eventos', 'agenda'],
            ['escalas.html?tab=dashboard', 'fa-solid fa-clipboard-list', 'Gestão de Escalas', 'agenda'],
            ['escalas.html?tab=matriz', 'fa-solid fa-calendar-days', 'Escala Mensal', 'agenda']
        ];

        const ebdLinks = [
            ['ebd_alunos.html', 'fa-solid fa-child-reaching', 'Alunos', 'criancas'],
            ['ebd_turmas.html', 'fa-solid fa-users-line', 'Turmas & Revistas', 'criancas'],
            ['ebd_grades.html', 'fa-solid fa-calendar-days', 'Grades & Presença', 'criancas']
        ];

        const batismoLinks = [
            ['batismos.html', 'fa-solid fa-water', 'Batismos', 'membros'],
            ['batismo_novo.html', 'fa-solid fa-plus', 'Cadastrar', 'membros'],
            ['batismos_inscricoes.html', 'fa-solid fa-clipboard-check', 'Inscrições', 'membros']
        ];

        const otherLinks = [
            ['agenda.html', 'fa-solid fa-calendar-days', 'Agenda', 'agenda'],
            ['outras_igrejas.html', 'fa-solid fa-globe', 'Outras Igrejas', 'igrejas'],
            ['missionarios.html', 'fa-solid fa-person-rays', 'Missionários', 'missionarios'],
            ['visitantes.html', 'fa-solid fa-user-plus', 'Visitantes', 'visitantes'],
            ['congregados.html', 'fa-solid fa-people-arrows-left-right', 'Congregados', 'membros'],
            ['criancas.html', 'fa-solid fa-child-reaching', 'Crianças', 'criancas'],
            ['oracoes.html', 'fa-solid fa-hands-praying', 'Orações', 'oracoes'],
            ['comunicacao_whatsapp.html', 'fa-brands fa-whatsapp', 'WhatsApp', 'whatsapp'],
            ['autocadastro_aprovacoes.html', 'fa-solid fa-user-check', 'Aprovação de Cadastro', 'autocadastro'],
            ['portaria_checkin.html', 'fa-solid fa-qrcode', 'Portaria QR', 'portaria_qr'],
            ['app_midia.html', 'fa-solid fa-tv', 'App Midia', 'app_midia'],
            ['telao_visitantes.html', 'fa-solid fa-display', 'Telão', 'telao']
        ];

        const allowedMembrosLinks = filterLinksByRole(membrosLinks, user);
        const allowedHistoricoLinks = filterLinksByRole(historicoLinks, user);
        const allowedGrupoLinks = filterLinksByRole(grupoLinks, user);
        const allowedEscalaLinks = filterLinksByRole(escalaLinks, user);
        const allowedEbdLinks = filterLinksByRole(ebdLinks, user);
        const allowedBatismoLinks = filterLinksByRole(batismoLinks, user);
        const allowedOtherLinks = filterLinksByRole(otherLinks, user);

        const allLinks = [
            ...allowedMembrosLinks,
            ...allowedHistoricoLinks,
            ...allowedGrupoLinks,
            ...allowedEscalaLinks,
            ...allowedEbdLinks,
            ...allowedBatismoLinks,
            ...allowedOtherLinks
        ];

        if (!allLinks.length) {
            return '';
        }

        const secretariaHasActive = allLinks.some(({ href }) => isLinkActive(href, activePath));
        const membrosActive = allowedMembrosLinks.some(({ href }) => isLinkActive(href, activePath));
        const historicoActive = allowedHistoricoLinks.some(({ href }) => isLinkActive(href, activePath));
        const grupoActive = allowedGrupoLinks.some(({ href }) => isLinkActive(href, activePath));
        const escalaActive = allowedEscalaLinks.some(({ href }) => isLinkActive(href, activePath));
        const ebdActive = allowedEbdLinks.some(({ href }) => isLinkActive(href, activePath));
        const batismoActive = allowedBatismoLinks.some(({ href }) => isLinkActive(href, activePath));

        const membrosHtml = allowedMembrosLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const historicoHtml = allowedHistoricoLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const grupoHtml = allowedGrupoLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const escalaHtml = allowedEscalaLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const ebdHtml = allowedEbdLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const batismoHtml = allowedBatismoLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const otherHtml = allowedOtherLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        return `
            <button class="dropdown-btn ${secretariaHasActive ? 'active' : ''}" type="button">
                <span><i class="fa-solid fa-folder-open icon-left"></i> Secretaria</span>
                <i class="fa-solid fa-chevron-right arrow"></i>
            </button>
            <div class="dropdown-container" style="${secretariaHasActive ? 'display: block;' : 'display: none;'}">
                ${allowedMembrosLinks.length ? `<button class="sub-dropdown-btn ${membrosActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-users icon-left"></i> Membros</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${membrosActive ? 'display: block;' : 'display: none;'}">
                    ${membrosHtml}
                </div>` : ''}

                ${allowedHistoricoLinks.length ? `<button class="sub-dropdown-btn ${historicoActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-book-bible icon-left"></i> Histórico Pastoral</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${historicoActive ? 'display: block;' : 'display: none;'}">
                    ${historicoHtml}
                </div>` : ''}

                ${allowedGrupoLinks.length ? `<button class="sub-dropdown-btn ${grupoActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-people-group icon-left"></i> Grupos</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${grupoActive ? 'display: block;' : 'display: none;'}">
                    ${grupoHtml}
                </div>` : ''}

                ${allowedEscalaLinks.length ? `<button class="sub-dropdown-btn ${escalaActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-calendar-check icon-left"></i> Escalas</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${escalaActive ? 'display: block;' : 'display: none;'}">
                    ${escalaHtml}
                </div>` : ''}

                ${allowedEbdLinks.length ? `<button class="sub-dropdown-btn ${ebdActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-graduation-cap icon-left"></i> EBD</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${ebdActive ? 'display: block;' : 'display: none;'}">
                    ${ebdHtml}
                </div>` : ''}

                ${allowedBatismoLinks.length ? `<button class="sub-dropdown-btn ${batismoActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-water icon-left"></i> Batismos</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${batismoActive ? 'display: block;' : 'display: none;'}">
                    ${batismoHtml}
                </div>` : ''}

                ${otherHtml}
            </div>
        `;
    }

    function renderTesourariaGroup(activePath, user) {
        const dizimosLinks = [
            ['tesouraria_dizimos.html', 'fa-solid fa-coins', 'Dízimos', 'financeiro']
        ];

        const caixaLinks = [
            ['tesouraria_caixa.html', 'fa-solid fa-cash-register', 'Caixa', 'financeiro'],
            ['caixa_ativar_mes.html', 'fa-solid fa-circle-dollar-to-slot', 'Ativar Mês / Saldo Inicial', 'financeiro']
        ];

        const bancosLinks = [
            ['tesouraria_bancos.html', 'fa-solid fa-building-columns', 'Bancos', 'financeiro'],
            ['bancos_lancamentos.html', 'fa-solid fa-file-invoice-dollar', 'Lançamentos Bancários', 'financeiro'],
            ['importacao_extrato.html', 'fa-solid fa-file-import', 'Importar Extrato', 'financeiro']
        ];

        const otherLinks = [
            ['pagamentos.html', 'fa-solid fa-link', 'Links de Pagamento', 'pagamentos'],
            ['contas_pagar.html', 'fa-solid fa-file-invoice-dollar', 'Contas a Pagar', 'financeiro'],
            ['recibo.html', 'fa-solid fa-receipt', 'Recibos', 'financeiro'],
            ['transferencias.html', 'fa-solid fa-right-left', 'Transferências', 'financeiro']
        ];

        const allowedDizimosLinks = filterLinksByRole(dizimosLinks, user);
        const allowedCaixaLinks = filterLinksByRole(caixaLinks, user);
        const allowedBancosLinks = filterLinksByRole(bancosLinks, user);
        const allowedOtherLinks = filterLinksByRole(otherLinks, user);

        if (!allowedDizimosLinks.length && !allowedCaixaLinks.length && !allowedBancosLinks.length && !allowedOtherLinks.length) {
            return '';
        }

        const dizimosActive = allowedDizimosLinks.some(({ href }) => isLinkActive(href, activePath));
        const caixaActive = allowedCaixaLinks.some(({ href }) => isLinkActive(href, activePath));
        const bancosActive = allowedBancosLinks.some(({ href }) => isLinkActive(href, activePath));
        const tesourariaActive = dizimosActive || caixaActive || bancosActive || allowedOtherLinks.some(({ href }) => isLinkActive(href, activePath));
        const tesourariaDisplay = tesourariaActive ? 'display: block;' : 'display: none;';

        const dizimosHtml = allowedDizimosLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const caixaHtml = allowedCaixaLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const bancosHtml = allowedBancosLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        const otherHtml = allowedOtherLinks.map((item) => renderMenuLink(item, activePath, user)).join('');

        return `
            <button class="dropdown-btn ${tesourariaActive ? 'active' : ''}" type="button">
                <span><i class="fa-solid fa-money-bill-1 icon-left"></i> Tesouraria</span>
                <i class="fa-solid fa-chevron-right arrow"></i>
            </button>
            <div class="dropdown-container" style="${tesourariaDisplay}">
                ${allowedDizimosLinks.length ? `<button class="sub-dropdown-btn ${dizimosActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-coins icon-left"></i> Dízimos & Ofertas</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${dizimosActive ? 'display: block;' : 'display: none;'}">
                    ${dizimosHtml}
                </div>` : ''}

                ${allowedCaixaLinks.length ? `<button class="sub-dropdown-btn ${caixaActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-cash-register icon-left"></i> Caixa</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${caixaActive ? 'display: block;' : 'display: none;'}">
                    ${caixaHtml}
                </div>` : ''}

                ${allowedBancosLinks.length ? `<button class="sub-dropdown-btn ${bancosActive ? 'active' : ''}" type="button">
                    <span><i class="fa-solid fa-building-columns icon-left"></i> Bancos</span>
                    <i class="fa-solid fa-chevron-right arrow"></i>
                </button>
                <div class="sub-dropdown-container" style="${bancosActive ? 'display: block;' : 'display: none;'}">
                    ${bancosHtml}
                </div>` : ''}

                ${otherHtml}
            </div>
        `;
    }

    function renderSidebar(activePath, user) {
        return `
            <aside class="sidebar enterprise-sidebar legacy-shell-sidebar" id="enterpriseSidebar">
                <div class="sidebar-profile">
                    <div class="profile-avatar"><i class="fa-solid fa-user"></i></div>
                    <div class="profile-info">
                        <h4 id="sidebarUserName">LEONARDO FRANCISCO PEREIRA</h4>
                        <span>Online</span>
                    </div>
                </div>

                <nav class="menu">
                    ${renderLegacyGroup('Menu LDFP', 'fa-solid fa-house', [
                        ['dashboard.html', 'fa-regular fa-eye', 'Visão Geral', 'dashboard'],
                        ['app_membro.html', 'fa-solid fa-mobile-screen-button', 'App do Membro'],
                        ['dashboard_membro.html', 'fa-solid fa-user-group', 'Painel do Membro'],
                        ['novidades.html', 'fa-solid fa-star', 'Novidades'],
                        ['configuracoes.html', 'fa-solid fa-gear', 'Configurações', 'configuracoes'],
                        ['index.html', 'fa-solid fa-right-from-bracket', 'Sair']
                    ], activePath, true, user)}

                    ${renderSecretariaGroup(activePath, user)}

                    ${renderTesourariaGroup(activePath, user)}

                    ${renderLegacyGroup('Contabilidade', 'fa-solid fa-scale-balanced', [
                        ['plano_contas.html', 'fa-solid fa-list-ol', 'Plano de Contas', 'financeiro'],
                        ['balancete_abertura.html', 'fa-solid fa-book-open', 'Balancete de Abertura', 'financeiro'],
                        ['lancamentos_contabeis.html', 'fa-solid fa-clipboard-list', 'Lançamentos Contábeis', 'financeiro'],
                        ['encerramento_exercicio.html', 'fa-solid fa-flag-checkered', 'Encerramento do Exercício', 'financeiro']
                    ], activePath, false, user)}

                    ${renderLegacyGroup('Gráficos', 'fa-solid fa-chart-column', [
                        ['graficos_secretaria.html', 'fa-solid fa-chart-pie', 'Secretaria', 'financeiro'],
                        ['graficos_tesouraria.html', 'fa-solid fa-chart-line', 'Tesouraria', 'financeiro']
                    ], activePath, false, user)}

                    ${renderLegacyGroup('Relatórios', 'fa-solid fa-print', [
                        ['relatorios_secretaria.html', 'fa-regular fa-file-lines', 'Secretaria', 'financeiro'],
                        ['relatorios_tesouraria.html', 'fa-regular fa-file-lines', 'Tesouraria', 'financeiro'],
                        ['relatorios_contabilidade.html', 'fa-regular fa-file-lines', 'Contabilidade', 'financeiro']
                    ], activePath, false, user)}
                </nav>

                <div class="sidebar-footer">
                    Copyright © 2026 LDFP.<br>Todos os Direitos Reservados.
                </div>
            </aside>
        `;
    }

    function renderHeader(config) {
        return `
            <header class="enterprise-top-header">
                <div class="enterprise-top-left">
                    <button class="enterprise-menu-toggle" id="menuToggle" type="button" aria-label="Alternar menu">
                        <i class="fa-solid fa-bars"></i>
                    </button>
                    <div>
                        <div class="enterprise-breadcrumb">${config.breadcrumb}</div>
                        <h1>${config.title}</h1>
                    </div>
                </div>
                <div class="enterprise-top-right">
                    <div class="enterprise-header-chip">
                        <i class="fa-solid fa-shield-heart"></i>
                        <span>${config.chipText}</span>
                    </div>
                    <div class="enterprise-header-user">
                        <strong id="headerUserName">Leonardo</strong>
                        <span>${config.roleLabel}</span>
                    </div>
                </div>
            </header>
        `;
    }

    function applyUserLabels() {
        const user = getAuthUser();
        const label = getUserLabel(user);
        const role = getUserRole(user);
        const sidebarUserName = document.getElementById('sidebarUserName');
        const headerUserName = document.getElementById('headerUserName');
        const roleTargets = document.querySelectorAll('[data-user-role]');

        if (sidebarUserName) {
            sidebarUserName.textContent = String(label).toUpperCase();
        }

        if (headerUserName) {
            headerUserName.textContent = label;
        }

        roleTargets.forEach((target) => {
            target.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        });
    }

    function bindMenuToggle() {
        const menuToggle = document.getElementById('menuToggle');
        const sidebar = document.getElementById('enterpriseSidebar');
        if (!menuToggle || !sidebar) {
            return;
        }

        // Inicializa estado dos containers: abrir somente se a página atual estiver no submenu
        sidebar.querySelectorAll('.dropdown-container').forEach((container) => {
            const prevBtn = container.previousElementSibling;
            const inlineOpen = container.style.display === 'block';
            const hasCurrentClass = !!container.querySelector('a.current-page, a.active-link');
            const hrefMatch = Array.from(container.querySelectorAll('a')).some(a => {
                try {
                    return new URL(a.getAttribute('href'), window.location.origin).pathname === window.location.pathname;
                } catch (e) {
                    return false;
                }
            });

            if (hasCurrentClass || hrefMatch || (prevBtn && prevBtn.classList.contains('active')) || inlineOpen) {
                container.classList.add('is-open');
                container.style.display = 'block';
                if (prevBtn) prevBtn.classList.add('active');
            } else {
                container.classList.remove('is-open');
                container.style.display = 'none';
                if (prevBtn) prevBtn.classList.remove('active');
            }
        });

        // Clique nos botões dropdown (Secretaria, Tesouraria, etc.)
        sidebar.querySelectorAll('.dropdown-btn').forEach((btn) => {
            btn.addEventListener('click', function () {
                const container = this.nextElementSibling;
                if (!container || !container.classList.contains('dropdown-container')) return;

                const isOpen = container.classList.contains('is-open');

                // Fecha todos os outros
                sidebar.querySelectorAll('.dropdown-container').forEach((c) => {
                    c.classList.remove('is-open');
                    c.style.display = 'none';
                    const prevBtn = c.previousElementSibling;
                    if (prevBtn) prevBtn.classList.remove('active');
                });

                // Abre ou fecha o clicado
                if (!isOpen) {
                    container.classList.add('is-open');
                    container.style.display = 'block';
                    this.classList.add('active');
                }
            });
        });

        // Toggle da sidebar no mobile
        menuToggle.addEventListener('click', function () {
            sidebar.classList.toggle('is-open');
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 1080) {
                sidebar.classList.remove('is-open');
            }
        });

        // Sub-dropdowns continuam usando a lógica de exibição interna (se houver)
        sidebar.querySelectorAll('.sub-dropdown-btn').forEach((button) => {
            button.addEventListener('click', function () {
                const container = this.nextElementSibling;
                if (!container || !container.classList.contains('sub-dropdown-container')) {
                    return;
                }

                const isOpening = !this.classList.contains('active');
                this.classList.toggle('active', isOpening);
                container.style.display = isOpening ? 'block' : 'none';
            });
        });

        sidebar.querySelectorAll('a[data-locked="true"]').forEach((anchor) => {
            anchor.addEventListener('click', function (event) {
                event.preventDefault();
                showLockedFeatureMessage(anchor);
            });
        });

    }

    async function loadDynamicFeatures() {
        try {
            const response = await fetch('/api/modulos/me');
            if (!response.ok) {
                dynamicFeatureAllowList = null;
                return;
            }

            const payload = await response.json();
            const featureKeys = Array.isArray(payload?.featureKeys) ? payload.featureKeys : null;
            const normalizedFeatures = normalizeFeatureAllowList(featureKeys);

            // Fallback de compatibilidade: se o catálogo SaaS ainda não foi configurado,
            // mantém o menu padrão por perfil para não bloquear módulos já existentes.
            dynamicFeatureAllowList = normalizedFeatures;
        } catch (_) {
            dynamicFeatureAllowList = null;
        }
    }

    function enforcePageFeatureAccess(activePath, user) {
        const fileName = normalizePath(activePath).split('?')[0];
        const requiredFeature = PAGE_FEATURES[fileName];

        if (!requiredFeature) {
            return;
        }

        if (!canUseFeature(user, requiredFeature)) {
            window.location.href = 'dashboard.html';
        }
    }

    async function initShell() {
        cleanupShellDuplicates();

        if (
            window[SHELL_INITIALIZED_KEY]
            || window[SHELL_INITIALIZING_KEY]
            || document.getElementById('enterpriseSidebar')
            || document.querySelector('aside.enterprise-sidebar, aside.legacy-shell-sidebar')
        ) {
            window[SHELL_INITIALIZED_KEY] = true;
            return;
        }

        window[SHELL_INITIALIZING_KEY] = true;

        const main = document.querySelector('main.enterprise-main') || document.querySelector('main.main-content');
        if (!main) {
            window[SHELL_INITIALIZING_KEY] = false;
            return;
        }

        try {
            const body = document.body;
            const currentPath = `${window.location.pathname.split('/').pop() || 'dashboard.html'}${window.location.search || ''}`;
            const activePath = body.dataset.shellActive || currentPath;
            await loadDynamicFeatures();
            enforcePageFeatureAccess(activePath, getAuthUser());
            const config = {
                title: body.dataset.shellTitle || 'Painel de Controle',
                breadcrumb: body.dataset.shellBreadcrumb || 'LDFP / Visão Geral',
                chipText: body.dataset.shellChip || 'Ambiente autenticado',
                roleLabel: body.dataset.shellRole || (getUserRole(getAuthUser()).charAt(0).toUpperCase() + getUserRole(getAuthUser()).slice(1))
            };

            main.classList.add('enterprise-main');
            body.classList.add('legacy-sidebar-mode');
            ensureLockStyles();
            ensureUpgradeModal();

            if (!document.getElementById('enterpriseSidebar')) {
                body.insertAdjacentHTML('afterbegin', renderSidebar(activePath, getAuthUser()));
            }

            if (!main.querySelector('.enterprise-top-header')) {
                main.insertAdjacentHTML('afterbegin', renderHeader(config));
            }

            applyUserLabels();
            bindMenuToggle();
            window[SHELL_INITIALIZED_KEY] = true;
        } finally {
            window[SHELL_INITIALIZING_KEY] = false;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShell);
    } else {
        initShell();
    }
})();