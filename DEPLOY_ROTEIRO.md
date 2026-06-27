# 🚀 ROTEIRO DE DEPLOY - Sistema de Gestão Igreja

## Ambiente Oficial

- Produção oficial: **cPanel**
- GitHub: origem única do código
- Ambiente anterior: apenas histórico, não usar como fluxo de produção

## Objetivo

Manter o sistema publicado no cPanel com atualização via GitHub e restart da app Node.

## ETAPA 1: Preparar o repositório

1. Confirme que o branch principal é a [main](main).
2. Faça commit das alterações locais.
3. Envie para o GitHub.

```bash
git status
git add .
git commit -m "Preparando deploy para cPanel"
git push origin main
```

## ETAPA 2: Subir no cPanel

1. Abra Git Version Control no cPanel.
2. Selecione a branch [main](main).
3. Clique em Pull/Update from Remote.
4. Clique em Deploy HEAD Commit.

Se o repositório ainda não estiver clonado no cPanel, use a URL SSH do GitHub para criar a cópia inicial.

## ETAPA 3: Configurar a aplicação Node

1. Abra Setup Node.js App.
2. Verifique estes campos:

| Campo | Valor |
|-------|-------|
| Application root | pasta do projeto no cPanel |
| Startup file | [src/server.js](src/server.js) |
| Node.js version | 18.x ou superior |

3. Instale dependências com Run NPM Install.
4. Clique em Restart.

## ETAPA 4: Variáveis de ambiente

Adicione as variáveis abaixo em Setup Node.js App:

```env
NODE_ENV=production
APP_BASE_URL=https://ldfp.com.br
APP_PUBLIC_BASE_URL=https://ldfp.com.br
PAYMENT_BASE_URL=https://ldfp.com.br
CORS_ORIGIN=https://ldfp.com.br,https://www.ldfp.com.br,https://app.ldfp.com.br
DB_HOST=localhost
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=seu_banco
DB_CONNECTION_LIMIT=10
JWT_SECRET=uma_chave_forte_com_32_ou_mais_caracteres
PASSWORD_SALT_ROUNDS=10
ENABLE_SETUP_ROUTE=false
SMTP_HOST=mail.ldfp.com.br
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=contato@app.ldfp.com.br
SMTP_PASS=sua_senha_smtp
SMTP_FROM=LDFP Sistema <contato@app.ldfp.com.br>
WHATSAPP_PROVIDER=mock
```

Depois salve e reinicie a aplicação.

## ETAPA 5: Banco de dados

1. Crie o banco no MySQL Databases do cPanel.
2. Crie o usuário do banco.
3. Vincule o usuário ao banco com todos os privilégios.
4. Rode o schema ou o script de migração do projeto.

Se o sistema já usa banco existente, confirme apenas host, usuário, senha e nome do banco.

## ETAPA 6: Validação

1. Abra o domínio principal.
2. Teste login.
3. Teste uma página interna.
4. Confira os logs da aplicação se algo falhar.

```bash
curl -I https://ldfp.com.br
curl -I https://www.ldfp.com.br
```

## Troubleshooting

### 503 Service Unavailable

1. Confirme o startup file como [src/server.js](src/server.js).
2. Verifique se a aplicação Node está ativa.
3. Reinicie a app após alterar variáveis.

### Página antiga ou conteúdo desatualizado

1. Faça novo Pull/Update no Git Version Control.
2. Clique em Deploy HEAD Commit.
3. Reinicie a aplicação.

### Erro de banco

1. Revise as variáveis do banco.
2. Confira se o usuário tem permissão total no banco.
3. Veja o log da aplicação.

## Checklist final

- [ ] Branch [main](main) atualizada no GitHub
- [ ] Pull/Update executado no cPanel
- [ ] Deploy HEAD Commit executado
- [ ] Startup file configurado como [src/server.js](src/server.js)
- [ ] Variáveis de ambiente salvas
- [ ] NPM Install executado
- [ ] App reiniciada
- [ ] Site validado em produção

## Próximos passos

1. Automatizar o pull via Git Version Control sempre que houver push na main.
2. Manter os logs sob revisão após cada alteração relevante.
3. Usar o GitHub como única origem de verdade do código.