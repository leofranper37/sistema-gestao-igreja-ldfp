# LDFP Bíblia & Estudo — Visão de Produto e Roadmap Técnico

> Documento de referência para o aplicativo de ensino bíblico integrado ao **Sistema de Gestão de Igrejas LDFP**.  
> Status: **planejamento** (não implementado).  
> Última atualização: 04/06/2026

---

## 1. Resumo executivo

Desenvolver um aplicativo de ensino bíblico **multifuncional**, integrado ao LDFP, que una leitura das Escrituras, devocionais, planos de leitura, biblioteca digital e ferramentas comunitárias — inspirado nas melhores práticas de apps do mercado (YouVersion, Logos, Bible.is), mas com **identidade LDFP** e **conteúdo da igreja local**.

**Estratégia de entrega:** quatro fases incrementais. A Fase 1 (MVP) é um **módulo PWA web** no mesmo domínio (`ldfp.com.br`), reutilizando JWT, `session.js` e o app do membro — sem depender de lojas de aplicativos.

---

## 2. Nome e marca

| Nome | Uso sugerido |
|------|----------------|
| **LDFP Bíblia & Estudo** | Nome provisório / documentação interna |
| **Palavra Viva LDFP** | Marca devocional (app store, marketing) |
| **LDFP Escrituras** | Variante institucional |
| **Raiz & Fruto** | Variante mais “consumer”, se houver app separado na loja |

Definir nome final antes de ícones, PWA manifest e domínio (`estudo.ldfp.com.br` vs rota `/estudo`).

---

## 3. Objetivo geral

Oferecer experiência completa de **estudo, devocional e aprendizado** para usuários de todas as idades e níveis, com:

- Leitura e pesquisa bíblica
- Planos e séries de estudo
- Biblioteca (comentários, artigos, mapas — conforme licença)
- Conteúdo multimídia (áudio/vídeo — conforme licença)
- Ferramentas comunitárias e diário espiritual
- **Integração nativa** com igreja, grupos, eventos e líderes no LDFP

---

## 4. Público-alvo

- Membros, líderes, professores de EBD
- Novos convertidos, famílias, crianças e jovens
- Estudantes de teologia
- Qualquer pessoa ligada a uma igreja cliente LDFP que queira aprofundar vida devocional e conhecimento bíblico

---

## 5. Funcionalidades — visão completa

### 5.1 Múltiplas versões da Bíblia

**Versões populares (meta):** ARC, ARA, NVI, NAA, KJA, Bíblia Viva, A Mensagem.

**Versões de estudo (meta):** ACF, Bíblia de Jerusalém, NTLH.

**Idiomas originais (meta):** consulta Hebraico/Grego, transliteração, dicionário Strong.

**Recursos:**

- Pesquisa por palavra, frase, livro, capítulo, versículo
- Marcação, anotações, realce colorido, grupos de favoritos
- Modo leitura noturno

### 5.2 Biblioteca de livros e recursos

- Comentários (Matthew Henry, John Gill, F.B. Meyer, William Barclay, etc.) — **somente com licença**
- Dicionários e enciclopédias bíblicas
- Concordância
- Livros teológicos e devocionais (clássicos/contemporâneos; parceria com editoras)
- Mapas bíblicos interativos
- Artigos e estudos temáticos

### 5.3 Séries de estudo e planos devocionais

- Planos de leitura (cronológico, temático, anual, por livro)
- Séries temáticas (“Vida de Jesus”, “Atributos de Deus”, escatologia, doutrinas)
- Devocional diário
- Devocional em família (perguntas, atividades, vídeos curtos)
- Cursos bíblicos estruturados (aulas, materiais, avaliações — possível premium)

### 5.4 Conteúdo multimídia

- Vídeos: pregações, documentários, animações infantis
- Áudios: Bíblia falada, podcasts, música
- Imagens: ilustrações, arte sacra, fotos de locais

### 5.5 Ferramentas interativas e comunitárias

- Diário de oração (pedidos, gratidão, respostas)
- Grupos de estudo in-app (fórum, anotações compartilhadas)
- Compartilhamento (redes sociais / contatos)
- Perguntas e respostas moderadas
- Gamificação (crianças/jovens): quizzes, desafios, recompensas

### 5.6 Integração com LDFP

| Integração | Descrição |
|------------|-----------|
| **Login único** | Mesmo JWT / credenciais do `app_login.html` |
| **Perfil** | `igreja_id`, nome, grupos/células já no sistema |
| **Conteúdo da igreja** | Estudos, sermões, avisos, planos exclusivos da igreja |
| **Acompanhamento (líderes)** | Engajamento em planos/devocionais — **opt-in** (LGPD) |
| **Eventos** | Sincronizar com `agenda` / eventos de treinamento |
| **EBD** | Complementar (não substituir) turmas/alunos/grades administrativos |
| **Módulo SaaS** | Flag `modulo_app_estudo` no plano da igreja (futuro) |

### 5.7 Tecnologia e design

- Interface limpa, responsiva, acessível (fonte, contraste)
- Temas claro/escuro, personalização de realce
- Modo offline (download de capítulos, devocionais, materiais da igreja)
- Sincronização multi-dispositivo (anotações, progresso)
- Performance e baixo consumo de bateria (PWA otimizada)

### 5.8 Monetização (opcional — decisão de negócio)

- Conteúdo premium (livros, cursos, comentários)
- Assinatura biblioteca completa
- Doações
- Inclusão no plano SaaS LDFP (Hebrom/Betel/Sião)

### 5.9 Métricas de sucesso

| Métrica | Fonte técnica sugerida |
|---------|------------------------|
| Usuários ativos (DAU/MAU) | `estudo_progresso.updated_at`, logs de sessão |
| Engajamento em planos | % conclusão por `plano_id` |
| Tempo médio de uso | eventos em `audit_logs` ou analytics dedicado |
| Feedback / NPS | formulário in-app + loja (se nativo) |
| Adoção por igrejas | igrejas com `modulo_app_estudo = 1` |

---

## 6. Restrições legais e de conteúdo

**Não implementar textos ou áudios protegidos sem contrato explícito.**

| Tipo | Observação |
|------|------------|
| NVI, ARA, NAA, A Mensagem, etc. | Direitos de tradutores/editoras — licenciar ou usar API parceira |
| Comentários comerciais | Idem |
| Áudio bíblico comercial | Idem |
| Conteúdo próprio da igreja | Permitido (sermões, estudos internos) |
| Domínio público / CC | Preferir no MVP (ex. traduções antigas, comentários PD) |
| API terceiros | Avaliar YouVersion Platform, American Bible Society, etc. |

O MVP deve declarar **uma** fonte de texto bíblica com licença documentada no repositório (`docs/LDFP-ESTUDO-LICENCAS.md` — criar quando houver contrato).

---

## 7. Alinhamento com o código LDFP atual

| Já existe | Relação com Estudo |
|-----------|-------------------|
| `public/app_membro_v2.html` | Shell natural para aba “Estudo” |
| `public/session.js` + JWT | Auth compartilhada |
| `src/middlewares/auth.js` | `req.auth`: `id`, `igrejaId`, `role` |
| EBD (`/api/ebd/*`) | Gestão administrativa; Estudo é experiência do membro |
| Grupos/células | Atribuir planos por grupo (Fase 2) |
| Push (`pushRoutes.js`) | Lembretes de devocional/plano |
| MySQL 5.6 | `LONGTEXT` para JSON de passos; sem tipo `JSON` |
| PWA (`pwa.js`, service worker) | Base para offline |

**Health check produção:** `GET https://ldfp.com.br/health` (não `/api/health`).

---

## 8. Arquitetura proposta

```
┌─────────────────────────────────────────────────────────┐
│  Cliente: public/estudo.html (+ estudo.js, estudo.css) │
│  ou seção em app_membro_v2.html                          │
└──────────────────────────┬──────────────────────────────┘
                           │ Authorization: Bearer
┌──────────────────────────▼──────────────────────────────┐
│  API: src/routes/estudoRoutes.js                         │
│       src/controllers/estudoController.js                │
│       src/models/estudoModel.js                          │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│  MySQL: estudo_* + igreja_estudo_conteudo                │
│  Cache offline: IndexedDB (capítulos + devocional do dia)│
└─────────────────────────────────────────────────────────┘
```

**Fase 1:** apenas web/PWA no domínio principal.  
**Fase 3+:** Capacitor/React Native opcional, mesma API.

---

## 9. Roadmap por fases

### Fase 1 — MVP (8–12 semanas, 1 dev focado)

**Objetivo:** membro lê a Bíblia, anota, segue 1 plano; igreja publica devocional.

| # | Entrega |
|---|---------|
| 1 | Uma tradução bíblica licenciada (ou corpus próprio) |
| 2 | Leitor: navegação livro → capítulo → versículos |
| 3 | Busca simples por palavra (índice ou API) |
| 4 | Favoritos + anotações + realce (persistência API) |
| 5 | 3 planos de leitura fixos + barra de progresso |
| 6 | Devocional do dia (global ou por igreja) |
| 7 | Login LDFP (`app_login` → estudo) |
| 8 | Tema claro/escuro + tamanho de fonte |
| 9 | Offline: último capítulo + devocional do dia (IndexedDB) |

**Fora do MVP:** Strong, múltiplas versões, comentários pagos, Q&A, gamificação, app nativo.

### Fase 2 — Igreja e comunidade

- Painel admin/publicador: CRUD conteúdo da igreja
- Planos atribuídos a grupos/células
- Dashboard líder: progresso agregado (opt-in)
- Integração agenda (eventos de estudo)
- Notificação push: lembrete devocional

### Fase 3 — Biblioteca e mídia

- Artigos, mapas estáticos, concordância
- Áudio (com licença)
- Cursos em módulos (sem avaliação complexa inicialmente)

### Fase 4 — Escala e premium

- Múltiplas versões + comentários licenciados
- Assinatura / monetização
- Gamificação infantil, Q&A moderado, Strong avançado
- App Store / Play Store (se necessário)

---

## 10. Modelo de dados — esboço MVP (MySQL 5.6)

Arquivo futuro: `CRIAR_TABELAS_ESTUDO.sql`

```sql
-- ================================================================
-- Módulo: LDFP Estudo (MVP)
-- Banco: ldfp8965_sistema_gestao
-- Regras: sem tipo JSON; usar LONGTEXT; pool.query [rows, fields]
-- ================================================================

CREATE TABLE IF NOT EXISTS `estudo_versoes` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `codigo`        VARCHAR(20) NOT NULL COMMENT 'ex: arc, proprio_ldfp',
  `nome`          VARCHAR(120) NOT NULL,
  `idioma`        VARCHAR(10) NOT NULL DEFAULT 'pt',
  `licenca_nota`  VARCHAR(255) DEFAULT NULL,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_versoes_codigo` (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_passagens` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `livro_ordem`   SMALLINT NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo`     SMALLINT NOT NULL,
  `texto`         TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_passagens_ref` (`versao_id`, `livro_ordem`, `capitulo`, `versiculo`),
  KEY `idx_estudo_passagens_livro` (`versao_id`, `livro`, `capitulo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_anotacoes` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo_ini` SMALLINT NOT NULL,
  `versiculo_fim` SMALLINT DEFAULT NULL,
  `texto`         TEXT DEFAULT NULL,
  `cor_realce`    VARCHAR(20) DEFAULT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_anot_user` (`user_id`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_favoritos` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `versao_id`     INT NOT NULL,
  `livro`         VARCHAR(40) NOT NULL,
  `capitulo`      SMALLINT NOT NULL,
  `versiculo`     SMALLINT NOT NULL,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_fav` (`user_id`, `versao_id`, `livro`, `capitulo`, `versiculo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_planos` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT DEFAULT NULL COMMENT 'NULL = plano global LDFP',
  `titulo`        VARCHAR(255) NOT NULL,
  `descricao`     TEXT DEFAULT NULL,
  `tipo`          ENUM('leitura','tematico','devocional') NOT NULL DEFAULT 'leitura',
  `passos_json`   LONGTEXT NOT NULL COMMENT 'array JSON: [{dia, refs[]}]',
  `dias_total`    INT NOT NULL DEFAULT 0,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_planos_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_progresso` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `user_id`       INT NOT NULL,
  `igreja_id`     INT NOT NULL,
  `plano_id`      INT NOT NULL,
  `passo_atual`   INT NOT NULL DEFAULT 0,
  `concluido`     TINYINT(1) NOT NULL DEFAULT 0,
  `updated_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_estudo_prog` (`user_id`, `plano_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `estudo_devocionais` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT DEFAULT NULL,
  `data_ref`      DATE NOT NULL,
  `titulo`        VARCHAR(255) NOT NULL,
  `versiculo_ref` VARCHAR(80) DEFAULT NULL,
  `corpo`         LONGTEXT NOT NULL,
  `oracao`        TEXT DEFAULT NULL,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_estudo_dev_data` (`data_ref`, `igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `igreja_estudo_conteudo` (
  `id`            INT NOT NULL AUTO_INCREMENT,
  `igreja_id`     INT NOT NULL,
  `tipo`          ENUM('artigo','video','audio','pdf','link') NOT NULL,
  `titulo`        VARCHAR(255) NOT NULL,
  `resumo`        TEXT DEFAULT NULL,
  `url`           VARCHAR(500) DEFAULT NULL,
  `corpo`         LONGTEXT DEFAULT NULL,
  `publicado_em`  DATETIME DEFAULT NULL,
  `ativo`         TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_igreja_estudo_igreja` (`igreja_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**Fase 2 (adicional):** `estudo_grupos`, `estudo_grupo_mensagens`, `estudo_diario_oracao`, `estudo_eventos_engajamento` (opt-in).

---

## 11. API REST — esboço MVP

Prefixo sugerido: `/api/estudo`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/versoes` | opcional | Lista versões ativas |
| GET | `/passagens?versao=&livro=&capitulo=` | membro | Texto do capítulo |
| GET | `/busca?q=&versao=` | membro | Busca simples |
| GET | `/anotacoes` | membro | Lista do usuário |
| POST | `/anotacoes` | membro | Cria/atualiza |
| DELETE | `/anotacoes/:id` | membro | Remove |
| GET | `/favoritos` | membro | Lista |
| POST | `/favoritos` | membro | Adiciona |
| DELETE | `/favoritos/:id` | membro | Remove |
| GET | `/planos` | membro | Planos globais + da igreja |
| GET | `/planos/:id` | membro | Detalhe + passos |
| POST | `/planos/:id/progresso` | membro | Atualiza passo |
| GET | `/devocional/hoje` | membro | Devocional do dia |
| GET | `/igreja/conteudo` | membro | Materiais da igreja |

**Admin (Fase 2):** `/api/estudo/admin/*` com `authorize` admin/secretaria + `modulo_app_estudo`.

Registrar em `src/app.js`: `app.use('/api/estudo', apiRateLimiter, estudoRoutes)`.

---

## 12. Frontend — arquivos sugeridos (Fase 1)

```
public/
  estudo.html              # Shell principal (ou integrar em app_membro_v2)
  estudo.css
  estudo.js                # Leitor, busca, anotações
  estudo-offline.js        # IndexedDB sync
```

**UX mínima:**

1. Home: devocional do dia + “continuar leitura” + planos ativos  
2. Leitor: swipe capítulo anterior/próximo  
3. Sheet: anotação / favorito / compartilhar texto  
4. Perfil: progresso dos planos  

Reutilizar tokens visuais de `app_membro_v2.html` e `enterprise-shell.js` onde couber.

---

## 13. Módulo SaaS (futuro)

Adicionar em `saas_modulos` / `igreja_modulos`:

- `slug`: `app_estudo`
- `nome`: Bíblia & Estudo
- Planos: Hebrom (básico?), Betel/Sião (completo) — **definir com negócio**

Middleware: `requireModuleEnabled('app_estudo')` nas rotas, alinhado a `modulo_app_membro`.

---

## 14. LGPD e pastoral

- Progresso e anotações são **dados pessoais** — política de privacidade atualizada
- Dashboard do líder só com **consentimento explícito** do membro
- Moderação em Q&A (Fase 4) — fila para líderes

---

## 15. Pré-requisitos antes de codar Fase 1

- [ ] Deploy LDFP estável (`7267579`+ em produção)
- [ ] Senha MySQL rotacionada (pendência de segurança 04/06/2026)
- [ ] Escolha da **tradução bíblica** + documento de licença
- [ ] Decisão: aba no `app_membro_v2` vs `estudo.html` standalone
- [ ] Seed: 1 versão + Gênesis 1 ou João 1 para teste
- [ ] Criar `CRIAR_TABELAS_ESTUDO.sql` a partir da seção 10

---

## 16. Próximos passos no repositório

| Ordem | Ação |
|-------|------|
| 1 | Aprovar escopo Fase 1 com stakeholders |
| 2 | Commit deste documento + referência em `ONDE_PAREI.md` |
| 3 | Implementar `CRIAR_TABELAS_ESTUDO.sql` + migration cPanel |
| 4 | `estudoRoutes.js` + leitor MVP |
| 5 | Entrada no menu do app membro |

---

## 17. Referências internas

- `ONDE_PAREI.md` — estado do sistema e deploy
- `public/app_membro_v2.html` — app do membro
- `public/session.js` — autenticação
- `DEPLOY_ROTEIRO.md` — publicação cPanel
- `docs/drafts/` — outros rascunhos de módulos

---

*Documento gerado a partir do prompt de produto “LDFP Bíblia & Estudo” (jun/2026).*
