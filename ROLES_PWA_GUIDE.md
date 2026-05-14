# 📱 Sistema de Multi-Roles e PWA - LDFP Igreja

## 🎯 Visão Geral

Implementação completa de:
1. **Sistema de Permissões por Role** - Controle granular de acesso por usuário
2. **Progressive Web App (PWA)** - App mobile funcional sem instalação
3. **Interface de Portaria** - Registro de visitantes otimizado para smartphone
4. **Sincronização Offline** - Dados salvos mesmo sem internet

---

## 👥 Roles e Permissões

### Roles Definidos

| Role | Descrição | Ícone | Cor | Acesso |
|------|-----------|-------|-----|--------|
| **admin** | Administrador | 👑 | Vermelho | Total |
| **secretaria** | Secretaria | 💼 | Azul | Quase total (exceto financeiro delete) |
| **pastor** | Pastor | 📚 | Roxo | Gestão, não financeiro |
| **oficial** | Oficial | 🛡️ | Ciano | Visitantes, membros básico, agenda |
| **ministerio** | Integrante de Ministério | 🤝 | Verde | Membros, orações, crianças |
| **midia** | Mídia | 📷 | Laranja | Agenda, membros, mídia |
| **membro** | Membro | 👤 | Índigo | Orações, agenda (leitura) |
| **visitante** | Visitante | 🚶 | Cinza | Orações (criar), agenda (ler) |

---

## 🔒 Matriz de Permissões

### Membros
```
- listar:   admin, secretaria, pastor, oficial, ministerio
- editar:   admin, secretaria, pastor
- deletar:  admin, secretaria
```

### Visitantes (Portaria)
```
- listar:   admin, secretaria, pastor, oficial
- criar:    admin, secretaria, oficial          ← Portaria registra aqui
- editar:   admin, secretaria, oficial
- deletar:  admin, secretaria
```

### Orações
```
- listar:   admin, secretaria, pastor, oficial, ministerio, membro
- criar:    TODOS (até visitante)               ← Acesso aberto
- responder: admin, secretaria, pastor          ← Apenas lideranças
- editar:   admin, secretaria
- deletar:  admin, secretaria
```

### Agenda/Eventos
```
- listar:   admin, secretaria, pastor, oficial, ministerio, membro
- criar:    admin, secretaria, pastor
- editar:   admin, secretaria, pastor
- deletar:  admin, secretaria
```

### Crianças/EBD
```
- listar:   admin, secretaria, pastor, oficial
- criar:    admin, secretaria, pastor
- editar:   admin, secretaria, pastor
- deletar:  admin, secretaria
```

---

## 📁 Arquivos Criados/Modificados

### Backend

**1. `src/config/roles.js`** (NOVO)
- Define `ROLES` (8 tipos)
- Define `PERMISSIONS` (60+ features controladas)
- Define `MENU_FEATURES` (menu dinâmico por role)
- Funções: `hasPermission()`, `getVisibleFeatures()`, `getRoleInfo()`

**2. `src/middlewares/permissions.js`** (NOVO)
- `requireFeature(feature|[features])` - Verifica permissão (qualquer uma)
- `requireAllFeatures(features)` - Verifica permissão (todas)
- Usa `createHttpError(403)` para acesso negado

**3. Uso em Rotas**
```javascript
const { requireAuth } = require('../middlewares/auth');
const { requireFeature } = require('../middlewares/permissions');

// Apenas secretaria e admin podem deletar membros
router.delete('/membros/:id', 
    requireAuth,
    requireFeature('membros.deletar'),
    controller.deleteMembro
);

// Qualquer um pode ler orações
router.get('/oracoes/mural',
    requireAuth,
    requireFeature('oracoes.listar'),
    controller.listMuralOracoes
);
```

---

## 📱 Progressive Web App (PWA)

### Arquivos Criados

**1. `public/manifest.json`** (NOVO)
- Metadados do app (nome, ícones, cores)
- Shortcuts (Orações, Agenda, Visitantes)
- Share target
- Suporta Dark/Light mode

**2. `public/sw.js`** (NOVO - Service Worker)
- **Install**: cacheia assets estáticos
- **Fetch**: serve do cache, sincroniza online
- **Push notifications**: suporte para notificações
- **Background sync**: sincroniza dados quando volta online
- **Offline support**: funciona sem internet

**3. `public/pwa.js`** (NOVO - PWA Manager)
```javascript
window.pwa = new PWAManager();

// Métodos disponíveis:
window.pwa.promptInstall()        // Mostra tela de instalação
window.pwa.showNotification(...)  // Envia notificação
window.pwa.syncPendingData()      // Sincroniza dados offline
window.pwa.getStatus()            // Status do PWA
```

### Como Funciona

1. **Visitante acessa de smartphone** → browser oferece "Instalar app"
2. **Clica instalar** → app fica na tela inicial (como app nativo)
3. **Abre como standalone** → fullscreen, sem barra do navegador
4. **Funciona offline** → dados em cache, sincroniza quando volta online
5. **Notificações push** → recebe notificações do sistema

---

## 🏢 Página Especial de Portaria

### `public/portaria.html` (NOVO)

Otimizada para **smartphone em modo portrait**, uso com uma mão:

**Funcionalidades:**
- ✅ Formulário simplificado (nome, email, telefone, cidade, gênero, evento)
- ✅ Registra visitante diretamente em `/visitantes` API
- ✅ Últimos visitantes registrados (hoje)
- ✅ Botões grandes (thumb-friendly)
- ✅ Modo offline com sincronização
- ✅ Feedback imediato (✓ sucesso ou erro)

**Fluxo Portaria:**
1. Visitante chega na porta
2. **Oficial** ou **secretaria** abre portaria.html
3. Preenche nome, contato, cidade
4. Clica "Registrar Visitante"
5. API registra em `/visitantes` com datetime
6. Exibe "Registrado com sucesso"
7. Form limpa para próximo

**Layout:**
```
[Header: Registro de Visitantes]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Mensagem (sucesso/erro)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Novo Visitante
| [Nome         ]
| [Email        ]
| [Telefone     ]
| [Cidade       ]
| [Gênero    ▼  ]
| [Como conheceu? ▼]
| [Observações...]
| [Registrar Visitante]
━━━━━━━━━━━━━━━━━━━━━━━━━━━
| Últimos Registrados
| • João Silva (5m atrás)
| • Maria Santos (12m atrás)
━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Limpar] [Ver Todos]
```

---

## 🔧 Como Usar

### 1. Configurar Role de um Usuário

Na tabela `users`, coluna `role`:

```sql
UPDATE users 
SET role = 'secretaria' 
WHERE id = 123;

-- Opções: admin, secretaria, pastor, oficial, ministerio, midia, membro, visitante
```

### 2. Usar Middleware de Permissão

```javascript
const { requireFeature } = require('../middlewares/permissions');

// Rota protegida
router.post('/oracoes/:id/resposta',
    requireAuth,
    requireFeature('oracoes.responder'),  // Só admin, secretaria, pastor
    controller.updateOracaoResposta
);
```

### 3. Verificar Permissão no Frontend

```javascript
const { hasPermission } = require('../config/roles');

if (hasPermission(req.auth.role, 'oracoes.responder')) {
    // Mostra botão de responder
}
```

### 4. Acessar Portaria via Mobile

```
Desktop: http://localhost:3001/portaria.html
Mobile:  http://[SEU_IP]:3001/portaria.html

# Depois clica "Instalar app" no navegador mobile
```

---

## 📊 Fluxos por Role

### 🏢 Secretaria (Acesso completo ao web)
- ✅ Dashboard completo
- ✅ Gerenciar membros, visitantes, crianças
- ✅ Financeiro (ler/criar/editar)
- ✅ Responder orações
- ✅ Criar eventos, missionários

### 👨‍💼 Pastor
- ✅ Dashboard
- ✅ Ler membros, visitantes
- ✅ Responder orações
- ✅ Criar/editar eventos
- ❌ Financeiro

### 🛡️ Oficial (Portaria com smartphone)
- ✅ **Registrar visitantes** (portaria.html)
- ✅ Ler membros
- ✅ Ler agenda
- ✅ Ler orações
- ❌ Criar eventos, editar membros

### 🤝 Integrante de Ministério
- ✅ Ler membros
- ✅ **Criar pedidos de oração** (oracoes.html)
- ✅ Ler agenda
- ✅ Crianças (ler/criar)
- ❌ Gerenciar financeiro

### 📷 Mídia
- ✅ Ler agenda
- ✅ Ler membros
- ✅ **Upload de mídia**
- ❌ Editar membros, criar eventos

### 👤 Membro
- ✅ Ler própias orações
- ✅ **Criar novo pedido de oração**
- ✅ Ler agenda (leitura)
- ❌ Editar nada

### 🚶 Visitante (Acesso mínimo)
- ✅ **Criar novo pedido de oração**
- ✅ Ler agenda pública
- ❌ Acessar membros
- ❌ Acessar visitantes

---

## 🚀 Roadmap

### ✅ Implementado
- [x] Sistema 8 roles com 60+ permissões granulares
- [x] Middleware de verificação por feature
- [x] PWA com Service Worker, cache e offline
- [x] Página Portaria otimizada mobile
- [x] Notificações push
- [x] Background sync

### 📋 Próximos Passos (Opcional)
- [ ] Criar ícones de app (192x192, 512x512)
- [ ] Criar splash screens (1280x720)
- [ ] Implementar formulário dinâmico por role
- [ ] Painel de admin para gerenciar permissões
- [ ] Logs de auditoria por ação
- [ ] QR code para registro de visitantes
- [ ] Offline data sync com retry logic
- [ ] App nativo (React Native) para iOS/Android

---

## 🔐 Segurança

1. **Autenticação**: JWT continua válido
2. **Autorização**: Verificação de permissão em cada request
3. **Validação**: Joi schemas continuam validando input
4. **Offline**: Dados sensíveis não são sincronizados
5. **Cache**: Service worker não cacheia dados sensíveis (API)

---

## 📱 Teste Rápido

### No PC (Desktop)
```
1. Abra http://localhost:3001/dashboard.html
2. Se credenciais corretas, vê todos os cards
3. Menu à esquerda reflete seu role
```

### No Smartphone
```
1. Abra http://[IP_DO_PC]:3001/portaria.html
2. Clique em "..." > "Instalar app"
3. Registre alguns visitantes
4. Desligue internet (wifi + mobile data)
5. Tente registrar mais - funciona offline!
6. Ligue internet novamente - sincroniza automaticamente
```

---

## 📞 Suporte

Qualquer dúvida sobre roles ou PWA, consulte os arquivos:
- Permissões: `src/config/roles.js`
- Middleware: `src/middlewares/permissions.js`
- PWA: `public/pwa.js`, `public/sw.js`
- Portaria: `public/portaria.html`

