# 📊 Mapa de Sincronização: Localhost vs cPanel

## 🎯 RESUMO VISUAL

```
LOCALHOST (D:\sistema-gestao-igreja-main)          →    cPanel (ldfp.com.br)
════════════════════════════════════════               ══════════════════════

Arquivos Críticos de FRONTEND:
─────────────────────────────
public/planos.html                                  →    /home/ldfp8965/public_html/planos.html
public/planos-data.json                             →    /home/ldfp8965/public_html/planos-data.json
public/sw.js                                        →    /home/ldfp8965/public_html/sw.js
public/app_membro_v2.html                           →    /home/ldfp8965/public_html/app_membro_v2.html

Arquivos Críticos de BOOTSTRAP:
───────────────────────────────
server.js (raiz)                                    →    /home/ldfp8965/server.js
app.js (raiz)                                       →    /home/ldfp8965/app.js

Backend Node.js + Rotas:
─────────────────────────
src/app.js (Express setup)                          →    Roda em Node.js (porta 3001)
src/routes/paymentRoutes.js (com /api/planos)       →    Expõe GET /api/planos
src/controllers/paymentController.js                →    Retorna planos com FALLBACK automático

Banco de Dados:
───────────────
N/A (local SQLite ou MySQL)                         →    MySQL em ldfp8965_bd
                                                        Tabela: saas_planos (3 registros)
                                                        Slugs: hebrom, betel, siao
```

---

## ✅ CHECKLIST DE ARQUIVOS ESSENCIAIS

### 1️⃣ FRONTEND (deve estar em /public/ ou copiado para cPanel)

| Arquivo | Objetivo | Status |
|---------|----------|--------|
| `planos.html` | Landing page com fallback chain | ✅ Tem |
| `planos-data.json` | JSON estático de planos | ✅ Tem |
| `sw.js` | Service Worker com CACHE_NAME=v8 | ✅ Tem v8 |
| `app_membro_v2.html` | Dashboard do membro | ✅ Tem |
| `app_membro.html` | Versão antiga (opcional) | ✅ Tem |

**Fallback Chain em planos.html:**
```
1. Tenta fetch('planos-data.json')  ← JSON ESTÁTICO
2. Se falhar, tenta /api/pagamentos/planos  ← API
3. Se falhar, tenta /api/planos  ← API alternativo
4. Se falhar, usa PLANOS_FALLBACK hardcoded  ← Array em JS
```

### 2️⃣ BACKEND (deve estar rodando em Node.js)

| Arquivo | Objetivo | Status |
|---------|----------|--------|
| `server.js` (raiz) | Inicializa banco + Express | ✅ Tem |
| `app.js` (raiz) | Bootstrap para cPanel Passenger | ✅ Tem |
| `src/app.js` | Setup Express com middlewares | ✅ Tem |
| `src/routes/paymentRoutes.js` | Rotas `/api/planos` e `/api/pagamentos/planos` | ✅ Tem |
| `src/controllers/paymentController.js` | Lógica com FALLBACK | ✅ ATUALIZADO |

**Endpoints Críticos:**
- `GET /api/planos` → Retorna array de planos (com fallback)
- `GET /api/pagamentos/planos` → Alias do anterior
- Status esperado: **200 OK** com JSON array

### 3️⃣ BANCO DE DADOS (MySQL em cPanel)

| Item | Descrição | Status |
|------|-----------|--------|
| Tabela | `saas_planos` | ✅ Deve existir |
| Registros | 3 planos: hebrom, betel, siao | 🔴 VERIFICAR |
| Coluna `ativo` | Todos com valor = 1 | 🔴 VERIFICAR |

---

## 🔍 FLUXO DE REQUISIÇÃO

### Quando usuário acessa https://ldfp.com.br/planos.html:

```
1. Browser solicita /planos.html
   ↓
2. cPanel/Passenger serve public_html/planos.html
   ↓
3. Browser executa JavaScript em planos.html
   ↓
4. JavaScript tenta carregar dados (4 tentativas):
   
   Tentativa 1: fetch('planos-data.json')
   → Se sucesso: exibe planos ✅
   → Se falhar: tenta Tentativa 2
   
   Tentativa 2: fetch('/api/pagamentos/planos')
   → Vai para Node.js em localhost:3001/api/pagamentos/planos
   → Se sucesso: exibe planos ✅
   → Se falhar: tenta Tentativa 3
   
   Tentativa 3: fetch('/api/planos')
   → Vai para Node.js em localhost:3001/api/planos
   → Se sucesso: exibe planos ✅
   → Se falhar: tenta Tentativa 4
   
   Tentativa 4: usa PLANOS_FALLBACK (hardcoded no HTML)
   → Exibe planos 100% garantido ✅

5. Telas exibe 3 cartões: Hebrom (R$50), Betel (R$80), Sião (R$100)
```

---

## 🚀 SINCRONIZAÇÃO PASSO A PASSO

### PASSO 1: Verificar Banco (cPanel terminal)
```bash
mysql -u ldfp8965_user -p ldfp8965_bd -e "SELECT COUNT(*) FROM saas_planos WHERE ativo=1;"
```
Expected: `3`

### PASSO 2: Copiar Arquivos (cPanel terminal)
```bash
cd ~
cp sistema-gestao-igreja-ldfp-main/public/planos.html public_html/
cp sistema-gestao-igreja-ldfp-main/public/planos-data.json public_html/
cp sistema-gestao-igreja-ldfp-main/public/sw.js public_html/
```

### PASSO 3: Rebuild Backend (cPanel terminal)
```bash
cd sistema-gestao-igreja-ldfp-main
npm install && npm run build
```

### PASSO 4: Testar (Browser ou curl)
```bash
curl https://ldfp.com.br/planos.html | grep -o "Hebrom\|Betel\|Sião" | wc -l
```
Expected: `3` (um de cada)

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ **Atualizei**: `paymentController.js` com fallback automático
2. 🔄 **Você precisa fazer**: Executar CPANEL_SYNC_CHECKLIST.md
3. ✅ **Resultado esperado**: https://ldfp.com.br/planos.html mostra 3 planos

**Quer que eu execute algum passo agora?**
