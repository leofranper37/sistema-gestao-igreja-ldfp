# 🔧 SINCRONIZAÇÃO MANUAL - cPanel Terminal

Copie e cole **CADA COMANDO** sequencialmente no terminal SSH do cPanel.

---

## 📌 PASSO 1: Parar Node.js/Passenger

```bash
pkill -f "node|passenger" || true
sleep 3
echo "✅ Processo parado"
```

**Esperado**: Sem erros

---

## 📌 PASSO 2: Verificar banco de dados

```bash
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT COUNT(*) FROM saas_planos WHERE ativo=1;"
```

**Esperado**: Retorna um número (0, 1, 2, ou 3)

---

## 📌 PASSO 3: Popular banco se vazio (SE retornou 0, 1 ou 2)

Se a conta anterior retornou menos de 3, execute:

```bash
mysql -u ldfp8965_user -p ldfp8965_bd << 'EOSQL'
DELETE FROM saas_planos WHERE ativo=1;

INSERT INTO saas_planos (slug, nome, subtitulo, preco_mensal, preco_anual, max_cadastros, max_congregacoes, modulo_app_membro, features_json, ativo)
VALUES
('hebrom', 'Hebrom', 'Igrejas em formacao', 50, 500, 150, 1, 0, '["App Web Instalavel (PWA)","150 cadastros","1 congregacao","Suporte via e-mail"]', 1),
('betel', 'Betel', 'Igrejas em crescimento', 80, 800, 300, 5, 1, '["App do Membro","300 cadastros","5 congregacoes","Suporte via e-mail e WhatsApp"]', 1),
('siao', 'Siao', 'Operacao avancada', 100, 1000, 500, 10, 1, '["App do Membro","500 cadastros","10 congregacoes","Suporte prioritario"]', 1);
EOSQL

echo "✅ 3 planos inseridos"
```

**Esperado**: Mensagem "✅ 3 planos inseridos"

---

## 📌 PASSO 4: Copiar arquivos críticos

```bash
cd ~

cp sistema-gestao-igreja-ldfp-main/public/planos.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/planos-data.json public_html/
cp sistema-gestao-igreja-ldfp-main/public/sw.js public_html/
cp sistema-gestao-igreja-ldfp-main/public/app_membro_v2.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/app_membro.html public_html/
cp sistema-gestao-igreja-ldfp-main/server.js .
cp sistema-gestao-igreja-ldfp-main/app.js .

echo "✅ Arquivos copiados"
```

**Esperado**: Mensagem "✅ Arquivos copiados" (sem erros)

---

## 📌 PASSO 5: Limpar cache

```bash
rm -f ~/public_html/tmp/*.lock 2>/dev/null || true
rm -rf ~/tmp/passenger* 2>/dev/null || true
mkdir -p ~/public_html/tmp
touch ~/public_html/tmp/restart.txt

echo "✅ Cache limpo"
```

**Esperado**: Mensagem "✅ Cache limpo"

---

## 📌 PASSO 6: npm install e build

### Primeiro, encontrar npm:

```bash
NPM_BIN=$(ls /opt/cpanel/ea-nodejs*/bin/npm 2>/dev/null | head -1 || ls /opt/alt/alt-nodejs*/root/usr/bin/npm 2>/dev/null | head -1)
echo "npm: $NPM_BIN"
```

**Esperado**: Exibe caminho de npm (ex: `/opt/cpanel/ea-nodejs20/bin/npm`)

### Se não encontrou npm:

```bash
# Tente isto:
npm install
npm run build
```

### Se encontrou npm, execute:

```bash
cd ~/sistema-gestao-igreja-ldfp-main
$NPM_BIN install --legacy-peer-deps
$NPM_BIN run build
```

**Esperado**: Termina sem erros, mostrando "dist/" criado

---

## 📌 PASSO 7: Marcar restart

```bash
touch ~/public_html/tmp/restart.txt
sleep 5
echo "✅ Aplicação pronta para reinício"
```

**Esperado**: Mensagem de sucesso

---

## ✅ PASSO 8: Verificar tudo

### Verificar banco:

```bash
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT slug, nome, preco_mensal FROM saas_planos WHERE ativo=1 ORDER BY preco_mensal;"
```

**Esperado**: 
```
hebrom  Hebrom  50
betel   Betel   80
siao    Siao    100
```

---

### Verificar arquivos copiados:

```bash
ls -lh ~/public_html/planos.html ~/public_html/planos-data.json ~/public_html/sw.js
```

**Esperado**: Exibe 3 arquivos com tamanho

---

### Testar endpoints (aguarde 10 segundos após restart.txt):

```bash
sleep 10

# Teste 1: /api/planos
curl -s https://ldfp.com.br/api/planos | head -20
```

**Esperado**: JSON com planos

```bash
# Teste 2: planos.html
curl -s https://ldfp.com.br/planos.html | grep -o "Hebrom\|Betel\|Sião" | wc -l
```

**Esperado**: `3`

```bash
# Teste 3: app_membro_v2.html
curl -I https://ldfp.com.br/app_membro_v2.html
```

**Esperado**: `HTTP/2 200`

---

## 🚨 SE ALGO FALHAR

### Se /api/planos retorna `[]` ou erro:

```bash
# Verifique logs
tail -50 ~/public_html/error.log
tail -50 ~/logs/error_log
```

### Se npm install falha:

```bash
# Tente limpar cache
rm -rf ~/sistema-gestao-igreja-ldfp-main/node_modules
$NPM_BIN install --no-optional
```

### Se Node.js não inicia:

```bash
# Mate todos os processos
pkill -9 -f "node|passenger"
touch ~/public_html/tmp/restart.txt
sleep 10
curl -I https://ldfp.com.br/api/planos
```

---

## ✨ FIM!

Se todos os testes retornaram ✅, está 100% sincronizado!

**Abra em seu browser**: https://ldfp.com.br/planos.html

Deve mostrar 3 cartões de planos sem erro!
