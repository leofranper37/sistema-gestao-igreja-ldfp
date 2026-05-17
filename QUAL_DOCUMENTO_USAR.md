# 📚 QUAL DOCUMENTO USAR?

Você tem 4 opções de sincronização. Escolha uma:

---

## 🚀 OPÇÃO 1: SUPER RÁPIDO (Recomendado)

**Arquivo**: `SUPER_SCRIPT_CPANEL.md`

**Como**: 
1. Copie TUDO o script bash do arquivo
2. Abra terminal cPanel (SSH)
3. Cole tudo de uma vez
4. Aguarde terminar (2-3 min)

**Vantagem**: Tudo automático, teste incluído  
**Desvantagem**: Se falhar, precisa debugar  
**Tempo**: ~3 minutos

---

## 📋 OPÇÃO 2: SEGURO (Passo a Passo)

**Arquivo**: `MANUAL_CPANEL_SYNC.md`

**Como**:
1. Leia cada seção
2. Copie APENAS o comando de cada seção
3. Cole no terminal cPanel
4. Aguarde confirmação
5. Passe para próxima seção

**Vantagem**: Você controla cada passo, vê erros imediatamente  
**Desvantagem**: Mais lento  
**Tempo**: ~10 minutos

---

## 🛠️ OPÇÃO 3: AUTOMÁTICO (Se tem acesso root SSH)

**Arquivo**: `sync-cpanel.sh`

**Como**:
```bash
cd ~
wget https://github.com/seu-repo/sync-cpanel.sh
chmod +x sync-cpanel.sh
./sync-cpanel.sh
```

**Vantagem**: Script profissional com logs  
**Desvantagem**: Precisa SSH direto  
**Tempo**: ~5 minutos

---

## 📊 OPÇÃO 4: VISUAL/COMPLETO

**Arquivos**:
- `STATUS_FINAL.md` - Ver o que foi feito
- `SYNC_MAP.md` - Entender a arquitetura
- `CPANEL_SYNC_CHECKLIST.md` - Checklist final

**Como**: Ler e entender antes de sincronizar

**Vantagem**: Entende tudo que vai fazer  
**Desvantagem**: Leitura longa  
**Tempo**: ~5 min leitura

---

## ✅ MINHA RECOMENDAÇÃO

### Se quer SÓ SINCRONIZAR RÁPIDO:
→ Use **OPÇÃO 1** (SUPER_SCRIPT_CPANEL.md)

### Se quer SEGURANÇA E CONTROLE:
→ Use **OPÇÃO 2** (MANUAL_CPANEL_SYNC.md)

### Se quer ENTENDER O QUE VAI FAZER:
→ Leia **OPÇÃO 4** primeiro, depois OPÇÃO 1 ou 2

---

## 🎯 FLUXO COMPLETO RECOMENDADO

```
1. Leia STATUS_FINAL.md (2 min) - Entende o escopo
2. Execute SUPER_SCRIPT_CPANEL.md (3 min) - Sincroniza tudo
3. Abra https://ldfp.com.br/planos.html - Verifica resultado
4. Pronto! ✅
```

**Tempo total**: ~5 minutos

---

## 🚨 TROUBLESHOOTING RÁPIDO

### Se /api/planos retorna erro:
```bash
# No cPanel terminal:
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT COUNT(*) FROM saas_planos WHERE ativo=1;"
# Deve retornar: 3
```

### Se planos.html mostra erro:
```bash
# No cPanel terminal:
curl -s https://ldfp.com.br/planos.html | grep -o "Erro\|Hebrom" | head -1
# Se mostrar "Hebrom" = OK
# Se mostrar "Erro" = Precisa debugar cache
```

### Se npm falha:
```bash
# No cPanel terminal:
cd ~/sistema-gestao-igreja-ldfp-main
npm install --no-optional
npm run build
```

---

## 📞 PRÓXIMAS AÇÕES

**Você vai fazer:**
1. Escolher uma opção acima
2. Executar no cPanel terminal
3. Me avisar se deu certo ou erro

**Qual opção quer usar?**
