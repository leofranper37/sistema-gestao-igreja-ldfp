#!/bin/bash

# 🔧 SCRIPT DE SINCRONIZAÇÃO AUTOMÁTICA - LDFP em cPanel
# Data: 16 de maio de 2026
# Objetivo: Sincronizar tudo de localhost para produção

set -e  # Para em qualquer erro

echo "═══════════════════════════════════════════════════════════"
echo "🚀 INICIANDO SINCRONIZAÇÃO AUTOMÁTICA DO LDFP"
echo "═══════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────
# PASSO 1: Parar Node.js/Passenger
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [1/6] Parando Node.js e Passenger..."
pkill -f "node|passenger" || true
sleep 3
echo "✅ Node.js e Passenger parados"

# ─────────────────────────────────────────────────────────────
# PASSO 2: Verificar/Criar banco de dados e tabela
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [2/6] Verificando banco de dados MySQL..."

# Verificar se tabela existe e tem dados
COUNT=$(mysql -u ldfp8965_user -p"$MYSQL_PASSWORD" ldfp8965_bd -e "SELECT COUNT(*) FROM saas_planos WHERE ativo=1;" 2>/dev/null | tail -1)

if [ "$COUNT" -lt 3 ]; then
    echo "⚠️  Tabela vazia ou incompleta ($COUNT registros). Inserindo 3 planos..."
    mysql -u ldfp8965_user -p"$MYSQL_PASSWORD" ldfp8965_bd << 'EOSQL'
DELETE FROM saas_planos WHERE ativo=1;

INSERT INTO saas_planos (slug, nome, subtitulo, preco_mensal, preco_anual, max_cadastros, max_congregacoes, modulo_app_membro, features_json, ativo)
VALUES
('hebrom', 'Hebrom', 'Igrejas em formacao', 50, 500, 150, 1, 0, '["App Web Instalavel (PWA)","150 cadastros","1 congregacao","Suporte via e-mail"]', 1),
('betel', 'Betel', 'Igrejas em crescimento', 80, 800, 300, 5, 1, '["App do Membro","300 cadastros","5 congregacoes","Suporte via e-mail e WhatsApp"]', 1),
('siao', 'Siao', 'Operacao avancada', 100, 1000, 500, 10, 1, '["App do Membro","500 cadastros","10 congregacoes","Suporte prioritario"]', 1);
EOSQL
    echo "✅ 3 planos inseridos no banco de dados"
else
    echo "✅ Banco de dados OK ($COUNT planos)"
fi

# ─────────────────────────────────────────────────────────────
# PASSO 3: Sincronizar arquivos críticos
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [3/6] Sincronizando arquivos críticos..."

cd ~

# Copiar arquivos essenciais
cp sistema-gestao-igreja-ldfp-main/public/planos.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/planos-data.json public_html/
cp sistema-gestao-igreja-ldfp-main/public/sw.js public_html/
cp sistema-gestao-igreja-ldfp-main/public/app_membro_v2.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/app_membro.html public_html/
cp sistema-gestao-igreja-ldfp-main/server.js .
cp sistema-gestao-igreja-ldfp-main/app.js .

echo "✅ Arquivos copiados com sucesso"

# Verificar que foram copiados
echo "   → planos.html: $(ls -lh ~/public_html/planos.html | awk '{print $5}')"
echo "   → planos-data.json: $(ls -lh ~/public_html/planos-data.json | awk '{print $5}')"
echo "   → sw.js: $(ls -lh ~/public_html/sw.js | awk '{print $5}')"

# ─────────────────────────────────────────────────────────────
# PASSO 4: Limpar cache e lock files
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [4/6] Limpando cache e lock files..."

rm -f ~/public_html/tmp/*.lock 2>/dev/null || true
rm -rf ~/tmp/passenger* 2>/dev/null || true
mkdir -p ~/public_html/tmp
touch ~/public_html/tmp/restart.txt

echo "✅ Cache e lock files limpos"

# ─────────────────────────────────────────────────────────────
# PASSO 5: Atualizar Node.js com npm
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [5/6] Instalando dependências e fazendo build..."

# Encontrar npm
NPM_BIN=$(ls /opt/cpanel/ea-nodejs*/bin/npm 2>/dev/null | head -1 || ls /opt/alt/alt-nodejs*/root/usr/bin/npm 2>/dev/null | head -1)

if [ -z "$NPM_BIN" ]; then
    echo "❌ ERRO: npm não encontrado no cPanel"
    exit 1
fi

echo "   npm encontrado em: $NPM_BIN"

cd ~/sistema-gestao-igreja-ldfp-main

# npm install
echo "   Executando npm install..."
"$NPM_BIN" install --legacy-peer-deps 2>&1 | tail -5

# npm run build
echo "   Executando npm run build..."
"$NPM_BIN" run build 2>&1 | tail -5

echo "✅ npm install e build completos"

# ─────────────────────────────────────────────────────────────
# PASSO 6: Marcar para reinício e aguardar
# ─────────────────────────────────────────────────────────────
echo ""
echo "📌 [6/6] Marcando aplicação para reinício..."

touch ~/public_html/tmp/restart.txt
sleep 5

echo "✅ Aplicação marcada para reinício"

# ─────────────────────────────────────────────────────────────
# VERIFICAÇÃO FINAL
# ─────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ SINCRONIZAÇÃO CONCLUÍDA!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📊 PRÓXIMAS VERIFICAÇÕES (execute em outro terminal):"
echo ""
echo "1️⃣  Verificar banco de dados:"
echo "   mysql -u ldfp8965_user -p ldfp8965_bd -e \"SELECT slug, nome, preco_mensal FROM saas_planos WHERE ativo=1;\""
echo ""
echo "2️⃣  Testar planos.html:"
echo "   curl -s https://ldfp.com.br/planos.html | grep -o 'Hebrom\\|Betel\\|Sião' | wc -l"
echo "   (Esperado: 3)"
echo ""
echo "3️⃣  Testar API /api/planos:"
echo "   curl -s https://ldfp.com.br/api/planos | head -20"
echo ""
echo "4️⃣  Testar app_membro_v2.html:"
echo "   curl -I https://ldfp.com.br/app_membro_v2.html"
echo "   (Esperado: HTTP 200)"
echo ""
echo "═══════════════════════════════════════════════════════════"
