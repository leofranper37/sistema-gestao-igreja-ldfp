// public/js/ldfp-master.js

// ── Auth guard ─────────────────────────────────────────────────────────────
const AUTH = requireAuth();
const superRoles = ['super-admin','super_admin','superadmin','master','owner','root'];
if (!superRoles.includes(AUTH.user.role)) {
  window.location.href = 'dashboard.html';
}

// Preencher sidebar
const initials = (AUTH.user.nome || 'SA').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
document.getElementById('sidebarAvatar').textContent = initials;
document.getElementById('sidebarName').textContent   = AUTH.user.nome || 'Super Admin';
document.getElementById('btnLogout').onclick = () => { clearAuth(); location.href = 'login.html'; };

// ── Toast ──────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, tipo = 'success') {
  const el = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  el.className = `ldfp-toast ${tipo} show`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3500);
}

// ── Modal ──────────────────────────────────────────────────────────────────
function openModal({ title = '', sub = '', body = '', footer = '' }) {
  document.getElementById('modalTitle').textContent  = title;
  document.getElementById('modalSub').textContent    = sub;
  document.getElementById('modalBody').innerHTML     = body;
  document.getElementById('modalFooter').innerHTML  = footer;
  document.getElementById('overlay').classList.add('open');
}
function closeModal() {
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('modalClose').onclick = closeModal;
document.getElementById('overlay').onclick = e => {
  if (e.target === document.getElementById('overlay')) closeModal();
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmtBRL  = v => Number(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
const fmtDate = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
const esc     = s => String(s||'').replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>');

function badgeStatus(s) {
  const map = {
    ativa: 'badge-ativo', trial: 'badge-trial',
    inativa: 'badge-inativo', suspensa: 'badge-suspense',
    cancelada: 'badge-inativo',
  };
  return `<span class="badge ${map[s]||'badge-inativo'}">${esc(s||'—')}</span>`;
}

function badgePlano(p) {
  const map = {
    basico: 'badge-petroleo', premium: 'badge-ouro',
    siao: 'badge-ativo', master: 'badge-petroleo',
  };
  return `<span class="badge ${map[p]||'badge-petroleo'}">${esc(p||'—')}</span>`;
}

// ── Router ─────────────────────────────────────────────────────────────────
const VIEWS = {
  dashboard:   { title: 'Dashboard',     sub: 'Visão geral da rede LDFP',          fn: viewDashboard  },
  igrejas:     { title: 'Igrejas',       sub: 'Gerencie todas as igrejas',         fn: viewIgrejas    },
  assinaturas: { title: 'Assinaturas',   sub: 'Controle financeiro SaaS',          fn: viewAssinaturas},
  planos:      { title: 'Planos',        sub: 'Crie e edite planos disponíveis',   fn: viewPlanos     },
  modulos:     { title: 'Módulos',       sub: 'Controle de módulos por plano',     fn: viewModulos    },
  novidades:   { title: 'Novidades',     sub: 'Comunicados para as igrejas',       fn: viewNovidades  },
  usuarios:    { title: 'Usuários',      sub: 'Todos os usuários da plataforma',   fn: viewUsuarios   },
  logs:        { title: 'Logs',          sub: 'Atividade do sistema',              fn: viewLogs       },
};

function navigate(view) {
  const v = VIEWS[view];
  if (!v) return;

  document.querySelectorAll('.sidebar-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  document.getElementById('topbarTitle').textContent = v.title;
  document.getElementById('topbarSub').textContent   = v.sub;
  document.getElementById('topbarActions').innerHTML = '';
  document.getElementById('pageBody').innerHTML = '<div class="text-muted text-sm">Carregando...</div>';

  history.replaceState({}, '', `?view=${view}`);
  v.fn();
}

document.querySelectorAll('.sidebar-item[data-view]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.view));
});

// ── VIEW: DASHBOARD ────────────────────────────────────────────────────────
async function viewDashboard() {
  const body = document.getElementById('pageBody');
  try {
    const m = await apiFetch('/api/master/metricas');
    body.innerHTML = `
      <div class="kpi-grid" style="margin-bottom:24px">
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Total de igrejas</div>
            <div class="kpi-value">${m.total_igrejas}</div>
            <div class="kpi-sub">na rede LDFP</div>
          </div>
          <div class="kpi-icon kpi-icon-petroleo"><i class="fa-solid fa-church"></i></div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Igrejas ativas</div>
            <div class="kpi-value">${m.igrejas_ativas}</div>
            <div class="kpi-sub">assinaturas em dia</div>
          </div>
          <div class="kpi-icon kpi-icon-success"><i class="fa-solid fa-circle-check"></i></div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Novas (30 dias)</div>
            <div class="kpi-value">${m.novas_igrejas}</div>
            <div class="kpi-sub">crescimento recente</div>
          </div>
          <div class="kpi-icon kpi-icon-ouro"><i class="fa-solid fa-rocket"></i></div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Usuários totais</div>
            <div class="kpi-value">${m.total_usuarios}</div>
            <div class="kpi-sub">em toda a plataforma</div>
          </div>
          <div class="kpi-icon kpi-icon-warning"><i class="fa-solid fa-users"></i></div>
        </div>
        <div class="kpi-card">
          <div>
            <div class="kpi-label">Suspensas</div>
            <div class="kpi-value">${m.igrejas_suspensas}</div>
            <div class="kpi-sub">acesso bloqueado</div>
          </div>
          <div class="kpi-icon kpi-icon-danger"><i class="fa-solid fa-ban"></i></div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3><i class="fa-solid fa-chart-pie" style="color:var(--ldfp-ouro);margin-right:8px"></i>Distribuição por plano</h3>
        </div>
        <div class="card-body">
          <div style="display:flex;gap:12px;flex-wrap:wrap">
            ${

