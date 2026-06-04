# 📍 ONDE PAREI — Sistema Gestão Igreja LDFP

> Atualize este arquivo ao final de cada sessão de trabalho.
> Ao abrir o VS Code, comece por aqui.

---

## 🗓️ Última atualização: 04/06/2026

## ⏳ Commit pendente (pronto para envio)
- **Hash:** a ser gerado no próximo commit
- **Branch:** `main`
- **Repo:** `leofranper37/sistema-gestao-igreja-ldfp`
- **Mensagem:** `feat: modulo de acompanhamento e consolidacao de visitantes kanban`
- **Push:** pendente

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
| Relatório financeiro exportável | `GET /api/saas/relatorio-financeiro?mes=YYYY-MM[&formato=csv]` + `public/admin-relatorio-financeiro.html` — KPIs + tabela + botão Exportar CSV | `95d1c6d` |
| Tela de novidades para membros | Painel `#panel-novidades` + botão na bottom-nav + `loadNovidades()` em `app_membro_v2.html` | `95d1c6d` |
| Sistema de onboarding guiado | `public/onboarding.html` — wizard 3 passos; 3 rotas em `accountRoutes.js`; redirect automático no `dashboard.html` | `2308c18` |
| **Web Push Notifications** | `src/routes/pushRoutes.js` — VAPID auto-gerado via `sistema_config`, endpoints subscribe/unsubscribe/send; `push_subscriptions` no DB; banner "Ativar notificações" em `app_membro_v2.html`; `public/admin-push.html` | `9c4c8d1` |
| **Multi-Congregação (painel)** | `GET /congregacoes/painel` (retorna filiais + limite plano + disponível); reescrita de `public/congregacoes.html` — KPI cards, barra de uso do plano, card-grid para cada filial, CRUD modal conectado à API real | `2375419` |
| **Relatório por membro** | `GET /api/membros/:id/relatorio` — perfil, histórico de dízimos/ofertas, KPIs, gráfico mensal CSS, export CSV; `public/relatorio-membro.html`; botão "Relatório" em `membros.html` | `14f297e` |
| **Grupos & Células — API completa** | `CRIAR_TABELAS_GRUPOS.sql` (4 tabelas: grupos, grupo_membros, grupo_reunioes, congregados); `gruposController.js` (14 endpoints CRUD); `gruposRoutes.js`; fix `grupos.html` + `congregados.html` → `/api/*`; relatorio-membro exibe grupos do membro | `e2666d4` |
| **Batismos — API completa** | `CRIAR_TABELAS_BATISMOS.sql` (tabelas `batismos` + `batismo_candidatos`); `batismosController.js` (8 endpoints CRUD); `batismosRoutes.js`; migração completa `batismos.html` + `batismo_novo.html` (localStorage→API); relatorio-membro exibe candidaturas; select inline de status no painel de candidatos | `70f29ea` |
| **Escalas de Serviço — API completa** | `CRIAR_TABELAS_ESCALAS.sql` (6 tabelas); `escalasController.js` (20 endpoints: dashboard, eventos recorrentes, instâncias, grupos, funções, matriz, atribuições, conflitos, membros); `escalasRoutes.js`; fix `escalas.html` → `/api/escalas/membros`; relatorio-membro exibe histórico de escalas | `3e0ec95` |
| **EBD — API completa** | Tabelas `ebd_turmas`, `ebd_alunos`, `ebd_grades`; `ebdController.js` (CRUD completo); `ebdRoutes.js`; migração de `ebd_turmas.html`, `ebd_alunos.html`, `ebd_grades.html` | `9e03649` |
| **Crianças — API completa** | Tabela `criancas`; `criancasController.js` (CRUD + audit logs); `criancasRoutes.js`; migração de `criancas.html`; auditoria de create/update/delete | `bed1f05` |
| **Dashboard com gráficos reais** | `dashboardController.js` — 12 queries paralelas (totais, recentes, gráficos, aniversariantesMes); `dashboardRoutes.js`; Chart.js 4.4 em `dashboard.html` | `f894552` |
| **Configurações da Igreja** | `configuracoes.html` — logo upload, nome, endereço, telefone, CNPJ, redes sociais; rota `PUT /api/church/configuracoes`; `configuracoes.html` migrado | `11926e7` |
| **Rate limiting + Audit logs** | `express-rate-limit`: loginRateLimiter (10 req/15min) + apiRateLimiter (300 req/15min); `auditService.js` (fire-and-forget via setImmediate, tabela `audit_logs` LONGTEXT); `auditRoutes.js` (GET /api/audit-logs, paginado); audit em batismos e crianças; compatível MySQL 5.6 | `9cf023b` |
| **Health check detalhado** | `GET /health` (não `/api/health`) — status, uptime, memória, database, node; `getDbHealth()` em `systemModel.js` | `831def1` |
| **Dashboard moderno** | Hero de saudação dinâmico (nome do usuário, data, emoji por horário); stat-cards redesenhados (ícone gradiente + valor 900-weight); seção "Aniversariantes do Mês" (scroll horizontal com foto/iniciais); members-grid com cards de foto; modal de credencial do membro (foto, e-mail, cidade, data cadastro, link ficha) | `d9adedb` |
| **Skeleton Loading & UI Polish** | Classes `.skeleton-box`, `.skeleton-text`, `.skeleton-title` globais no `style.css`; aplicados no `dashboard.html` e na lista do `criancas.html` para evitar FOUC (piscar) durante fetch assíncrono. | pendente |
| **Webhook Auto-Deploy** | Rota `POST /webhook` (`webhookRoutes.js` e `app.js`) usando `child_process.exec` para rodar `git pull` e `touch tmp/restart.txt` no servidor cPanel. | pendente |
| **Integração PIX (QR Code)** | Rota `POST /api/pix/gerar` em `pixRoutes.js` + `pixController.js`. Interface adicionada em modal via `app_membro_v2.html` gerando PIX Copia e Cola via API MercadoPago. | pendente |
| **Visitantes — Funil Kanban** | Tabela `visitante_followup` + adição de status na tabela existente; `visitantesFollowupController.js` (CRUD do Kanban + interações de ligações/mensagens); HTML5 Drag and Drop na tela `visitantes_kanban.html`. | pendente |
| **LDFP Bíblia & Estudo — Backend** | `CRIAR_TABELAS_ESTUDO.sql` (7 tabelas), `estudoController.js` (CRUD versões, passagens, anotações, favoritos, planos, devocionais), `estudoRoutes.js` protegido por role guard. `seed-biblia.js` importando João Cap. 1 (ARC). Adicionado 'estudo' em `CRIAR_TABELAS_MODULOS.sql`, `enterprise-shell.js` e `roles.js`. | pendente |
| **LDFP Bíblia & Estudo — Frontend** | `estudo.html` (leitor interativo + devocional do dia), `devocionais.html` (Admin gerenciar devocionais + Send Push via API VAPID), `admin-planos-estudo.html` (Admin gerenciar planos com conversor linha/passo), `planos-estudo.html` e `plano-detalhe.html` (Membro gerencia progresso no plano). | pendente |

---

## 🧪 Sessão atual — alterações locais ainda não commitadas

- Módulo Kanban de Consolidação de Visitantes e Histórico de Follow-up (ligações, mensagens) com Drag and Drop funcional.

---

## ⚙️ Servidor (cPanel) — estado em 04/06/2026

| Etapa | Status |
|-------|--------|
| Código em produção (`git pull`) | ⏳ após push (via Webhook Automático) |
| SQL do Módulo de Estudo | ⏳ Necessário importar `CRIAR_TABELAS_ESTUDO.sql` via phpMyAdmin ou SSH no cPanel após o push |
| Restart Node | ✅ `touch tmp/restart.txt` |
| Health check | ✅ `GET https://ldfp.com.br/health` → `status: ok`, MariaDB `up` |

**Tabelas confirmadas em produção:** `batismos`, `batismo_candidatos`, `grupos`, `grupo_membros`, `grupo_reunioes`, `congregados`, `escalas_grupos`, `escalas_funcoes`, `escalas_eventos`, `escalas_evento_funcoes`, `escalas_instancias`, `escalas_atribuicoes`. **Aguardando importação do SQL de Estudos.**

**Próximo deploy (após push):**

```powershell
cd d:\sistema-gestao-igreja-main
git push origin main
```

```bash
cd /home/ldfp8965/ldfp.com.br && git pull origin main && touch tmp/restart.txt
```

**Pendência de segurança:** trocar senha MySQL (exposta no terminal durante o deploy) e atualizar `.env` + Restart no Setup Node.js App.

---

## 🏗️ Backlog — próximas funcionalidades sugeridas

Todos os 9 itens originais foram concluídos. Possíveis próximos passos:

| # | Módulo | Descrição | Status |
|---|--------|-----------|--------|
| 1 | **Batismos** | backend + migração localStorage→API | ✅ `70f29ea` |
| 2 | **Escalas de Serviço** | backend + migração escalas.html | ✅ `3e0ec95` |
| 3 | **Grupos & Células** | API completa + congregados | ✅ `e2666d4` |
| 4 | **EBD** | Escola Bíblica Dominical | ✅ `9e03649` |
| 5 | **Crianças** | API completa + audit | ✅ `bed1f05` |
| 6 | **Dashboard gráficos** | Chart.js + dados reais | ✅ `f894552` |
| 7 | **Configurações da Igreja** | Logo, dados, redes sociais | ✅ `11926e7` |
| 8 | **Rate limiting + Audit logs** | Segurança + rastreabilidade | ✅ `9cf023b` |
| 9 | **Health check detalhado** | Monitoramento de saúde | ✅ `831def1` |
| 10 | **Dashboard moderno** | Hero, fotos, modal credencial | ✅ `d9adedb` |
| — | **Notificações push (VAPID)** | Alertas para membros via app | ✅ `9c4c8d1` |
| — | **Módulo de Visitantes completo** | Acompanhamento Kanban e follow-up detalhado. | ✅ `sessao-atual` |
| — | **Integração PIX automática** | Dízimo via QR Code PIX (Mercado Pago) no app do membro. | ✅ `sessao-atual` |
| — | **LDFP Bíblia & Estudo** | App ensino bíblico integrado ao membro — visão + MVP em `docs/LDFP-ESTUDO-VISAO.md` | 📋 Planejamento |


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

- **MySQL 5.6 no cPanel:** NUNCA usar tipo `JSON` — usar `LONGTEXT`. NUNCA usar `JSON_SET` no SQL — fazer merge no JavaScript. `pool.query()` retorna `[rows, fields]`.
- **Arquivo servido do painel super-admin:** `public/super-admin.html` (NÃO o `super-admin.html` da raiz)
- **Arquivos da raiz NÃO são servidos:** `super-admin.html` e `ldfp-master.js` da raiz são ignorados
- **Servidor serve arquivos estáticos de:** `public/` via `express.static`
- **Auth:** JWT com campo `role`. Roles super-admin válidos: `super-admin`, `super_admin`, `superadmin`, `master`, `owner`, `root`
- **DB:** `pool.query()` em `src/config/db.js` — suporta MySQL (produção cPanel) e PostgreSQL (Neon)
- **session.js:** intercepta `window.fetch` globalmente, adiciona `Authorization: Bearer token`
- **`req.auth`:** `id`, `igrejaId`, `email`, `role` — definidos em `src/middlewares/auth.js`
- **Audit service:** `src/services/auditService.js` — `audit(action, req, details)` — fire-and-forget via `setImmediate`; cria tabela `audit_logs` automaticamente se não existir
- **Rate limiting:** `loginRateLimiter` (10 req/15min) em rotas de auth; `apiRateLimiter` (300 req/15min) em `/api/`
- **Health em produção:** `curl -s https://ldfp.com.br/health` — Node v20, MariaDB 10.11
- **MySQL no SSH:** usar `ldfp8965_Leo` + banco `ldfp8965_sistema_gestao` (credenciais do `.env`); `npm` no SSH costuma não existir — usar **Setup Node.js App** no cPanel
- **Dashboard controller:** 12 queries paralelas com `Promise.all`; retorna `totais`, `recentes` (com `foto_url`), `graficos`, `aniversariantesMes`
- **Botão Painel Admin no dashboard:** lê role do payload JWT (não localStorage) — apenas `super-admin` vê
- **Padrão role guard nas páginas admin:**
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
