# LDFP Sistema — Guia de Produção no cPanel Napoleon
**Domínio:** ldfp.com.br | **Validado em:** 14/05/2026

---

## STATUS DO PROJETO

| Item | Situação |
|------|----------|
| Estrutura de pastas | ✅ OK |
| `src/server.js` (entry point) | ✅ OK |
| `package.json` com `main` e `start` | ✅ OK |
| Suporte a MySQL (cPanel) | ✅ OK |
| Variáveis de ambiente isoladas | ✅ OK |
| `.env` fora do Git | ✅ OK |

---

## PASSO A PASSO — DO ZERO AO AR

---

### ETAPA 1 — Banco de Dados MySQL no cPanel

1. Acesse o cPanel > **MySQL Databases**
2. Crie o banco de dados:
   - Nome: `ldfp8965_appweb` (ou prefixo que o cPanel usar, ex: `seuusuario_appweb`)
3. Crie o usuário do banco:
   - Usuário: `ldfp8965_appweb` (use o mesmo prefixo do cPanel)
   - Senha: **anote com segurança** (use mínimo 20 caracteres, letras+números+símbolos)
4. Vincule o usuário ao banco:
   - Em **Add User to Database**, selecione usuário + banco
   - Marque **ALL PRIVILEGES** → clique em Make Changes
5. ✅ Banco configurado. Anote:
   - `DB_HOST` = `localhost`
   - `DB_PORT` = `3306`
   - `DB_USER` = nome do usuário criado
   - `DB_PASSWORD` = senha definida
   - `DB_NAME` = nome do banco criado

---

### ETAPA 2 — Enviar o Código para o cPanel

**Opção A: Via Git (recomendado para atualizações contínuas)**

1. Acesse **Git Version Control** no cPanel
2. Clique em **Create** e informe:
   - Clone URL: URL do repositório GitHub
   - Repository Path: `/home/seu_usuario/ldfp.com.br`
   - Repository Name: `ldfp`
3. Clique em **Create** — o cPanel clona o projeto automaticamente
4. Para futuras atualizações: clique em **Update** → **Deploy HEAD Commit**

**Opção B: Via File Manager (se não tiver Git configurado)**

1. Compacte o projeto em `.zip` (sem node_modules e sem .env)
2. Abra **File Manager** → navegue até `/home/seu_usuario/ldfp.com.br`
3. Faça **Upload** do .zip e depois **Extract**
4. Verifique que `src/server.js` existe na pasta

---

### ETAPA 3 — Configurar Node.js App

1. Acesse **Setup Node.js App** no cPanel
2. Clique em **Create Application**
3. Preencha os campos:

| Campo | Valor |
|-------|-------|
| Node.js version | `18.x` (mínimo 18.0.0) |
| Application mode | `Production` |
| Application root | `/home/seu_usuario/ldfp.com.br` |
| Application URL | `ldfp.com.br` |
| Application startup file | `src/server.js` |

4. Clique em **Create**

---

### ETAPA 4 — Variáveis de Ambiente (CRÍTICO)

Ainda em **Setup Node.js App**, clique no botão de editar a aplicação criada.
Role até **Environment Variables** e adicione **uma por linha**:

```
NODE_ENV=production
PORT=3001

APP_BASE_URL=https://ldfp.com.br
APP_PUBLIC_BASE_URL=https://ldfp.com.br
PAYMENT_BASE_URL=https://ldfp.com.br
CORS_ORIGIN=https://ldfp.com.br,https://www.ldfp.com.br

DB_HOST=localhost
DB_PORT=3306
DB_USER=COLE_O_USUARIO_DO_BANCO_AQUI
DB_PASSWORD=COLE_A_SENHA_DO_BANCO_AQUI
DB_NAME=COLE_O_NOME_DO_BANCO_AQUI
DB_CONNECTION_LIMIT=10

JWT_SECRET=GERE_UMA_CHAVE_ALEATORIA_DE_64_CARACTERES_AQUI
JWT_EXPIRES_IN=12h
PASSWORD_SALT_ROUNDS=10

ENABLE_SETUP_ROUTE=false

SMTP_HOST=mail.ldfp.com.br
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@ldfp.com.br
SMTP_PASS=SENHA_EMAIL_AQUI
SMTP_FROM=LDFP Sistema <contato@ldfp.com.br>

WHATSAPP_PROVIDER=mock
```

> **Como gerar JWT_SECRET seguro:** Acesse https://generate-secret.vercel.app/64 e copie o valor gerado.

5. Clique em **Save**

---

### ETAPA 5 — Instalar Dependências

1. Na aplicação listada em **Setup Node.js App**, clique em **Run NPM Install**
2. Aguarde 2-3 minutos (instalação de todas as dependências)
3. Você verá: ✅ npm install started / completed

---

### ETAPA 6 — Criar Tabelas no Banco de Dados

**Via Terminal SSH no cPanel:**
```bash
cd /home/seu_usuario/ldfp.com.br
source /home/seu_usuario/nodevenv/ldfp.com.br/18/bin/activate && node scripts/init-db.js
```

**Alternativa — Via phpMyAdmin no cPanel:**
1. Abra **phpMyAdmin**
2. Selecione o banco criado (ex: `ldfp8965_appweb`)
3. Clique na aba **SQL**
4. Cole o conteúdo do arquivo `schema.sql` e clique em **Go**

---

### ETAPA 7 — Reiniciar e Testar

1. Clique em **Restart** na aplicação no cPanel
2. Aguarde 30-60 segundos
3. Acesse https://ldfp.com.br no navegador
4. Deve aparecer a tela de login do sistema

---

### ETAPA 8 — Criar o Primeiro Super-Admin (Conta Mestre)

Via **Terminal SSH** no cPanel:
```bash
cd /home/seu_usuario/ldfp.com.br
source /home/seu_usuario/nodevenv/ldfp.com.br/18/bin/activate && node scripts/create-super-admin.js
```
Informe nome, e-mail e senha quando solicitado.

> Esta conta super-admin terá acesso ao painel `/super-admin.html` para gerenciar todas as igrejas clientes do sistema.

---

### ETAPA 9 — SSL (HTTPS obrigatório)

1. Acesse **SSL/TLS** no cPanel
2. Clique em **AutoSSL** ou **Let's Encrypt SSL**
3. Instale para `ldfp.com.br` e `www.ldfp.com.br`
4. Aguarde alguns minutos
5. ✅ Site acessível em https://ldfp.com.br com cadeado verde

---

## ATUALIZAÇÕES FUTURAS (fluxo contínuo)

```
Você faz alteração local
    ↓
git add . && git commit -m "descrição"
    ↓
git push origin main
    ↓
cPanel → Git Version Control → Update → Deploy HEAD Commit
    ↓
cPanel → Setup Node.js App → Restart
    ↓
✅ Sistema atualizado em produção
```

---

## ESTRUTURA DE USUÁRIOS / COMERCIALIZAÇÃO

| Role | Descrição |
|------|-----------|
| `super-admin` | Você (LDFP) — acessa `/super-admin.html`, gerencia todas as igrejas |
| `admin` | Administrador de cada igreja cliente |
| `tesoureiro` | Acesso ao módulo financeiro |
| `secretario` | Acesso ao módulo de membros |
| `lider` | Acesso restrito ao seu grupo/célula |
| `membro` | Acesso ao app de membro |

**Para vender o sistema:** cadastre a nova igreja no super-admin, defina o plano, e o admin da igreja configura os próprios usuários.

---

## DIAGNÓSTICO DE PROBLEMAS

| Sintoma | Causa provável | Solução |
|---------|---------------|---------|
| Tela em branco / 502 | App Node não rodando | Setup Node.js App → Restart |
| "Cannot connect to database" | Variáveis de banco erradas | Verifique DB_HOST, DB_USER, DB_PASSWORD, DB_NAME |
| Login não funciona | JWT_SECRET não definido | Adicionar JWT_SECRET nas env vars |
| Sem HTTPS | SSL não instalado | Instalar AutoSSL no cPanel |
| App travada após update | node_modules desatualizado | Run NPM Install → Restart |
| CORS bloqueado | CORS_ORIGIN incorreto | Adicionar domínio em CORS_ORIGIN |

---

## MONITORAMENTO PÓS-DEPLOY

**Health check da API:**
```
https://ldfp.com.br/api/health
```

**Verificar logs no cPanel:**
- Setup Node.js App → botão de logs da aplicação
- Ou via SSH: `tail -f ~/logs/ldfp.com.br.log`

**Script de verificação local:**
```bash
node scripts/check-production.js
```

---

## CHECKLIST FINAL DE LANÇAMENTO

- [ ] Banco MySQL criado e usuário vinculado
- [ ] Código no servidor (via Git ou upload)
- [ ] Node.js App criado no cPanel (startup: `src/server.js`)
- [ ] Todas as variáveis de ambiente configuradas
- [ ] `npm install` executado
- [ ] Tabelas criadas (`init-db.js` ou schema.sql via phpMyAdmin)
- [ ] App reiniciado
- [ ] SSL/HTTPS ativo em ldfp.com.br
- [ ] Conta super-admin criada
- [ ] Acesso testado em https://ldfp.com.br
- [ ] Login funcionando
- [ ] Painel super-admin acessível em /super-admin.html

---

*Documento gerado automaticamente com base na análise do projeto em 14/05/2026*
