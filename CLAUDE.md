# Sistema Gestão Igreja LDFP — Contexto para Claude

## O que é este projeto
SaaS multi-tenant de gestão para igrejas. Leonardo (você) é o dono do sistema (super admin). Cada cliente compra um plano e ganha um painel separado para gerenciar sua própria igreja.

## Arquitetura de papéis
| Papel | Acesso | Login |
|-------|--------|-------|
| Super Admin (Leonardo) | Painel SaaS: clientes, planos, módulos, métricas, senhas | `admin-master.html` |
| Admin da Igreja Cliente | Painel da igreja: membros, dízimos, escalas, etc. | `index.html` (login normal) |

O super admin **não acessa dados de clientes diretamente**. Para suporte, usa o botão "Acessar" em `admin-igrejas.html`, que gera um JWT temporário com o `igrejaId` do cliente (impersonação).

## Infraestrutura
- **Servidor:** cPanel em `/home/ldfp8965/`
- **Repo no servidor:** `/home/ldfp8965/sistema-gestao-igreja-ldfp-main` (só git pull aqui)
- **App em execução:** `/home/ldfp8965/ldfp.com.br/` (onde o Node roda de fato)
- **Banco MySQL 5.6:** `ldfp8965_sistema_gestao` — host `localhost`, user `ldfp8965_Leo`
- **Domínio:** `https://ldfp.com.br`
- **Repo GitHub:** `leofranper37/sistema-gestao-igreja-ldfp`, branch `main`
- **Restart Node:** `touch /home/ldfp8965/ldfp.com.br/tmp/restart.txt` (cPanel Passenger)
- **Script de deploy:** `~/deploy.sh` — faz git pull + copia src/, public/, app.js para ldfp.com.br/ + restart
- **Node.js env (se precisar npm install):** `source /home/ldfp8965/nodevenv/ldfp.com.br/18/bin/activate`

## Restrições críticas do banco (MySQL 5.6)
- NUNCA usar tipo `JSON` — usar `LONGTEXT`
- NUNCA usar `JSON_SET` no SQL
- Toda mudança de schema precisa ser rodada manualmente no phpMyAdmin de produção

## Banco de dados — tabela `igrejas`
| id | nome | is_system | papel |
|----|------|-----------|-------|
| 2 | LDFP Master | 1 | âncora do super admin — NÃO é cliente |
| 6+ | (clientes) | 0 | igrejas clientes reais |

- `is_system = 1` → ocultar de listas de clientes, métricas, KPIs
- Todas as queries de super admin em `igrejas` devem ter `WHERE is_system = 0`

## Auth JWT
- `localStorage['ldfpAuth']` = `{ token, user }`
- `localStorage['token']` = token puro (legado)
- `req.auth.igrejaId` sempre vem do banco (`usuarios.igreja_id`) via `requireAuth` — nunca do JWT
- **Super admin role:** `super-admin` (único valor aceito pelo middleware `authorize`)

## Layout enterprise (painel cliente)
- Requer `class="enterprise-shell-page"` no `<body>` de cada página
- `enterprise-shell.js` injeta sidebar (`<aside>`) e header via `insertAdjacentHTML('beforebegin')`
- CSS: `body { flex-direction: column }` + sidebar `position: fixed` (230px) + header `margin-left: 230px` + main `margin-left: 230px; width: calc(100% - 230px)`
- Sidebar colapsada → remove `margin-left` do header; mobile (< 1080px) → margin-left: 0

## Service Worker
- Arquivo: `public/sw.js`, versão atual `ldfp-v11`
- CSS/JS: network-first | Imagens/fontes: cache-first

## Regra de deploy (SEMPRE seguir)
1. Mudança só de código → `~/deploy.sh` no terminal do cPanel
2. Mudança de schema (ALTER TABLE, nova coluna, etc.) → rodar SQL no phpMyAdmin de produção PRIMEIRO, depois `~/deploy.sh`
3. Claude **sempre avisa** quando uma mudança exige SQL no banco de produção

## Páginas do super admin
`admin-master.html`, `admin-igrejas.html`, `admin-metricas.html`, `admin-relatorio-financeiro.html`, `admin-assinaturas.html`, `admin-usuarios.html`, `admin-modulos.html`, `admin-planos.html`, `admin-retomada.html`, `admin-sistema.html`, `admin-backup.html`, `admin-novidades.html`, `admin-inovacoes.html`

## Estado atual (21/06/2026)
- Commit em produção: `e8cc6de`
- Parte 1 (banco): ✅ `is_system` adicionado, Igreja Padrão deletada, LDFP Master marcada
- Parte 2 (filtro): ✅ `getSaasIgrejas` e `getSuperAdminOverview` filtram `is_system = 0`
- Parte 3 (middleware de bloqueio): 🔲 pendente
- Parte 4 (criar igreja pelo painel): 🔲 pendente
