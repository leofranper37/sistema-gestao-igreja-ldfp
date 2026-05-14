# 🚀 CONFIGURAÇÃO FINAL - cPanel Napoleon + ldfp.com.br

**Objetivo:** Deixar o sistema 100% funcional no cPanel com seu domínio ldfp.com.br.

---

## ✅ ETAPA 1: Preparar o Projeto (Local)

### 1.1 - Validar Arquivos Críticos
Confirme que no seu repositório Git existem:
```
sistema-gestao-igreja/
├── src/
│   ├── server.js          ← ARQUIVO DE INICIALIZAÇÃO
│   ├── app.js
│   ├── config/
│   │   ├── index.js
│   │   ├── db.js
│   │   └── logger.js
│   ├── routes/
│   ├── services/
│   └── middlewares/
├── public/
│   ├── index.html         ← ARQUIVO RAIZ DO FRONT
│   ├── app.js
│   ├── app.css
│   └── [outros HTMLs]
├── package.json           ← DEVE TER "main": "src/server.js"
├── package-lock.json
└── .env.example
```

### 1.2 - Validar package.json
O arquivo deve conter:
```json
{
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  }
}
```

### 1.3 - Fazer Commit Final Local
```bash
git add .
git commit -m "Preparação final para cPanel Napoleon"
git push origin main
```

---

## ✅ ETAPA 2: Preparar o cPanel

### 2.1 - Acessar cPanel
```
URL: cpanel.napoleon.com.br (ou IP do seu cPanel)
Usuário: seu_usuario
Senha: sua_senha
```

### 2.2 - Criar Domínio Principal (se ainda não existir)
1. Procure por **"Domains"** ou **"Addon Domains"**
2. Clique em **"Add Domain"**
3. Preencha:
   - Domain: `ldfp.com.br`
   - Document Root: `/home/seu_usuario/ldfp.com.br`
4. Clique em **"Add Domain"**

### 2.3 - Pontuar DNS para cPanel
No site onde registrou o domínio (registro.br ou outro):
1. Vá para **DNS / Nameservers**
2. Aponte para os nameservers do seu hosting cPanel (pergunte ao suporte se não souber)
3. Aguarde até 24h para propagar

---

## ✅ ETAPA 3: Fazer Upload do Projeto

### 3.1 - Via SSH (Recomendado)
```bash
# Conectar ao servidor cPanel
ssh seu_usuario@seu_host_cpanel

# Executar no servidor
cd /home/seu_usuario/ldfp.com.br

# Clonar o repositório (ou fazer pull se já existe)
git clone https://github.com/leofranper37/sistema-gestao-igreja.git .

# Ou se já clonado, fazer pull das atualizações
git pull origin main
```

### 3.2 - Via File Manager (Se não tem SSH)
1. Abrir **File Manager** no cPanel
2. Navegar para `/home/seu_usuario/ldfp.com.br`
3. **Upload** todos os arquivos ou zip do projeto
4. Se for ZIP, **Extract** na pasta
5. Confirmação: ver `src/server.js` dentro de `ldfp.com.br`

---

## ✅ ETAPA 4: Configurar Node.js App no cPanel

### 4.1 - Abrir "Setup Node.js App"
1. No cPanel, procure **"Setup Node.js App"** ou **"Node.js Manager"**
2. Clique em **"Create Application"**

### 4.2 - Preencher Campos

| Campo | Valor |
|-------|-------|
| **Node.js version** | 18.x ou superior (18.20.0 recomendado) |
| **Application root** | `/home/seu_usuario/ldfp.com.br` |
| **Application startup file** | `src/server.js` |
| **Application URL** | `ldfp.com.br` (selecionar do dropdown) |
| **Application port** | Deixar vazio (cPanel vai gerenciar) |

### 4.3 - Clicar em "Create"
O cPanel criará a aplicação. Você verá:
- ✅ Application created successfully
- URL de acesso: `https://ldfp.com.br`

---

## ✅ ETAPA 5: Instalar Dependências e Reiniciar

### 5.1 - Run NPM Install
1. Localizar a aplicação criada na lista
2. Clique em **"Run NPM Install"**
3. Aguarde conclusão (2-3 minutos)
4. Você verá: ✅ npm install started

### 5.2 - Restart Application
1. Clique em **"Restart"**
2. Aguarde 30-60 segundos
3. Você verá: ✅ Application restarted successfully

---

## ✅ ETAPA 6: Configurar Variáveis de Ambiente

### 6.1 - Abrir Gerenciador de Variáveis
Ainda em **Setup Node.js App**:
1. Localize sua aplicação `ldfp.com.br`
2. Clique em **"Edit Environment Variables"** ou botão de engrenagem
3. Preencha cada linha com os valores abaixo

### 6.2 - Variáveis Finais para Colar

```env
NODE_ENV=production

APP_BASE_URL=https://ldfp.com.br
APP_PUBLIC_BASE_URL=https://ldfp.com.br
PAYMENT_BASE_URL=https://ldfp.com.br

CORS_ORIGIN=https://ldfp.com.br,https://www.ldfp.com.br,https://app.ldfp.com.br

DB_HOST=localhost
DB_PORT=3306
DB_USER=ldfp8965_appweb
DB_PASSWORD=LEO_SENHA_BANCO_REAL
DB_NAME=ldfp8965_appweb
DB_CONNECTION_LIMIT=10

JWT_SECRET=LEO_GERE_UMA_CHAVE_FORTE_AQUI_MINIMO_32_CARACTERES
PASSWORD_SALT_ROUNDS=10
ENABLE_SETUP_ROUTE=false

SMTP_HOST=mail.ldfp.com.br
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@app.ldfp.com.br
SMTP_PASS=LEO_SENHA_SMTP_REAL
SMTP_FROM=LDFP Sistema <contato@app.ldfp.com.br>

WHATSAPP_PROVIDER=mock
```

### 6.3 - Salvar Variáveis
1. Clique em **"Save"**
2. Você verá: ✅ Configuration saved

### 6.4 - Restart App Novamente
Após salvar variáveis:
1. Clique em **"Restart"**
2. Aguarde 30 segundos

---

## ✅ ETAPA 7: Configurar Banco de Dados

### 7.1 - Criar Banco no cPanel
1. Abrir **"MySQL Databases"** no cPanel
2. Se a base `ldfp8965_appweb` não existir:
   - Clique em **"Create New Database"**
   - Nome: `ldfp8965_appweb`
   - Clique em **"Create Database"**

### 7.2 - Criar Usuário do Banco
1. Em **MySQL Databases**, procure **"MySQL Users"**
2. Se o usuário `ldfp8965_appweb` não existir:
   - Clique em **"Create New User"**
   - Username: `ldfp8965_appweb`
   - Password: a mesma que você colocou em `DB_PASSWORD`
   - Clique em **"Create User"**

### 7.3 - Vincular Usuário ao Banco
1. Em **MySQL Users**, procure **"Add User to Database"**
2. Selecione:
   - User: `ldfp8965_appweb`
   - Database: `ldfp8965_appweb`
3. Clique em **"Add"**
4. Marque **todos os privilégios** (ALL PRIVILEGES)
5. Clique em **"Make Changes"**

### 7.4 - Importar Schema (Criar Tabelas)
1. Abrir **"phpMyAdmin"**
2. Selecionar a base `ldfp8965_appweb` (painel esquerdo)
3. Ir em **"Import"**
4. Fazer upload do arquivo `schema.sql` do seu projeto
5. Clique em **"Import"**
6. Você verá: ✅ All imports have been successfully completed

---

## ✅ ETAPA 8: Testar Aplicação

### 8.1 - Validação Rápida
Abrir no navegador:
```
https://ldfp.com.br
```

Você deve ver:
- ✅ Página inicial da aplicação carregada
- ✅ CSS e imagens aparecem
- ✅ Sem erro 503

### 8.2 - Teste de Login (Se houver)
1. Ir para a página de login
2. Tentar fazer login com credenciais válidas
3. Verificar se conecta ao banco (sem erro de conexão)

### 8.3 - Teste de CORS
Se sua aplicação faz chamadas AJAX:
1. Abrir DevTools (F12)
2. Verificar aba **Network** → procure por XHR/Fetch
3. Se houver erro CORS, significa que CORS_ORIGIN precisa incluir o domínio de origem

### 8.4 - Verificar Logs
Se houver erro, consultar logs:

**Via cPanel:**
1. Voltar a **Setup Node.js App**
2. Encontrar sua aplicação
3. Clique em **"View Logs"** (se disponível)
4. Ver os erros mais recentes

**Via SSH:**
```bash
ssh seu_usuario@seu_host_cpanel
tail -100 /home/seu_usuario/ldfp.com.br/.log/error.log
tail -100 /home/seu_usuario/ldfp.com.br/.log/pid.log
```

---

## ❌ Se Ainda der 503

### Causa 1: Arquivo startup incorreto
**Solução:**
1. Abrir Setup Node.js App
2. Verificar se **Application startup file** é `src/server.js` (não `index.js`)
3. Restart

### Causa 2: Node.js version incompatível
**Solução:**
1. Ir a **Setup Node.js App**
2. Mudar **Node.js version** para 18.20.0 ou 20.x
3. Restart

### Causa 3: Variáveis de ambiente faltando
**Solução:**
1. Verificar se todas as variáveis (NODE_ENV, DB_PASSWORD, JWT_SECRET) estão preenchidas
2. Não deixar vazio campos críticos
3. Restart

### Causa 4: Banco não conecta
**Solução:**
1. Verificar no phpMyAdmin se a base existe
2. Verificar se o usuário tem privilégio no banco
3. Verificar se DB_HOST=localhost está correto (não colocar IP externo)
4. Restart

### Causa 5: Port já em uso
**Solução:**
1. Deixar campo **Application port** **vazio** no Setup (cPanel gerencia)
2. Remover variável PORT das Environment Variables
3. Restart

---

## ✅ Se Funcionar Tudo

Você deve ver:
- ✅ Site acessível em https://ldfp.com.br
- ✅ No console do navegador (F12), sem erro 503 ou CORS
- ✅ Login funciona (se houver autenticação)
- ✅ Alguma funcionalidade de banco carrega (listar dados, etc)

---

## 📋 Checklist Final

- [ ] Criado domínio ldfp.com.br no cPanel
- [ ] DNS apontado para nameservers cPanel
- [ ] Projeto clonado/enviado para `/home/seu_usuario/ldfp.com.br`
- [ ] Aplicação Node criada em "Setup Node.js App"
- [ ] npm install executado com sucesso
- [ ] Todas as variáveis de ambiente preenchidas
- [ ] Banco criado e schema importado
- [ ] Aplicação reiniciada 2x (após npm install e após variáveis)
- [ ] https://ldfp.com.br abre sem erro 503
- [ ] https://ldfp.com.br carrega corretamente
- [ ] Funcionalidade básica testada (login, listagem de dados, etc)

---

## 🆘 Próximos Passos se Ainda Tiver Erro

Se após seguir tudo ainda der erro:

1. **Abrir aba "View Logs"** em Setup Node.js App
2. **Copiar as últimas 50-100 linhas** do log
3. **Me mandar o erro completo**

Exemplo de what to send:
```
Error: connect ECONNREFUSED 127.0.0.1:3306
  at TCPConnectWrap.afterConnect [as oncomplete] (net.js:1144:6)
```

Com o erro específico, dou uma solução 100% direta.

---

**Boa sorte! 🚀 Avise quando terminar cada etapa!**
