# 📍 ONDE PAREI — Sistema Gestão Igreja LDFP

> Atualize este arquivo ao final de cada sessão de trabalho.
> Ao abrir o VS Code, comece por aqui.

---

## 🗓️ Última atualização: 01/06/2026

## ✅ Último commit enviado
- **Hash:** `2308c18`
- **Branch:** `main`
- **Repo:** `leofranper37/sistema-gestao-igreja-ldfp`
- **Mensagem:** `feat: onboarding guiado 3 passos (igreja/logo -> membros -> caixa)`

---

## ✅ O que já está feito (pronto e no GitHub)

| Item | Descrição | Commit |
|------|-----------|--------|
| Script backup por igreja | `scripts/backup-por-igreja.js` — exporta dados por igreja em JSON | `631236b` |
| Isolamento rotas super-admin | `isSuperAdmin` middleware bloqueia `role: admin` | `631236b` |
| API + UI backup/recuperação | `backupController.js` + `admin-backup.html` | `631236b` |
| Role guard 6 páginas admin | `admin-modulos`, `admin-assinaturas`, `admin-edicao-cliente`, `admin-igrejas`, `admin-planos`, `admin-retomada` corrigidos para somente super-admin | `8ed84bd` |
| SQL migration módulos | `CRIAR_TABELAS_MODULOS.sql` — cria `saas_modulos`, `saas_plano_modulos`, `igreja_modulos` | `8ed84bd` |
| 15 módulos inseridos no banco | Inseridos via phpMyAdmin em `saas_modulos` | manual cPanel |
| Cron job backup automático | cPanel — todo dia às 03:00h | manual cPanel |
| Webhook Mercado Pago | URL `https://ldfp.com.br/api/pagamentos/webhook/mercado-pago` + `MP_WEBHOOK_SECRET` no `.env` | `ecdd704` |
| Validação HMAC webhook MP | `paymentController.js` — valida header `x-signature` com HMAC-SHA256 | `ecdd704` |
| Backend métricas SaaS | `GET /api/saas/metricas` — MRR, churn, ARPU, crescimento, receita mensal | `d4b704f` |
| Página admin-metricas.html | `public/admin-metricas.html` — KPIs + 3 gráficos de barras CSS | `fed8ef9` |
| Link Métricas SaaS no sidebar | Adicionado em `super-admin.html`, `admin-igrejas.html`, `admin-assinaturas.html`, `admin-modulos.html` | `fed8ef9` |
| Relatório financeiro exportável | `GET /api/saas/relatorio-financeiro?mes=YYYY-MM[&formato=csv]` + `public/admin-relatorio-financeiro.html` — KPIs + tabela + botão Exportar CSV; link adicionado no sidebar de todas as páginas admin | `95d1c6d` |
| Tela de novidades para membros | Painel `#panel-novidades` + botão na bottom-nav + `loadNovidades()` em `app_membro_v2.html`; consome `GET /api/novidades` pública | `95d1c6d` |
| Sistema de onboarding guiado | `public/onboarding.html` — wizard 3 passos (Igreja/Logo → Membros → Caixa); 3 rotas em `accountRoutes.js`; redirect automático no `dashboard.html` para novos admins | `2308c18` |

---

## ⚙️ Servidor (cPanel) — estado atual

- **Último `git pull` no servidor:** pendente (rodar o comando abaixo)

```bash
cd /home/ldfp8965/ldfp.com.br && git pull && touch tmp/restart.txt
```

---

## 🏗️ Backlog — próximas funcionalidades (em ordem de prioridade)

- [ ] **Item 5 — Notificações push para membros** — integrar Web Push API ou WhatsApp Business
- [ ] **Item 6 — Relatório por membro** — histórico de dízimos, batismo, escala, grupos
- [ ] **Item 7 — Multi-congregáção** — painel para igrejas com múltiplas filiais

---

## 🔑 Dados de infraestrutura (NÃO commitar segredos novos aqui)

| Item | Valor |
|------|-------|
| Servidor | `/home/ldfp8965/ldfp.com.br/` |
| Banco MySQL | host `localhost`, banco `ldfp8965_sistema_gestao`, user `ldfp8965_Leo` |
| Domínio | `https://ldfp.com.br` |
| Restart servidor | `touch tmp/restart.txt` |
| Branch principal | `main` |

---

## 🧠 Contexto técnico importante

- **Arquivo servido do painel super-admin:** `public/super-admin.html` (NÃO o `super-admin.html` da raiz)
- **Arquivos da raiz NÃO são servidos:** `super-admin.html` e `ldfp-master.js` da raiz são ignorados pelo servidor
- **Servidor serve arquivos estáticos de:** `public/` via `express.static`
- **Auth:** JWT com campo `role`. Roles super-admin válidos: `super-admin`, `super_admin`, `superadmin`, `master`, `owner`, `root`
- **DB:** `pool.query()` em `src/config/db.js` — suporta MySQL (produção cPanel) e PostgreSQL (Neon)
- **session.js:** intercepta `window.fetch` globalmente, adiciona `Authorization: Bearer token`
- **Padrão sidebar admin:** cada página `admin-*.html` tem sidebar próprio com links diretos `href` (não SPA)
- **Role guard padrão nas páginas admin:**
  ```javascript
  const raw = sessionStorage.getItem('user') || localStorage.getItem('user');
  const p = raw ? JSON.parse(raw) : (window.getStoredAuth?.()?.user || null);
  const role = String(p?.role || p?.perfil || '').toLowerCase();
  if (!['super-admin','super_admin','superadmin','master','owner','root'].includes(role)) location.href = 'dashboard.html';
  ```

---

## 📝 Como atualizar este arquivo ao terminar uma sessão

1. Mova itens concluídos para a tabela **"O que já está feito"**
2. Atualize o **hash do último commit**
3. Atualize o estado do **Servidor**
4. Risque ou mova os itens do **Backlog** que foram concluídos
