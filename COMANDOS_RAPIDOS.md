# ⚡ COMANDOS RÁPIDOS - Deploy

## Ambiente de Produção (Oficial)

- Hospedagem oficial: **cPanel**
- Ambiente anterior: legado histórico, não usar para publicar novas versões

## Enviar Código para GitHub (1ª vez)

```bash
git add .
git commit -m "Preparando para o deploy online - v1.0"
git push origin main
```

---

## Fluxo Contínuo (Sempre que terminar uma funcionalidade)

```bash
git status
git add .
git commit -m "Descreve o que fizeste aqui"
git push origin main
```

---

## Verificações

### Ver status do repositório
```bash
git status
```

### Ver histórico de commits
```bash
git log --oneline
```

### Testar servidor localmente antes de fazer push
```bash
npm run dev
```

### Confirmar ambiente ativo em produção
```powershell
nslookup www.ldfp.com.br
Invoke-WebRequest -Uri "https://www.ldfp.com.br" -Method Head -UseBasicParsing | Select-Object -ExpandProperty Headers
```

---

## Environment Variables para cPanel

Copia estes dados para adicionar em Setup Node.js App > Environment Variables:

```
NODE_ENV=production
APP_BASE_URL=https://ldfp.com.br
APP_PUBLIC_BASE_URL=https://ldfp.com.br
DB_HOST=localhost
DB_PORT=3306
DB_USER=teu_usuario
DB_PASSWORD=tua_senha
DB_NAME=teu_banco
JWT_SECRET=teu_secret_aqui_minimo_32_caracteres
WHATSAPP_PROVIDER=mock
```

---

## URLs Importantes

- **GitHub**: https://github.com/leofranper37/sistema-gestao-igreja
- **cPanel**: painel do teu hosting
- **Domínio Final**: https://app.ldfp.com.br
- **Domínio Raiz**: https://ldfp.com.br
- **Teste Inicial**: usa o domínio ativo configurado no deploy atual

---

## Dúvidas Frequentes Rápidas

**P: Quanto tempo demora a atualizar após um git push?**
R: 1-3 minutos geralmente.

**P: Preciso fazer logout ou fechar o VS Code?**
R: Não, tudo funciona automaticamente em background.

**P: Posso fazer rollback se algo der errado?**
R: Sim, volta ao commit anterior no GitHub e faz Pull/Deploy no cPanel.

**P: E se esquecer de fazer git push?**
R: O site não atualiza. Lembra-te: código local ≠ código online sem git push.
