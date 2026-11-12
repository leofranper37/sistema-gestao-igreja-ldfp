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
- `contabilidade_lancamentos.conta_debito/credito` são TEXTO LIVRE → casados com o plano pelo código no início do texto ou pelo nome; o que não casar aparece no diagnóstico ("fora do plano"); natureza inferida pelo 1º dígito (1 ativo, 2 passivo, 3 despesa, 4 receita — padrão do sistema: 4.01.01.01 Dízimo de Membros)
- Patrimônio Social = conta passivo cujo nome (ou da conta-mãe) contém Patrimônio/Superávit/Déficit/Reserva; Caixa = ativo com código 1.1.1* ou nome Caixa/Banco/Disponível/Aplicação
- Balancete de abertura = saldos antes de qualquer lançamento; Encerramento do Exercício continua só um registro (não zera contas de resultado — resultado anterior vira "superávits acumulados" no Balanço)
- `lancamentos_contabeis.html`: datalist com as contas do plano + histórico escapado (XSS)
- **Sem SQL**

## Inovações — Lote 5: Cadastros da Tesouraria (11/11/2026)
- Tabelas `fornecedores`, `centros_custo`, `tipos_documento` (por `igreja_id`, desativação lógica `ativo=0`)
- Colunas de vínculo: `contas_pagar.fornecedor_id/centro_custo_id/tipo_documento_id/numero_documento`, `caixa_lancamentos.centro_custo_id/fornecedor_id`, `banco_lancamentos.centro_custo_id/fornecedor_id`
- API: `/api/tesouraria/{fornecedores|centros-custo|tipos-documento}` (`src/routes/cadastrosTesourariaRoutes.js`, `src/models/cadastrosTesourariaModel.js`)
- `validarVinculos()` impede uma igreja usar cadastro de outra (400) — usado em Contas a Pagar, Caixa e Bancos
- `ensureTabelas()/ensureColunas()` criam tabelas/colunas se o SQL não tiver sido rodado (rede de segurança), mas o oficial é o SQL
- Tela `tesouraria_cadastros.html` (menu Tesouraria → "Fornecedores e Centros de Custo"); selects via `public/cadastros-tesouraria.js`
- Relatório "Despesas por centro de custo / fornecedor" + gráfico por centro de custo; filtro "Vencido" de Contas a Pagar corrigido (status `vencido` é gravado no banco por `markVencidas`)
- `contas_pagar` no SQLite local criava `id` NULL (SERIAL) → corrigido com DDL por dialeto (produção MySQL não muda)
- Testes: `tests/lote5-tesouraria.test.js` (22 testes, inclui isolamento + smoke dos relatórios dos Lotes 3/4)
- **SQL pendente em produção:** `INOVACOES_LOTE5_CADASTROS_TESOURARIA.sql`
- Próximo: estados civis / locais de frequência configuráveis; Lote 6 (Mural, cursos/eventos com inscrição, carteirinha, dirigentes, login Google, 2FA); SPED/ECD/ECF por último

## Inovações — Lote 6: Mural, Inscrição em Eventos, Carteirinha (11/11/2026)
- **Mural** (`src/routes/muralRoutes.js`, `/api/mural/*`): mesmas rotas para equipe e membro (diferencia por `req.auth.app_mode`). Moderam: admin/secretaria/pastor. Tabelas `mural_posts`, `mural_comentarios`, `mural_reacoes` (amem/orando/gratidao/curtir, 1 por pessoa), `mural_denuncias`, `mural_config` (membros_publicam, exige_aprovacao, comentarios — padrão tudo 1)
- Telas: `mural.html` (painel: regras, publicar/fixar, aprovar/ocultar, comentários, denúncias) + painel `panel-mural` no `app_membro_v2.html` (Início e Mais → Comunidade)
- **Eventos com inscrição** (`src/routes/eventosInscricaoRoutes.js`): colunas `agenda_eventos.inscricao_aberta/vagas/inscricao_ate` + tabela `evento_inscricoes` (UNIQUE evento+membro, status inscrito/cancelado, presença). App: `POST/DELETE /api/app/eventos/:id/inscricao`; `GET /api/app/eventos` agora traz `inscricao` (vagas, prazo, `minha`). Equipe: `/api/eventos-inscricao/*` → tela `eventos_inscricoes.html` (botão "Inscrições" em cada evento da `agenda.html`; CSV e lista de presença para imprimir)
- **Carteirinha** (`src/routes/carteirinhaRoutes.js`, SEM tabela): QR = `verificar_carteirinha.html?t=<igrejaId>-<membroId>-<HMAC>` (segredo derivado do JWT_SECRET — trocar o JWT_SECRET invalida as carteirinhas impressas). Verificação pública `GET /api/carteirinha/verificar/:token` devolve só nome, cargo, situação, matrícula e igreja (LGPD). Impressão em lote CR80 (10 por A4) em `carteirinhas.html`; versão digital no App usa `GET /api/carteirinha/minha`
- `agendaModel`: DDL reordenada (MySQL → SQLite → PG) — antes o SQLite local criava `id` NULL
- Rede de segurança: `src/models/lote6Schema.js` (`ensureMural`, `ensureEventos`)
- Testes: `tests/lote6-mural-eventos-carteirinha.test.js` (27 testes, inclui isolamento entre igrejas)
- **SQL pendente em produção:** `INOVACOES_LOTE6_MURAL_EVENTOS_CARTEIRINHA.sql`
- Adiado (lote próprio): login com Google (precisa de credenciais Google Cloud)

## Inovações — Lote 7: Verificação em duas etapas (11/11/2026)
- TOTP (RFC 6238, 6 dígitos, 30 s, janela ±1) sem dependência externa: `src/services/doisFatoresService.js`. Funciona com Google/Microsoft Authenticator, Authy
- Colunas em `usuarios`: `totp_secret` (CRIPTOGRAFADO AES-256-GCM; chave = env `TWO_FACTOR_KEY` ou derivada do `JWT_SECRET`), `totp_ativo`, `totp_recuperacao` (hashes SHA-256 de 10 códigos de uso único), `totp_ultimo_passo` (anti-reuso), `totp_ativado_em`
- Login: `POST /login` com 2FA ativo devolve `{ requer_2fa, desafio }` SEM token → `POST /login/2fa { desafio, codigo }` devolve o token. Desafio = JWT de 5 min assinado com chave PRÓPRIA (não serve de sessão), máx. 5 tentativas
- Telas: `login.html` e `super_admin_login.html` pedem o código; `seguranca.html` (menu LDFP → "Segurança da Conta"; super admin: admin-master → "Minha Segurança (2FA)") ativa/desliga e gera códigos de recuperação
- Super admin desliga o 2FA de um usuário em `admin-usuarios.html` (`POST /api/saas/usuarios/:id/2fa/desativar`). `/api/2fa/` liberado no churchGuard
- `adminLoginController` (/api/admin/login) estava quebrado (importava pool/audit errado) e logava a senha — corrigido, mas a rota continua NÃO montada (`admin-login.html` é órfã)
- Trocar `JWT_SECRET`/`TWO_FACTOR_KEY` invalida os segredos 2FA → entrar com código de recuperação. Emergência: SQL no fim de `INOVACOES_LOTE7_VERIFICACAO_DUAS_ETAPAS.sql`
- Testes: `tests/lote7-dois-fatores.test.js` (13, inclui vetor oficial da RFC)
- **SQL pendente em produção:** `INOVACOES_LOTE7_VERIFICACAO_DUAS_ETAPAS.sql`

## Inovações — Lote 8: Login com Google (11/11/2026)
- Google Identity Services no `login.html` (botão só aparece com `GOOGLE_CLIENT_ID` no `.env`; `GET /api/auth/google/config`)
- `POST /login/google { credential }` → `src/services/googleAuthService.js` confere o ID token RS256 com as chaves públicas do Google (cache), audiência = nosso Client ID, emissor e `email_verified`
- Sem autocadastro: entra quem já é usuário do painel — por `usuarios.google_sub` (vínculo) ou, no 1º acesso, pelo e-mail (aí grava o vínculo). Mesmo e-mail com outra conta Google → 401. Super-admin NÃO entra com Google
- 2FA continua valendo (Google devolve o mesmo `requer_2fa`/desafio do `/login`)
- `seguranca.html` → "Entrar com Google": vincular outra conta Google (pode ser Gmail diferente do e-mail do LDFP) / desvincular (pede senha). Rotas `GET/POST/DELETE /api/minha-conta/google`
- helmet: `crossOriginOpenerPolicy: same-origin-allow-popups` (necessário para a janela do Google)
- Colunas `usuarios.google_sub` (UNIQUE), `google_email`, `google_vinculado_em`
- Testes: `tests/lote8-login-google.test.js` (10; chaves RSA locais no lugar das do Google)
- **SQL pendente em produção:** `INOVACOES_LOTE8_LOGIN_GOOGLE.sql` + configurar `GOOGLE_CLIENT_ID` no `.env` do servidor (`/home/ldfp8965/ldfp.com.br/.env`) e reiniciar

## Repositório local
- Clone git real: `G:\sistema-gestao-igreja-main` (branch `main`). A cópia em `OneDrive\Imagens\sistema-gestao-igreja-ldfp-main` NÃO é repositório — não editar lá.

## Fluxo para criar novo cliente
1. Super admin → admin-igrejas.html → botão "Nova Igreja"
2. Preenche: nome, plano, email admin, senha, responsável, telefone
3. Sistema cria: registro em `igrejas` + usuário admin em `usuarios`
4. Cliente loga com email/senha fornecidos → acessa painel da própria igreja
5. Tudo que o cliente cadastra vai para o `igrejaId` dele
