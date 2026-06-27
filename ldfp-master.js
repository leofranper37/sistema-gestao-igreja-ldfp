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
  metricas:    { title: 'Métricas SaaS', sub: 'MRR, churn, crescimento e receita', fn: viewMetricas   },
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

// ── VIEW: MÉTRICAS SAAS ────────────────────────────────────────────────────
async function viewMetricas() {
  const body = document.getElementById('pageBody');
  try {
    const d = await apiFetch('/api/saas/metricas');
    const { kpis, distribuicaoPlanos, crescimentoMensal, receitaMensal } = d;

    const fmtPct = v => Number(v||0).toFixed(1) + '%';
    const nomeMes = m => {
      const [y, mo] = m.split('-');
      return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    };

    // Bar chart helpers (CSS-based, sem dependência externa)
    function barChart(items, keyLabel, keyVal, colorFn) {
      const max = Math.max(...items.map(i => i[keyVal]), 1);
      return items.map(i => {
        const pct = Math.round((i[keyVal] / max) * 100);
        const color = colorFn ? colorFn(i) : 'var(--ldfp-azul)';
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div style="width:64px;font-size:11px;color:var(--ldfp-cinza-600);text-align:right;flex-shrink:0">${i[keyLabel]}</div>
            <div style="flex:1;background:#f1f5f9;border-radius:6px;height:22px;overflow:hidden">
              <div style="width:${pct}%;background:${color};height:100%;border-radius:6px;transition:.4s"></div>
            </div>
            <div style="width:56px;font-size:12px;font-weight:700;color:var(--ldfp-dark)">${keyVal === 'total' ? fmtBRL(i[keyVal]) : i[keyVal]}</div>
          </div>`;
      }).join('');
    }

    // Alertas trials
    const alertaTrials = kpis.trialExpirando > 0
      ? `<div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px 18px;display:flex;align-items:center;gap:12px;margin-bottom:20px">
           <i class="fa-solid fa-triangle-exclamation" style="color:#d97706;font-size:18px"></i>
           <div>
             <div style="font-weight:700;font-size:13px;color:#92400e">${kpis.trialExpirando} trial(s) expirando em até 7 dias</div>
             <div style="font-size:12px;color:#b45309">Acesse Igrejas para acompanhar.</div>
           </div>
         </div>`
      : '';

    body.innerHTML = `
      ${alertaTrials}

      <!-- KPI CARDS -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px">
        <div class="card" style="padding:20px">
          <div style="font-size:11px;color:var(--ldfp-cinza-600);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">MRR</div>
          <div style="font-size:26px;font-weight:800;color:var(--ldfp-dark)">${fmtBRL(kpis.mrr)}</div>
          <div style="font-size:11px;color:var(--ldfp-cinza-600);margin-top:4px">receita recorrente mensal</div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-size:11px;color:var(--ldfp-cinza-600);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Igrejas Ativas</div>
          <div style="font-size:26px;font-weight:800;color:#10b981">${kpis.ativas}</div>
          <div style="font-size:11px;color:var(--ldfp-cinza-600);margin-top:4px">de ${kpis.total} total (${kpis.trial} em trial)</div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-size:11px;color:var(--ldfp-cinza-600);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Churn</div>
          <div style="font-size:26px;font-weight:800;color:${kpis.churnRate > 10 ? '#ef4444' : '#f59e0b'}">${fmtPct(kpis.churnRate)}</div>
          <div style="font-size:11px;color:var(--ldfp-cinza-600);margin-top:4px">${kpis.suspensas} suspensas/canceladas</div>
        </div>
        <div class="card" style="padding:20px">
          <div style="font-size:11px;color:var(--ldfp-cinza-600);font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">ARPU</div>
          <div style="font-size:26px;font-weight:800;color:var(--ldfp-dark)">${fmtBRL(kpis.arpu)}</div>
          <div style="font-size:11px;color:var(--ldfp-cinza-600);margin-top:4px">receita média por cliente ativo</div>
        </div>
      </div>

      <!-- CHARTS ROW -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px">

        <!-- Receita Mensal -->
        <div class="card">
          <div class="card-header"><h3><i class="fa-solid fa-coins" style="color:#f59e0b;margin-right:8px"></i>Receita Mensal (6 meses)</h3></div>
          <div class="card-body">
            ${receitaMensal.length
              ? barChart(receitaMensal.map(r => ({ ...r, mes: nomeMes(r.mes) })), 'mes', 'total', () => '#2563eb')
              : '<div style="color:var(--ldfp-cinza-600);font-size:13px">Nenhum pagamento registrado ainda.</div>'
            }
          </div>
        </div>

        <!-- Novas Igrejas -->
        <div class="card">
          <div class="card-header"><h3><i class="fa-solid fa-church" style="color:#10b981;margin-right:8px"></i>Novas Igrejas (6 meses)</h3></div>
          <div class="card-body">
            ${crescimentoMensal.length
              ? barChart(crescimentoMensal.map(r => ({ ...r, mes: nomeMes(r.mes) })), 'mes', 'novas', () => '#10b981')
              : '<div style="color:var(--ldfp-cinza-600);font-size:13px">Sem dados de crescimento.</div>'
            }
          </div>
        </div>
      </div>

      <!-- DISTRIBUIÇÃO PLANOS -->
      <div class="card">
        <div class="card-header"><h3><i class="fa-solid fa-tags" style="color:#8b5cf6;margin-right:8px"></i>Igrejas Ativas por Plano</h3></div>
        <div class="card-body">
          ${distribuicaoPlanos.length
            ? barChart(distribuicaoPlanos, 'plano', 'count', () => '#8b5cf6')
            : '<div style="color:var(--ldfp-cinza-600);font-size:13px">Nenhuma igreja ativa no momento.</div>'
          }
        </div>
      </div>
    `;
  } catch (err) {
    body.innerHTML = `<div class="alert alert-danger">Erro ao carregar métricas: ${err.message}</div>`;
  }
}

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

