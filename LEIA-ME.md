# Agentes Claude Code — Instalação

## 1. Agentes globais (funcionam em TODOS os seus projetos)
Copie os arquivos da pasta `user-scope/` para `~/.claude/agents/` no seu computador:

```bash
mkdir -p ~/.claude/agents
cp user-scope/*.md ~/.claude/agents/
```

- **code-reviewer** — revisa código após implementações (só leitura, nunca edita)
- **test-runner** — roda testes e reporta só as falhas (usa Haiku = barato)
- **git-assistant** — commits padronizados e PRs via gh CLI (usa Haiku = barato)

## 2. Agentes do projeto sistema-gestao-igreja-ldfp
Copie os arquivos da pasta `projeto-ldfp/` para dentro do repositório:

```bash
mkdir -p .claude/agents
cp projeto-ldfp/*.md .claude/agents/
git add .claude/agents && git commit -m "chore: adicionar subagents do Claude Code"
```

- **db-guardian** — protege as regras do MySQL 5.6 e o isolamento multi-tenant
- **deploy-checker** — valida checklist antes de subir pro cPanel

## 3. Como usar
No Claude Code, os agentes são acionados automaticamente pela descrição, ou explicitamente:

```
> Use o code-reviewer para analisar minhas últimas mudanças
> Use o test-runner antes de commitar
> Use o db-guardian para criar a query de relatório de dízimos
```

Digite `/agents` no Claude Code para ver/editar todos.

## Por que isso economiza créditos
1. Trabalho verboso (testes, logs, exploração de arquivos) roda em contexto isolado — só o resumo volta
2. test-runner, git-assistant e deploy-checker usam **Haiku** (muito mais barato que Sonnet)
3. Prompts especializados = menos idas e vindas corrigindo resultado
4. Seu CLAUDE.md já existente evita que o Claude redescubra a arquitetura toda sessão
