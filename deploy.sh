#!/bin/bash
# Deploy do Sistema Gestão Igreja LDFP
# Uso: ~/deploy.sh  (ou bash ~/deploy.sh)
# Roda: git pull + copia src/public/app.js para o app em execucao + restart Node

set -e

REPO="/home/ldfp8965/sistema-gestao-igreja-ldfp-main"
APP="/home/ldfp8965/ldfp.com.br"

echo "=== Deploy iniciado: $(date) ==="

echo "[1/4] Atualizando codigo do repositorio..."
cd "$REPO"
git pull origin main

echo "[2/4] Copiando src/..."
cp -r "$REPO/src/." "$APP/src/"

echo "[3/4] Copiando public/ e app.js..."
cp -r "$REPO/public/." "$APP/public/"
cp "$REPO/app.js" "$APP/app.js"

echo "[4/4] Reiniciando Node..."
touch "$APP/tmp/restart.txt"

echo "=== Deploy concluido: $(date) ==="
echo "Site: https://ldfp.com.br"
echo ""
echo "Se package.json mudou, execute tambem:"
echo "  source /home/ldfp8965/nodevenv/ldfp.com.br/18/bin/activate && cd $APP && npm install"
