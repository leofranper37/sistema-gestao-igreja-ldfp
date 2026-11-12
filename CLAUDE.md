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
- Arquivo: `public/sw.js`, versão atual `ldfp-v13`
- CSS/JS: network-first | Imagens/fontes: cache-first

## Regra de deploy (SEMPRE seguir)
1. Mudança só de código → `~/deploy.sh` no terminal do cPanel
2. Mudança de schema (ALTER TABLE, nova coluna, etc.) → rodar SQL no phpMyAdmin de produção PRIMEIRO, depois `~/deploy.sh`
3. Claude **sempre avisa** quando uma mudança exige SQL no banco de produção

## Páginas do super admin
`admin-master.html`, `admin-igrejas.html`, `admin-metricas.html`, `admin-relatorio-financeiro.html`, `admin-assinaturas.html`, `admin-usuarios.html`, `admin-modulos.html`, `admin-planos.html`, `admin-retomada.html`, `admin-sistema.html`, `admin-backup.html`, `admin-novidades.html`, `admin-inovacoes.html`

## Estado atual (21/06/2026)
- Commit em produção: `a322038`
- Parte 1 (banco): ✅ `is_system` adicionado, Igreja Padrão deletada, LDFP Master marcada (is_system=1)
- Parte 2 (filtro): ✅ `getSaasIgrejas` e `getSuperAdminOverview` filtram `is_system = 0`
- Parte 3 (churchGuard): ✅ super-admin bloqueado de rotas de dados de igreja — usa botão "Acessar" para suporte
- Parte 4 (criar igreja): ✅ `POST /api/saas/igrejas` + modal "Nova Igreja" em admin-igrejas.html
- Isolamento confirmado: membro criado em igreja id=8 foi para `igreja_id=8` ✅

## Banco de dados — estado limpo (21/06/2026)
- `igrejas`: apenas id=2 (LDFP Master, is_system=1) + igrejas de clientes reais
- `membros`: dados isolados por `igreja_id` — confirmado funcionando
- `usuarios`: super-admin id=1 (leopereita31@gmail.com, igreja_id=2)
- Seed de "Igreja Padrão" removida do db.js — não volta mais no restart
- Usuários órfãos (igreja deletada) devem ser limpos com: `DELETE FROM usuarios WHERE igreja_id NOT IN (SELECT id FROM igrejas) AND role != 'super-admin'`

## Inovações — Lote 1 (11/11/2026, inspirado no Zeke)
- Dashboard configurável (`dashboard.html`, botão "Personalizar"; layout salvo no localStorage por usuário)
- Escalas: confirmação de disponibilidade (`escalas_atribuicoes.status`) — matriz colorida + "Minhas Escalas" no App do Membro (`/api/escalas/minhas`)
- Orações: testemunho de oração respondida (`oracoes_pedidos.testemunho`) + aba Testemunhos; pastor agora pode responder
- Editor de cartas/certificados (`cartas.html`, `src/routes/documentosRoutes.js`, tabela `documentos_modelos`)
- **SQL pendente em produção:** `INOVACOES_LOTE1_2026-11.sql` (rodar ANTES do deploy)

## Inovações — Lote 2: Acesso do Membro (11/11/2026)
- `acesso_membro.html` (admin): QR Code, código de 6 caracteres (= início do `igrejas.public_token`) e link `autocadastro.html?c=<token>`
- `autocadastro.html` (público): ficha completa → `POST /api/ficha` (`src/routes/fichaMembroRoutes.js`); igreja resolvida pelo código, nunca pelo navegador
- Aprovação: se o CPF já existe na igreja, ATUALIZA o membro em vez de duplicar; com CPF o membro entra no App
- App do Membro → Mais → Meus Dados (`GET/PUT /api/ficha/meus-dados`; CPF não editável)
- `POST /autocadastro` antigo desativado (410): mandava tudo para igreja_id=1
- **SQL pendente em produção:** `INOVACOES_LOTE2_ACESSO_MEMBRO.sql`
- Próximos candidatos: Mural com comentários/reações, verificação em duas etapas, cadastro configurável, cursos/materiais, login Google

## Inovações — Lote 3: Relatórios e Gráficos reais (11/11/2026)
- Antes: `relatorios_secretaria/tesouraria.html` e `graficos_*.html` mostravam números FIXOS no código (falsos)
- API somente leitura: `src/routes/relatoriosRoutes.js` + `src/services/relatoriosService.js` (`/api/relatorios/secretaria/*`, `/api/relatorios/tesouraria/*`), sempre por `req.auth.igrejaId`
- Front compartilhado: `public/relatorios-core.js` (window.RL: tabela, CSV `;` p/ Excel, imprimir/PDF, Chart.js) + `public/relatorios.css`
- Receita = dízimos/ofertas + entradas caixa + entradas banco; Despesa = saídas caixa + saídas banco + contas pagas (lançamento duplicado entre módulos soma 2x)
- **Sem SQL** — não altera schema

## Inovações — Lote 4: Relatórios Contábeis (11/11/2026)
- `relatorios_contabilidade.html` refeito (antes lia localStorage): Livro Diário, Razão, Balancete de Verificação, Balanço Patrimonial, DRE, Resumo Anual (DRE mês a mês), Fluxo de Caixa (método direto contábil OU base Tesouraria) e DMPL
- Service: `src/services/relatoriosContabeisService.js`, rotas `/api/relatorios/contabil/*` (em `relatoriosRoutes.js`)
- `contabilidade_lancamentos.conta_debito/credito` são TEXTO LIVRE → casados com o plano pelo código no início do texto ou pelo nome; o que não casar aparece no diagnóstico ("fora do plano"); natureza inferida pelo 1º dígito (1 ativo, 2 passivo, 3 receita, 4 despesa)
- Patrimônio Social = conta passivo cujo nome (ou da conta-mãe) contém Patrimônio/Superávit/Déficit/Reserva; Caixa = ativo com código 1.1.1* ou nome Caixa/Banco/Disponível/Aplicação
- Balancete de abertura = saldos antes de qualquer lançamento; Encerramento do Exercício continua só um registro (não zera contas de resultado — resultado anterior vira "superávits acumulados" no Balanço)
- `lancamentos_contabeis.html`: datalist com as contas do plano + histórico escapado (XSS)
- **Sem SQL**
- Próximo: Lote 5 (fornecedores, centros de custo, tipos de documento — exige SQL); SPED/ECD/ECF deixados por último

## Fluxo para criar novo cliente
1. Super admin → admin-igrejas.html → botão "Nova Igreja"
2. Preenche: nome, plano, email admin, senha, responsável, telefone
3. Sistema cria: registro em `igrejas` + usuário admin em `usuarios`
4. Cliente loga com email/senha fornecidos → acessa painel da própria igreja
5. Tudo que o cliente cadastra vai para o `igrejaId` dele
