# 📍 ONDE PAREI — Sistema Gestão Igreja LDFP

> Atualize este arquivo ao final de cada sessão de trabalho.
> Ao abrir o VS Code, comece por aqui.

---

## 🗓️ Última atualização: 20/06/2026

## 📌 Último commit em produção
- **Hash:** `e07bfcb`
- **Branch:** `main`
- **Deploy executado:** `git pull && cp -r public/* ~/public_html/ && touch tmp/restart.txt`

---

## 🔴 PENDÊNCIAS CRÍTICAS (resolver na próxima sessão)

### 1. Layout do painel cliente ainda quebrado no servidor (ldfp.com.br)
**Causa:** O Service Worker está cacheando o `style.css` antigo no browser do usuário.
**O que foi feito:** SW atualizado para v11 + estratégia network-first para CSS/JS (commit `54d401c`).
**O que FALTA fazer no browser:**
- No Chrome em ldfp.com.br → F12 → Application → Service Workers → **Unregister** → recarregar
- OU: F12 → Application → Local Storage → selecionar tudo → Delete → recarregar (resolve também o "pedro da cunha")

### 2. "Pedro da cunha" aparecendo no cabeçalho
**Causa:** JWT antigo de usuário de teste ainda salvo no `localStorage` (`ldfpAuth` + `token`).
**Solução:** Limpar o Local Storage conforme passo acima e logar com `leopereita31@gmail.com`.

### 3. Cadastro de membros vai para igreja errada (igrejaId=2 em vez do cliente)
**Causa:** Super admin (igrejaId=2) acessa o painel do cliente sem trocar de sessão — tudo vai para a igreja 2.
**O que foi feito:** Criado endpoint `POST /api/saas/igrejas/:id/impersonate` + botão verde **"Acessar"** na página `admin-igrejas.html`.
**Como usar:**
1. Super admin → Igrejas & Clientes (`admin-igrejas.html`)
2. Clicar em **"Acessar"** na linha da igreja desejada (ex: id=6)
3. Abre nova aba já logado como aquela igreja (JWT com igrejaId correto)
4. Criar membros nessa aba → vão para o igrejaId certo

---

## ✅ O que foi feito HOJE (20/06/2026)

| Item | Descrição | Commit |
|------|-----------|--------|
| Limpeza dados de teste | Removidos todos os dados de igrejas/usuários de teste. Mantidos: super-admin id=1 (LEONARDO), igreja id=2 (LDFP Master) | phpMyAdmin |
| 50 páginas HTML corrigidas | Adicionada classe `enterprise-shell-page` no `<body>` de 50 páginas — sem ela o sidebar não ficava `position:fixed` e o header aparecia no lugar errado | `ace9281` |
| Limpeza `saas_modulos` / `saas_plano_modulos` | Tabelas zerradas (17 linhas excluídas). Super admin gerencia módulos pelo painel | phpMyAdmin |
| Botão ☰ de colapso da sidebar | `enterprise-shell.js` atualizado — no desktop recolhe/expande a sidebar; no mobile abre/fecha. Ícone muda entre `fa-bars` e `fa-bars-staggered` | `92e7443` |
| Visual da sidebar melhorado | Sidebar compacta inspirada no Zeke (230px, itens menores, avatar 34px teal, padding reduzido, sub-menus Membros/Escalas/EBD/Batismos) | `92e7443` |
| Correção layout header enterprise | Raiz do bug: `body { display: flex }` (row) fazia o `<header>` aparecer como coluna ao lado do `<main>`. Fix: `flex-direction: column` no body enterprise + `margin-left: var(--enterprise-sidebar-width)` no header | `9f58ace` |
| Colapso do header sincronizado | Estado `sidebar-collapsed` agora também remove o `margin-left` do header. Media query mobile (< 1080px) zera o margin-left | `9f58ace` |
| Service Worker v11 | Bumped `ldfp-v10` → `ldfp-v11` para forçar invalidação do cache | `204e4a2` |
| SW network-first para CSS/JS | CSS e JS agora sempre buscados do servidor (network-first). Apenas imagens/fontes ficam em cache-first. Evita que atualizações de CSS/JS fiquem presas no cache | `54d401c` |
| Impersonação de igreja | `POST /api/saas/igrejas/:id/impersonate` — gera JWT 12h com igrejaId do cliente. Se não existir usuário admin na igreja, cria automaticamente. Botão verde "Acessar" adicionado em `admin-igrejas.html` | `e07bfcb` |

---

## ✅ O que já estava feito (sessões anteriores)

| Item | Descrição | Commit |
|------|-----------|--------|
| Script backup por igreja | `scripts/backup-por-igreja.js` | `631236b` |
| Isolamento rotas super-admin | `isSuperAdmin` middleware | `631236b` |
| API + UI backup/recuperação | `backupController.js` + `admin-backup.html` | `631236b` |
| Role guard 6 páginas admin | `admin-modulos`, `admin-assinaturas`, etc. | `8ed84bd` |
| SQL migration módulos | `CRIAR_TABELAS_MODULOS.sql` | `8ed84bd` |
| Webhook Mercado Pago | HMAC-SHA256 validação | `ecdd704` |
| Backend métricas SaaS | MRR, churn, ARPU, gráficos | `d4b704f` |
| Página admin-metricas.html | KPIs + 3 gráficos CSS | `fed8ef9` |
| Relatório financeiro exportável | CSV + KPIs + `admin-relatorio-financeiro.html` | `95d1c6d` |
| Onboarding guiado | `onboarding.html` — wizard 3 passos | `2308c18` |
| Web Push Notifications | VAPID, subscribe/unsubscribe, `admin-push.html` | `9c4c8d1` |
| Multi-Congregação | `congregacoes.html` — KPI cards, CRUD modal | `2375419` |
| Relatório por membro | `GET /api/membros/:id/relatorio` + CSV | `14f297e` |
| Grupos & Células | 4 tabelas, 14 endpoints CRUD | `e2666d4` |
| Batismos | 8 endpoints CRUD, migração localStorage→API | `70f29ea` |
| Escalas de Serviço | 6 tabelas, 20 endpoints | `3e0ec95` |
| EBD | CRUD completo, 3 telas migradas | `9e03649` |
| Crianças | CRUD + audit logs | `bed1f05` |
| Dashboard com gráficos reais | Chart.js 4.4, 12 queries paralelas | `f894552` |
| Configurações da Igreja | Logo, dados, redes sociais | `11926e7` |
| Rate limiting + Audit logs | express-rate-limit + audit_logs | `9cf023b` |
| Health check detalhado | `GET /health` — status, uptime, DB | `831def1` |
| Dashboard moderno | Hero dinâmico, stat-cards, aniversariantes | `d9adedb` |
| Visitantes Kanban | Funil drag-and-drop + follow-up | concluído |
| LDFP Bíblia & Estudo | Frontend: estudo.html, devocionais.html, planos-estudo.html | pendente push |

---

## ⚙️ Servidor (cPanel) — estado em 20/06/2026

| Etapa | Status |
|-------|--------|
| Código em produção | ✅ commit `e07bfcb` deployado |
| `cp -r public/* ~/public_html/` | ✅ executado |
| Restart Node (`touch tmp/restart.txt`) | ✅ executado |
| Cache do browser do usuário | ⚠️ PRECISA limpar SW + localStorage no Chrome |

**Caminho do repo no servidor:** `~/sistema-gestao-igreja-ldfp-main`
**Caminho dos arquivos públicos:** `~/public_html/`

**Comando de deploy:**
```bash
cd ~/sistema-gestao-igreja-ldfp-main && git pull && cp -r public/* ~/public_html/ && touch tmp/restart.txt
```

---

## 🏗️ Próximas tarefas (backlog)

| # | Tarefa | Prioridade |
|---|--------|-----------|
| 1 | Limpar SW + localStorage no Chrome (ldfp.com.br) — confirmar que layout ficou correto | 🔴 Alta |
| 2 | Testar botão "Acessar" no admin-igrejas.html → criar membro → confirmar que vai para igrejaId correto | 🔴 Alta |
| 3 | Testar cadastro de membros completo (formulário, validação, lista) | 🔴 Alta |
| 4 | Layout das demais páginas do painel do cliente (membros, agenda, etc.) | 🟡 Média |
| 5 | Outras funcionalidades que o usuário mencionou querer resolver | 🟡 Média |

---

## 🧠 Contexto técnico importante

- **MySQL 5.6 no cPanel:** NUNCA usar tipo `JSON` — usar `LONGTEXT`. NUNCA usar `JSON_SET` no SQL.
- **Caminho dos arquivos:** repo em `~/sistema-gestao-igreja-ldfp-main`, servidos de `~/public_html/`
- **Auth JWT:** `localStorage['ldfpAuth']` = `{ token, user }`. `localStorage['token']` = token puro (legado).
- **enterprise-shell.js:** injeta `<aside>` (sidebar) e `<header>` ANTES do `<main>` via `insertAdjacentHTML('beforebegin', ...)`. Requer classe `enterprise-shell-page` no `<body>`.
- **Layout enterprise:** body tem `display: flex` (base). Para páginas enterprise: `flex-direction: column` + sidebar `position: fixed` + header `margin-left: 230px` + main `margin-left: 230px; width: calc(100% - 230px)`.
- **Service Worker:** `public/sw.js` — CSS/JS usam network-first. Versão atual: `ldfp-v11`.
- **Impersonação:** `POST /api/saas/igrejas/:id/impersonate` (requer role super-admin) → retorna `{ token, user }` com igrejaId do cliente.
- **`req.auth.igrejaId`:** sempre vem do banco (`usuarios.igreja_id`) pelo middleware `requireAuth`. Não depende do JWT.
- **Super admin role:** aceita `super-admin`, `super_admin`, `superadmin`, `master`, `owner`, `root`.
- **Servidor serve estáticos de:** `public/` via `express.static`.
- **Restart servidor:** `touch tmp/restart.txt` (cPanel Passenger).

---

## 🔑 Infraestrutura

| Item | Valor |
|------|-------|
| Servidor | `/home/ldfp8965/` |
| Banco MySQL | host `localhost`, banco `ldfp8965_sistema_gestao`, user `ldfp8965_Leo` |
| Domínio | `https://ldfp.com.br` |
| Repo GitHub | `leofranper37/sistema-gestao-igreja-ldfp` |
| Branch principal | `main` |
| Email super admin | `leopereita31@gmail.com` |
