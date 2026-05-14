# 🚀 Configuração do Neon PostgreSQL + cPanel

## Passo 1: Obter String de Conexão no Neon

1. Acesse: https://console.neon.tech
2. Faça login com sua conta
3. Selecione seu projeto
4. Vá em **"Connection String"**
5. Escolha **"Pooled connection"** (mais eficiente para uso em produção)
6. Copie a URL completa que começa com `postgresql://`
   - Exemplo: `postgresql://user:password@ep-tiny-frost-12345.us-east-1.neon.tech:5432/database?sslmode=require`

## Passo 2: Adicionar no cPanel

### Via Setup Node.js App (Recomendado)
1. Acesse o cPanel
2. Abra **Setup Node.js App**
3. Selecione a aplicação do sistema
4. Vá em **Environment Variables**
5. Adicione:
   - **Name:** `DATABASE_URL`
   - **Value:** Cole a string do Neon
6. Salve as variáveis

### Via CLI (Alternativa)
```bash
export DATABASE_URL='postgresql://user:password@host:5432/database?sslmode=require'
```

## Passo 3: Testar a Conexão

Depois de adicionar, faça um novo deploy:
```bash
git add .
git commit -m "feat: add Neon PostgreSQL configuration for cPanel"
git push origin main
```

cPanel vai aplicar a nova versão após Pull/Deploy e Restart da aplicação Node.

## Configuração Automática

O código já suporta PostgreSQL via `DATABASE_URL`:
- ✅ Detecta automaticamente se é PostgreSQL, MySQL ou SQLite
- ✅ Adapta queries SQL para cada banco
- ✅ Gerencia conexões pooled

## Troubleshooting

### Erro: "connection refused"
- Verifique se a string está correta
- Certifique-se de usar a **pooled connection** (não unpooled)
- Confirme que a string está completa e com `sslmode=require`

### Erro: "SSL required"
- O Neon exige SSL ✅
- Não remova `?sslmode=require` da string

### Migração de Dados
Se precisa migrar dados do SQLite para Neon:
```bash
# Exportar schema do SQLite
sqlite3 ldfp_db.sqlite ".schema" > backup.sql

# Importar no Neon via console ou SQL Editor
```

## Status da Implementação

✅ Code já suporta PostgreSQL  
✅ Variáveis de ambiente configuradas  
⏳ Aguardando: Adicionar `DATABASE_URL` no cPanel  
