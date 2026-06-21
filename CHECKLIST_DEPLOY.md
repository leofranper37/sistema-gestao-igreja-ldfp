# Checklist de Deploy — Sistema Gestão Igreja LDFP

## Regra de ouro
> **Código** sobe pelo Git. **Banco de dados** (ALTER TABLE, DELETE, INSERT, UPDATE estrutural) roda à mão no phpMyAdmin de produção.
> Sempre rodar o banco ANTES do deploy de código quando a mudança exigir os dois.

---

## Deploy padrão (só código, sem mudança de banco)

```bash
~/deploy.sh
```

Esse script faz tudo de uma vez: `git pull` + copiar arquivos públicos + restart do Node.

---

## Deploy com mudança de banco (SQL + código)

### Passo 1 — Rodar o SQL no phpMyAdmin de produção
1. Acessar cPanel → phpMyAdmin
2. Confirmar que o banco selecionado é **`ldfp8965_sistema_gestao`** (aparece no canto superior esquerdo)
3. Clicar na aba **SQL**
4. Colar e executar o SQL
5. Verificar que a alteração foi aplicada (SELECT de confirmação)

### Passo 2 — Deploy do código
```bash
~/deploy.sh
```

---

## O que vai pelo Git (código)

| O que é | Exemplos |
|---------|----------|
| Arquivos `.js` do backend | `src/controllers/`, `src/routes/`, `src/middlewares/` |
| Páginas HTML | `public/*.html` |
| CSS e JS do frontend | `public/style.css`, `public/enterprise-shell.js`, etc. |
| Service Worker | `public/sw.js` |
| Configurações Node | `package.json`, `app.js` |

**Não sobe pelo Git:** Dados do banco, schema (colunas, tabelas), `.env`, `node_modules/`

---

## O que roda no phpMyAdmin (banco de produção)

| O que é | Exemplos |
|---------|----------|
| Nova coluna | `ALTER TABLE igrejas ADD COLUMN is_system TINYINT(1) DEFAULT 0` |
| Nova tabela | `CREATE TABLE nova_tabela (...)` |
| Dados iniciais | `INSERT INTO saas_planos (...)` |
| Correção de dado | `UPDATE igrejas SET is_system = 1 WHERE id = 2` |
| Limpeza de dados | `DELETE FROM igrejas WHERE id = 1` |

---

## Verificações após deploy

- [ ] Site responde: `https://ldfp.com.br`
- [ ] Login funciona: `leopereita31@gmail.com`
- [ ] Painel super admin carrega: `admin-master.html`
- [ ] Se mudou CSS/JS: F12 → limpar cache ou verificar que SW está buscando versão nova

---

## Informações do servidor

| Item | Valor |
|------|-------|
| Repo no servidor | `~/sistema-gestao-igreja-ldfp-main` |
| Arquivos públicos | `~/public_html/` |
| Restart Node | `touch tmp/restart.txt` (cPanel Passenger) |
| Banco de produção | `ldfp8965_sistema_gestao` |
| Script de deploy | `~/deploy.sh` |
