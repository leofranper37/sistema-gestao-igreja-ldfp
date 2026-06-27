# 🔧 Checklist de Sincronização cPanel → Produção

**Data**: 16 de maio de 2026  
**Objetivo**: Sincronizar aplicação local com produção e garantir que planos.html funciona

---

## 📋 PARTE 1: Verificação de Banco de Dados

Execute **NO terminal do cPanel**:

```bash
# 1. Conectar ao MySQL e verificar tabela saas_planos
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT COUNT(*) as total_planos FROM saas_planos WHERE ativo=1;"

# Se retornar 0 ou erro, inserir os planos:
mysql -u ldfp8965_user -p ldfp8965_bd << 'EOSQL'
INSERT INTO saas_planos (slug, nome, subtitulo, preco_mensal, preco_anual, max_cadastros, max_congregacoes, modulo_app_membro, features_json, ativo)
VALUES
('hebrom', 'Hebrom', 'Igrejas em formacao', 50, 500, 150, 1, 0, '["App Web Instalavel (PWA)","150 cadastros","1 congregacao","Suporte via e-mail"]', 1),
('betel', 'Betel', 'Igrejas em crescimento', 80, 800, 300, 5, 1, '["App do Membro","300 cadastros","5 congregacoes","Suporte via e-mail e WhatsApp"]', 1),
('siao', 'Siao', 'Operacao avancada', 100, 1000, 500, 10, 1, '["App do Membro","500 cadastros","10 congregacoes","Suporte prioritario"]', 1);
EOSQL

# 2. Verificar que foram inseridos
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT slug, nome, preco_mensal FROM saas_planos WHERE ativo=1 ORDER BY preco_mensal;"
```

---

## 📁 PARTE 2: Sincronizar Arquivos Críticos

Execute **NO terminal do cPanel**:

```bash
# 1. Parar Node.js/Passenger
pkill -f "node|passenger" || true
sleep 2

# 2. Copiar arquivos do repositório para public_html
cd ~
cp sistema-gestao-igreja-ldfp-main/public/planos.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/planos-data.json public_html/
cp sistema-gestao-igreja-ldfp-main/public/sw.js public_html/
cp sistema-gestao-igreja-ldfp-main/server.js .
cp sistema-gestao-igreja-ldfp-main/app.js .

# 3. Verificar que os arquivos foram copiados
ls -lh ~/public_html/planos.html ~/public_html/planos-data.json ~/public_html/sw.js

# 4. Limpar cache e lock files
rm -f ~/public_html/tmp/*.lock 2>/dev/null || true
rm -rf ~/tmp/passenger* 2>/dev/null || true

# 5. Marcar app para reiniciar
touch ~/public_html/tmp/restart.txt

echo "✅ Arquivos sincronizados"
```

---

## 🔄 PARTE 3: Atualizar Node.js com npm (backend com fallback)

Execute **NO terminal do cPanel**:

```bash
# 1. Encontrar o caminho correto do npm
NPM_BIN=$(ls /opt/cpanel/ea-nodejs*/bin/npm 2>/dev/null | head -1 || ls /opt/alt/alt-nodejs*/root/usr/bin/npm 2>/dev/null | head -1)
echo "npm encontrado em: $NPM_BIN"

# 2. Navegar para repositório
cd ~/sistema-gestao-igreja-ldfp-main

# 3. Instalar dependências e fazer build
"$NPM_BIN" install 2>&1 | tail -20
"$NPM_BIN" run build 2>&1 | tail -20

echo "✅ npm install e build completos"
```

---

## ✅ PARTE 4: Verificação de Acesso

Execute **NO seu localhost ou cPanel terminal**:

```bash
# 1. Verificar se planos.html está acessível
curl -I https://ldfp.com.br/planos.html
# Esperado: HTTP 200

# 2. Verificar se planos-data.json está acessível
curl -s https://ldfp.com.br/planos-data.json | head -5
# Esperado: JSON com 3 planos

# 3. Verificar se /api/planos retorna dados
curl -s https://ldfp.com.br/api/planos | head -20
# Esperado: JSON com planos ou fallback

# 4. Testar app_membro_v2.html
curl -I https://ldfp.com.br/app_membro_v2.html
# Esperado: HTTP 200
```

---

## 📊 PARTE 5: Teste no Browser

1. Abra **https://ldfp.com.br/planos.html**
   - Devem aparecer 3 cartões: Hebrom, Betel, Sião
   - Cada um com preço, features e botões de ação

2. Se não aparecer, pressione **F12** (DevTools) e procure por:
   - Aba "Console" → erro? qual é?
   - Aba "Network" → planos-data.json ou /api/planos → qual status (200, 404, 500)?

3. Teste **https://ldfp.com.br/app_membro_v2.html**
   - Deve carregar interface com "Mural da Igreja"

---

## 🐛 Se Algo Falhar

**Se planos.html ainda mostrar erro:**

1. Verifique a saída de DevTools (F12 → Console)
2. Execute no cPanel terminal:
   ```bash
   # Logs de erro
   tail -100 ~/public_html/error.log
   tail -100 ~/logs/access_log
   tail -100 ~/logs/error_log
   ```

3. Se /api/planos retorna `[]` vazio:
   - Execute Parte 1 novamente (verificar saas_planos no banco)

4. Se /api/planos retorna erro 503:
   - Node.js pode estar travado: `pkill -f node; touch ~/public_html/tmp/restart.txt`

---

## ✨ Checklist Final

- [ ] Banco de dados: saas_planos tem 3 planos com ativo=1
- [ ] Arquivos copiados: planos.html, planos-data.json, sw.js presentes em ~/public_html/
- [ ] npm install/build executado sem erros
- [ ] https://ldfp.com.br/planos.html carrega 3 cartões de planos
- [ ] https://ldfp.com.br/api/planos retorna JSON com planos
- [ ] https://ldfp.com.br/app_membro_v2.html carrega corretamente

**Se todos os ✅ estiverem marcados, aplicação está 100% sincronizada!**
