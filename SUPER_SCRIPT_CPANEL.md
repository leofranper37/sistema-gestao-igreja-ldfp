# 🚀 SUPER SCRIPT - COPIE E COLE NO cPanel TERMINAL (Tudo em um!)

```bash
#!/bin/bash
set -e

echo "🚀 SINCRONIZANDO LDFP EM PRODUÇÃO..."

# Parar processos
pkill -f "node|passenger" || true; sleep 2

# Navegar
cd ~

# Copiar arquivos
cp sistema-gestao-igreja-ldfp-main/public/planos.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/planos-data.json public_html/
cp sistema-gestao-igreja-ldfp-main/public/sw.js public_html/
cp sistema-gestao-igreja-ldfp-main/public/app_membro_v2.html public_html/
cp sistema-gestao-igreja-ldfp-main/server.js .
cp sistema-gestao-igreja-ldfp-main/app.js .

# Limpar cache
rm -f ~/public_html/tmp/*.lock 2>/dev/null || true
mkdir -p ~/public_html/tmp
touch ~/public_html/tmp/restart.txt

# npm
cd ~/sistema-gestao-igreja-ldfp-main
NPM_BIN=$(ls /opt/cpanel/ea-nodejs*/bin/npm 2>/dev/null | head -1)
[ -z "$NPM_BIN" ] && NPM_BIN="npm"
"$NPM_BIN" install --legacy-peer-deps && "$NPM_BIN" run build

# Restart marker
touch ~/public_html/tmp/restart.txt

echo "✅ SINCRONIZAÇÃO CONCLUÍDA!"
echo "⏳ Aguarde 10 segundos para Node.js reiniciar..."
sleep 10

echo "🔍 TESTANDO..."
echo ""
echo "Teste 1: /api/planos"
curl -s https://ldfp.com.br/api/planos | head -20
echo ""
echo "Teste 2: planos.html"
curl -s https://ldfp.com.br/planos.html | grep -o "Hebrom\|Betel\|Sião" | wc -l
echo ""
echo "Teste 3: app_membro_v2.html"
curl -I https://ldfp.com.br/app_membro_v2.html
echo ""
echo "✅ TUDO PRONTO!"
```

---

## 📋 COMO USAR:

### Opção 1: COPIAR E COLAR TUDO DE UMA VEZ

1. Copie TODO o bloco acima (linhas 5-52, do `#!/bin/bash` até o último `echo`)
2. Abra terminal SSH do cPanel
3. Cole tudo de uma vez
4. Aguarde terminar (deve levar 2-3 minutos)
5. Se tiver erros, veja seção "TROUBLESHOOTING"

### Opção 2: PASSO A PASSO (se preferir segurança)

Use o `MANUAL_CPANEL_SYNC.md` e execute cada passo individualmente.

---

## 🎯 SE TUDO DER CERTO:

Verá na tela:
```
✅ SINCRONIZAÇÃO CONCLUÍDA!
⏳ Aguarde 10 segundos para Node.js reiniciar...

🔍 TESTANDO...

Teste 1: /api/planos
[... JSON com 3 planos ...]

Teste 2: planos.html
3

Teste 3: app_membro_v2.html
HTTP/2 200 OK

✅ TUDO PRONTO!
```

---

## 🚨 SE ALGO FALHAR:

### Erro: npm não encontrado
Execute antes de rodar script:
```bash
export PATH="/opt/cpanel/ea-nodejs20/bin:$PATH"
```

### Erro: Cannot find module
```bash
rm -rf ~/sistema-gestao-igreja-ldfp-main/node_modules
npm install --legacy-peer-deps
```

### API ainda retorna erro
```bash
tail -100 ~/logs/error_log
tail -100 ~/public_html/error.log
```

---

## ✨ RESULTADO ESPERADO:

Após sincronização, abra seu browser em:
- ✅ https://ldfp.com.br/planos.html → 3 cartões de planos
- ✅ https://ldfp.com.br/app_membro_v2.html → Interface do membro
- ✅ https://ldfp.com.br/api/planos → JSON com planos

**Quer que eu ajude com algo específico?**
