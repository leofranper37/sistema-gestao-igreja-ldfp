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
        super_admin: ['dashboard', 'membros', 'cargos', 'historico_pastoral', 'grupos', 'escalas', 'ebd', 'batismos', 'agenda', 'outras_igrejas', 'missionarios', 'visitantes', 'criancas', 'oracoes', 'novidades', 'whatsapp', 'autocadastro', 'portaria_qr', 'telao', 'estudo', 'dizimos', 'caixa', 'bancos', 'pagamentos', 'contas_pagar', 'recibos', 'transferencias', 'contabilidade', 'graficos', 'relatorios', 'app_membro', 'configuracoes', 'planos'],
        admin: ['dashboard', 'membros', 'cargos', 'historico_pastoral', 'grupos', 'escalas', 'ebd', 'batismos', 'agenda', 'outras_igrejas', 'missionarios', 'visitantes', 'criancas', 'oracoes', 'novidades', 'whatsapp', 'autocadastro', 'portaria_qr', 'telao', 'estudo', 'dizimos', 'caixa', 'bancos', 'pagamentos', 'contas_pagar', 'recibos', 'transferencias', 'contabilidade', 'graficos', 'relatorios', 'app_membro', 'configuracoes'],
        secretaria: ['dashboard', 'membros', 'cargos', 'historico_pastoral', 'grupos', 'escalas', 'ebd', 'batismos', 'agenda', 'outras_igrejas', 'missionarios', 'visitantes', 'criancas', 'oracoes', 'novidades', 'whatsapp', 'autocadastro', 'portaria_qr', 'telao', 'estudo', 'dizimos', 'caixa', 'bancos', 'pagamentos', 'contas_pagar', 'recibos', 'transferencias', 'contabilidade', 'graficos', 'relatorios', 'app_membro'],
        pastor: ['dashboard', 'membros', 'cargos', 'historico_pastoral', 'grupos', 'escalas', 'ebd', 'batismos', 'agenda', 'outras_igrejas', 'missionarios', 'visitantes', 'criancas', 'oracoes', 'novidades', 'whatsapp', 'autocadastro', 'telao', 'estudo', 'app_membro'],
        financeiro: ['dashboard', 'dizimos', 'caixa', 'bancos', 'pagamentos', 'contas_pagar', 'recibos', 'transferencias', 'contabilidade', 'graficos', 'relatorios'],
        oficial: ['membros', 'visitantes', 'agenda', 'oracoes', 'portaria_qr', 'estudo'],
        ministerio: ['membros', 'oracoes', 'agenda', 'criancas', 'ebd', 'estudo'],
        midia: ['agenda', 'membros', 'telao', 'estudo', 'app_membro'],
        membro: ['oracoes', 'agenda', 'estudo'],
        visitante: ['oracoes', 'agenda', 'estudo']
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
        // Dashboard
        'dashboard.html': 'dashboard',
        // Membros
        'membros.html': 'membros',
        'cadastro.html': 'membros',
        'lista_membros.html': 'membros',
        'congregados.html': 'membros',
        'congregacoes.html': 'membros',
        // Cargos
        'cargos.html': 'cargos',
        'situacoes.html': 'cargos',
        // Histórico Pastoral
        'historico_pastoral.html': 'historico_pastoral',
        'tipos_historico.html': 'historico_pastoral',
        // Grupos
        'grupos.html': 'grupos',
        'grupo_novo.html': 'grupos',
        'grupos_categorias.html': 'grupos',
        'grupos_reunioes.html': 'grupos',
        // Escalas
        'escalas.html': 'escalas',
        // EBD
        'ebd_alunos.html': 'ebd',
        'ebd_turmas.html': 'ebd',
        'ebd_grades.html': 'ebd',
        // Batismos
        'batismos.html': 'batismos',
        'batismo_novo.html': 'batismos',
        'batismos_inscricoes.html': 'batismos',
        // Agenda
        'agenda.html': 'agenda',
        // Outras Igrejas
        'outras_igrejas.html': 'outras_igrejas',
        // Missionários
        'missionarios.html': 'missionarios',
        // Visitantes
        'visitantes.html': 'visitantes',
        'visitantes_kanban.html': 'visitantes',
        // Crianças
        'criancas.html': 'criancas',
        // Orações
        'oracoes.html': 'oracoes',
        // Novidades
        'novidades.html': 'novidades',
        // WhatsApp
        'comunicacao_whatsapp.html': 'whatsapp',
        // Autocadastro
        'autocadastro_aprovacoes.html': 'autocadastro',
        // Portaria QR
        'portaria_checkin.html': 'portaria_qr',
        // App Mídia (legado → app_membro)
        'app_midia.html': 'app_membro',
        // Telão
        'telao_visitantes.html': 'telao',
        // Tesouraria — Dízimos
        'financeiro.html': 'dizimos',
        'dizimos.html': 'dizimos',
        'tesouraria_dizimos.html': 'dizimos',
        'dizimos_lancamentos.html': 'dizimos',
        'dizimos_tipos_receita.html': 'dizimos',
        // Tesouraria — Caixa
        'tesouraria_caixa.html': 'caixa',
        'caixa_lancamentos.html': 'caixa',
        'caixa_ativar_mes.html': 'caixa',
        'caixa_saldo_inicial.html': 'caixa',
        // Tesouraria — Bancos
        'bancos_lancamentos.html': 'bancos',
        'banco.html': 'bancos',
        'tesouraria_bancos.html': 'bancos',
        'importacao_extrato.html': 'bancos',
        // Tesouraria — outros
        'pagamentos.html': 'pagamentos',
        'contas_pagar.html': 'contas_pagar',
        'recibo.html': 'recibos',
        'transferencias.html': 'transferencias',
        // Contabilidade
        'plano_contas.html': 'contabilidade',
        'balancete_abertura.html': 'contabilidade',
        'lancamentos_contabeis.html': 'contabilidade',
        'encerramento_exercicio.html': 'contabilidade',
        // Gráficos
        'graficos_secretaria.html': 'graficos',
        'graficos_tesouraria.html': 'graficos',
        // Relatórios
        'relatorios_secretaria.html': 'relatorios',
        'relatorios_tesouraria.html': 'relatorios',
        'relatorios_contabilidade.html': 'relatorios',
        // Configurações
        'configuracoes.html': 'configuracoes',
        // Planos (super admin only)
        'planos_lista.html': 'planos',
        'planos_editar.html': 'planos',
        // App do Membro
        'app_membro.html': 'app_membro',
        'dashboard_membro.html': 'app_membro',
        'painel_app_membro.html': 'app_membro',
        // Ensino
        'estudo.html': 'estudo',
        'planos-estudo.html': 'estudo',
        'plano-detalhe.html': 'estudo',
        'admin-planos-estudo.html': 'estudo',
        'devocionais.html': 'estudo'
    };

    let dynamicFeatureAllowList = null;
    let dynamicModules = [];

    const FEATURE_KEY_ALIASES = {
        // Legado → novo
        financeiro: 'dizimos',
        igrejas: 'outras_igrejas',
        congregacoes: 'outras_igrejas',
        ebd_dominical: 'ebd',
        'criancas-ebd': 'ebd',
        criancas_ebd: 'ebd',
        // Typos e variantes
        credencial_membro: 'app_membro',
        credencial: 'app_membro',
        app_midia: 'app_membro',
        portaria: 'portaria_qr',
        grupos_celulas: 'grupos',
        midia: 'app_membro'
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
                        <a href="planos.html" class="ldfp-upgrade-btn primary" id="ldfpUpgradePlansLink">Ver planos e fazer upgrade</a>
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
            plansLink.href = `planos.html?${query.toString()}`;
        }

        modal.classList.add('is-open');
    }

    function showLockedFeatureMessage(anchor) {
        const feature = String(anchor?.dataset?.feature || '').trim();
        const label = String(anchor?.dataset?.label || 'Este módulo').trim();
        const featureLabelMap = {
            membros: 'Membros', cargos: 'Cargos', historico_pastoral: 'Histórico Pastoral',
            grupos: 'Grupos e Células', escalas: 'Escalas de Culto', ebd: 'EBD',
            batismos: 'Batismos', agenda: 'Agenda', outras_igrejas: 'Outras Igrejas',
            missionarios: 'Missionários', visitantes: 'Visitantes', criancas: 'Crianças',
            oracoes: 'Orações', novidades: 'Novidades', whatsapp: 'Módulo de WhatsApp',
            autocadastro: 'Aprovação de Cadastro', portaria_qr: 'Portaria QR', telao: 'Telão',
            estudo: 'Estudo Bíblico', dizimos: 'Dízimos & Ofertas', caixa: 'Caixa',
            bancos: 'Bancos', pagamentos: 'Links de Pagamento', contas_pagar: 'Contas a Pagar',
            recibos: 'Recibos', transferencias: 'Transferências', contabilidade: 'Contabilidade',
            graficos: 'Gráficos', relatorios: 'Relatórios', app_membro: 'App do Membro'
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
            ['situacoes.html', 'fa-solid fa-toggle-on', 'Situações', 'cargos'],
            ['congregacoes.html', 'fa-solid fa-church', 'Congregações', 'membros']
        ];

        const historicoLinks = [
            ['historico_pastoral.html', 'fa-solid fa-book-bible', 'Histórico Pastoral', 'historico_pastoral'],
            ['tipos_historico.html', 'fa-solid fa-list-check', 'Tipo de Histórico', 'historico_pastoral']
        ];

        const grupoLinks = [
            ['grupos.html', 'fa-solid fa-people-group', 'Grupos', 'grupos']
        ];

        const escalaLinks = [
            ['escalas.html?tab=eventos', 'fa-regular fa-calendar', 'Eventos', 'escalas'],
            ['escalas.html?tab=dashboard', 'fa-solid fa-clipboard-list', 'Gestão de Escalas', 'escalas'],
            ['escalas.html?tab=matriz', 'fa-solid fa-calendar-days', 'Escala Mensal', 'escalas']
        ];

        const ebdLinks = [
            ['ebd_alunos.html', 'fa-solid fa-child-reaching', 'Alunos', 'ebd'],
            ['ebd_turmas.html', 'fa-solid fa-users-line', 'Turmas & Revistas', 'ebd'],
            ['ebd_grades.html', 'fa-solid fa-calendar-days', 'Grades & Presença', 'ebd']
        ];

        const batismoLinks = [
            ['batismos.html', 'fa-solid fa-water', 'Batismos', 'batismos'],
            ['batismo_novo.html', 'fa-solid fa-plus', 'Cadastrar', 'batismos'],
            ['batismos_inscricoes.html', 'fa-solid fa-clipboard-check', 'Inscrições', 'batismos']
        ];

        const otherLinks = [
            ['agenda.html', 'fa-solid fa-calendar-days', 'Agenda', 'agenda'],
            ['outras_igrejas.html', 'fa-solid fa-globe', 'Outras Igrejas', 'outras_igrejas'],
            ['missionarios.html', 'fa-solid fa-person-rays', 'Missionários', 'missionarios'],
            ['visitantes.html', 'fa-solid fa-user-plus', 'Visitantes', 'visitantes'],
            ['visitantes_kanban.html', 'fa-solid fa-shoe-prints', 'Acompanhamento', 'visitantes'],
            ['congregados.html', 'fa-solid fa-people-arrows-left-right', 'Congregados', 'membros'],
            ['criancas.html', 'fa-solid fa-child-reaching', 'Crianças', 'criancas'],
            ['oracoes.html', 'fa-solid fa-hands-praying', 'Orações', 'oracoes'],
            ['comunicacao_whatsapp.html', 'fa-brands fa-whatsapp', 'WhatsApp', 'whatsapp'],
            ['autocadastro_aprovacoes.html', 'fa-solid fa-user-check', 'Aprovação de Cadastro', 'autocadastro'],
            ['portaria_checkin.html', 'fa-solid fa-qrcode', 'Portaria QR', 'portaria_qr'],
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
            ['tesouraria_dizimos.html', 'fa-solid fa-coins', 'Dízimos', 'dizimos']
        ];

        const caixaLinks = [
            ['tesouraria_caixa.html', 'fa-solid fa-cash-register', 'Caixa', 'caixa'],
            ['caixa_ativar_mes.html', 'fa-solid fa-circle-dollar-to-slot', 'Ativar Mês / Saldo Inicial', 'caixa']
        ];

        const bancosLinks = [
            ['tesouraria_bancos.html', 'fa-solid fa-building-columns', 'Bancos', 'bancos'],
            ['bancos_lancamentos.html', 'fa-solid fa-file-invoice-dollar', 'Lançamentos Bancários', 'bancos'],
            ['importacao_extrato.html', 'fa-solid fa-file-import', 'Importar Extrato', 'bancos']
        ];

        const otherLinks = [
            ['pagamentos.html', 'fa-solid fa-link', 'Links de Pagamento', 'pagamentos'],
            ['contas_pagar.html', 'fa-solid fa-file-invoice-dollar', 'Contas a Pagar', 'contas_pagar'],
            ['recibo.html', 'fa-solid fa-receipt', 'Recibos', 'recibos'],
            ['transferencias.html', 'fa-solid fa-right-left', 'Transferências', 'transferencias']
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

    function renderDynamicModulesGroup(activePath) {
        // Módulos criados via Fábrica de Inovações que têm route_path definido
        const extras = dynamicModules.filter(m =>
            m.effective_enabled &&
            m.route_path &&
            !PAGE_FEATURES[m.route_path.split('?')[0]]
        );

        if (!extras.length) return '';

        const linksHtml = extras.map(m => {
            const href = m.route_path;
            const icon = m.icon || 'fa-solid fa-puzzle-piece';
            const label = m.nome || m.slug || '';
            const activeClass = isLinkActive(href, activePath) ? 'active-link' : '';
            return `<a href="${href}" class="${activeClass}" data-href="${href}" data-label="${label}"><i class="${icon}"></i><span>${label}</span></a>`;
        }).join('');

        const hasActive = extras.some(m => isLinkActive(m.route_path, activePath));

        return `
            <button class="dropdown-btn ${hasActive ? 'active' : ''}" type="button">
                <span><i class="fa-solid fa-lightbulb icon-left"></i> Módulos</span>
                <i class="fa-solid fa-chevron-right arrow"></i>
            </button>
            <div class="dropdown-container" style="${hasActive ? 'display:block;' : 'display:none;'}">
                ${linksHtml}
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
                        ['painel_app_membro.html', 'fa-solid fa-mobile-screen-button', 'App do Membro', 'app_membro'],
                        ['dashboard_membro.html', 'fa-solid fa-user-group', 'Painel do Membro', 'app_membro'],
                        ['novidades.html', 'fa-solid fa-star', 'Novidades', 'novidades'],
                        ['configuracoes.html', 'fa-solid fa-gear', 'Configurações', 'configuracoes'],
                        ['index.html', 'fa-solid fa-right-from-bracket', 'Sair']
                    ], activePath, true, user)}

                    ${renderSecretariaGroup(activePath, user)}

                    ${renderLegacyGroup('Ensino', 'fa-solid fa-graduation-cap', [
                        ['estudo.html', 'fa-solid fa-book-bible', 'Bíblia & Estudo', 'estudo'],
                        ['planos-estudo.html', 'fa-solid fa-map-signs', 'Planos de Leitura', 'estudo'],
                        ['admin-planos-estudo.html', 'fa-solid fa-list-check', 'Gestão de Planos', 'estudo'],
                        ['devocionais.html', 'fa-solid fa-book-open-reader', 'Devocionais', 'estudo']
                    ], activePath, false, user)}

                    ${renderTesourariaGroup(activePath, user)}

                    ${renderLegacyGroup('Contabilidade', 'fa-solid fa-scale-balanced', [
                        ['plano_contas.html', 'fa-solid fa-list-ol', 'Plano de Contas', 'contabilidade'],
                        ['balancete_abertura.html', 'fa-solid fa-book-open', 'Balancete de Abertura', 'contabilidade'],
                        ['lancamentos_contabeis.html', 'fa-solid fa-clipboard-list', 'Lançamentos Contábeis', 'contabilidade'],
                        ['encerramento_exercicio.html', 'fa-solid fa-flag-checkered', 'Encerramento do Exercício', 'contabilidade']
                    ], activePath, false, user)}

                    ${renderLegacyGroup('Gráficos', 'fa-solid fa-chart-column', [
                        ['graficos_secretaria.html', 'fa-solid fa-chart-pie', 'Secretaria', 'graficos'],
                        ['graficos_tesouraria.html', 'fa-solid fa-chart-line', 'Tesouraria', 'graficos']
                    ], activePath, false, user)}

                    ${renderLegacyGroup('Relatórios', 'fa-solid fa-print', [
                        ['relatorios_secretaria.html', 'fa-regular fa-file-lines', 'Secretaria', 'relatorios'],
                        ['relatorios_tesouraria.html', 'fa-regular fa-file-lines', 'Tesouraria', 'relatorios'],
                        ['relatorios_contabilidade.html', 'fa-regular fa-file-lines', 'Contabilidade', 'relatorios']
                    ], activePath, false, user)}

                    ${renderDynamicModulesGroup(activePath)}
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

        // Toggle da sidebar (desktop: recolhe/expande; mobile: abre/fecha)
        menuToggle.addEventListener('click', function () {
            if (window.innerWidth > 1080) {
                document.body.classList.toggle('sidebar-collapsed');
                const icon = menuToggle.querySelector('i');
                if (icon) {
                    icon.className = document.body.classList.contains('sidebar-collapsed')
                        ? 'fa-solid fa-bars-staggered'
                        : 'fa-solid fa-bars';
                }
            } else {
                sidebar.classList.toggle('is-open');
            }
        });

        window.addEventListener('resize', function () {
            if (window.innerWidth > 1080) {
                sidebar.classList.remove('is-open');
            } else {
                document.body.classList.remove('sidebar-collapsed');
                const icon = menuToggle.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-bars';
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
                const feature = String(anchor.dataset.feature || '').trim();
                const label = String(anchor.dataset.label || '').trim();
                const query = new URLSearchParams({ upgrade: '1', origem: 'menu_bloqueado', feature, feature_nome: label });
                window.location.href = 'planos.html?' + query.toString();
            });
        });

    }

    async function loadDynamicFeatures() {
        try {
            const CACHE_KEY = 'ldfp_modulos_me';
            const cached = sessionStorage.getItem(CACHE_KEY);

            if (cached) {
                const payload = JSON.parse(cached);
                dynamicFeatureAllowList = normalizeFeatureAllowList(Array.isArray(payload?.featureKeys) ? payload.featureKeys : null);
                dynamicModules = Array.isArray(payload?.modules) ? payload.modules : [];
                return;
            }

            const response = await fetch('/api/modulos/me');
            if (!response.ok) {
                dynamicFeatureAllowList = null;
                dynamicModules = [];
                return;
            }

            const payload = await response.json();
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));

            dynamicFeatureAllowList = normalizeFeatureAllowList(Array.isArray(payload?.featureKeys) ? payload.featureKeys : null);
            dynamicModules = Array.isArray(payload?.modules) ? payload.modules : [];
        } catch (_) {
            dynamicFeatureAllowList = null;
            dynamicModules = [];
        }
    }

    function enforcePageFeatureAccess(activePath, user) {
        const fileName = normalizePath(activePath).split('?')[0];
        const requiredFeature = PAGE_FEATURES[fileName];

        if (!requiredFeature) {
            return;
        }

        if (!canUseFeature(user, requiredFeature)) {
            // Mostra modal de upgrade em vez de redirecionar
            ensureLockStyles();
            ensureUpgradeModal();
            const featureLabelMap = {
                membros: 'Membros', cargos: 'Cargos', historico_pastoral: 'Histórico Pastoral',
                grupos: 'Grupos e Células', escalas: 'Escalas de Culto', ebd: 'EBD',
                batismos: 'Batismos', agenda: 'Agenda', outras_igrejas: 'Outras Igrejas',
                missionarios: 'Missionários', visitantes: 'Visitantes', criancas: 'Crianças',
                oracoes: 'Orações', novidades: 'Novidades', whatsapp: 'Módulo de WhatsApp',
                autocadastro: 'Aprovação de Cadastro', portaria_qr: 'Portaria QR Code',
                telao: 'Telão de Visitantes', estudo: 'Estudo Bíblico',
                dizimos: 'Dízimos & Ofertas', caixa: 'Caixa', bancos: 'Bancos',
                pagamentos: 'Links de Pagamento', contas_pagar: 'Contas a Pagar',
                recibos: 'Recibos', transferencias: 'Transferências',
                contabilidade: 'Contabilidade', graficos: 'Gráficos', relatorios: 'Relatórios',
                app_membro: 'App do Membro'
            };
            const resourceName = featureLabelMap[requiredFeature] || fileName.replace('.html', '');
            // Bloqueia o conteúdo da página
            const main = document.querySelector('main.enterprise-main') || document.querySelector('main.main-content');
            if (main) {
                main.style.filter = 'blur(4px)';
                main.style.pointerEvents = 'none';
                main.style.userSelect = 'none';
            }
            // Abre o modal após o shell renderizar
            setTimeout(() => openUpgradeModal(resourceName, requiredFeature), 100);
            // Ao fechar o modal → volta ao dashboard; "Ver planos" → planos.html
            const modal = document.getElementById('ldfpUpgradeModal');
            if (modal) {
                modal.addEventListener('click', function handler(e) {
                    const close = e.target === modal || e.target?.dataset?.upgradeClose === 'true';
                    if (close) {
                        modal.removeEventListener('click', handler);
                        window.location.href = 'dashboard.html';
                    }
                }, { once: false });
                // Garante que o link "Ver planos" aponta para planos.html com contexto
                const plansBtn = modal.querySelector('#ldfpUpgradePlansLink');
                if (plansBtn) {
                    const q = new URLSearchParams({ upgrade: '1', origem: 'pagina_bloqueada', feature: requiredFeature });
                    plansBtn.href = 'planos.html?' + q.toString();
                }
            }
        }
    }

async function initShell() {
    if (window[SHELL_INITIALIZED_KEY]) return;
    window[SHELL_INITIALIZED_KEY] = true;

    const main = document.querySelector('main.enterprise-main') || document.querySelector('main.main-content');
    if (!main) return;

    let user = getAuthUser();
    if (!user) {
        // Pequeno delay natural (que causa a "piscada") aguardando os dados
        await new Promise(resolve => setTimeout(resolve, 500));
        user = getAuthUser();
    }

    const body = document.body;
    const currentPath = `${window.location.pathname.split('/').pop() || 'dashboard.html'}${window.location.search || ''}`;
    const activePath = body.dataset.shellActive || currentPath;
    
    await loadDynamicFeatures();
    enforcePageFeatureAccess(activePath, user);

    const sidebarHtml = renderSidebar(activePath, user);
    const headerConfig = {
        title: body.dataset.shellTitle || 'LDFP',
        breadcrumb: body.dataset.shellBreadcrumb || 'LDFP',
        chipText: body.dataset.shellChip || 'Ambiente',
        roleLabel: body.dataset.shellRole || getUserRole(user)
    };
    const headerHtml = renderHeader(headerConfig);

    main.insertAdjacentHTML('beforebegin', sidebarHtml);
    main.insertAdjacentHTML('beforebegin', headerHtml);

    applyUserLabels();
    bindMenuToggle();
    ensureLockStyles();
    ensureUpgradeModal();
    cleanupShellDuplicates();
}

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShell);
    } else {
        initShell();
    }
})();