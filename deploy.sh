#!/bin/bash
# Deploy do Sistema Gestão Igreja LDFP
# Uso: ~/deploy.sh
# Roda: git pull + copia arquivos publicos + restart Node

set -e

REPO="$HOME/sistema-gestao-igreja-ldfp-main"
PUBLIC_HTML="$HOME/public_html"

echo "=== Deploy iniciado: $(date) ==="

echo "[1/3] Atualizando codigo..."
cd "$REPO"
git pull

echo "[2/3] Copiando arquivos publicos..."
cp -r "$REPO/public/." "$PUBLIC_HTML/"

echo "[3/3] Reiniciando Node..."
touch "$REPO/tmp/restart.txt"

echo "=== Deploy concluido: $(date) ==="
echo "Site: https://ldfp.com.br"
