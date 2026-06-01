# 📍 ONDE PAREI — Sistema Gestão Igreja LDFP

> Atualize este arquivo ao final de cada sessão de trabalho.
> Ao abrir o VS Code, comece por aqui.

---

## 🗓️ Última atualização: 31/05/2026

## ✅ Último commit enviado
- **Hash:** `58fe7c4`
- **Branch:** `main`
- **Repo:** `leofranper37/sistema-gestao-igreja-ldfp`
- **Mensagem:** `docs: adiciona ONDE_PAREI.md para continuidade entre sessoes`

---

## ✅ O que já está feito (pronto e no GitHub)

| Item | Descrição | Commit |
|------|-----------|--------|
| Script backup por igreja | `scripts/backup-por-igreja.js` — exporta dados por igreja em JSON | `631236b` |
| Isolamento rotas super-admin | `isSuperAdmin` middleware bloqueia `role: admin` | `631236b` |
| API + UI backup/recuperação | `backupController.js` + `admin-backup.html` | `631236b` |
| Role guard 6 páginas admin | `admin-modulos`, `admin-assinaturas`, `admin-edicao-cliente`, `admin-igrejas`, `admin-planos`, `admin-retomada` corrigidos para somente super-admin | `8ed84bd` |
| SQL migration módulos | `CRIAR_TABELAS_MODULOS.sql` — cria `saas_modulos`, `saas_plano_modulos`, `igreja_modulos` | `8ed84bd` |

---

## ✅ Pendente no servidor (cPanel) — TUDO CONCLUÍDO EM 31/05/2026

### ✅ 1. Código atualizado no servidor
```bash
cd /home/ldfp8965/ldfp.com.br && git pull && touch tmp/restart.txt
```

### ✅ 2. Tabelas criadas + 15 módulos inseridos no banco
- `saas_modulos`, `saas_plano_modulos`, `igreja_modulos` criadas
- 15 módulos inseridos via phpMyAdmin

### ✅ 3. Cron job de backup automático
- Configurado no cPanel: todo dia às 03:00h
- Comando: `cd /home/ldfp8965/ldfp.com.br && node scripts/backup-por-igreja.js >> /home/ldfp8965/backups/backup.log 2>&1`

### ✅ 4. Webhook Mercado Pago
- URL registrada: `https://ldfp.com.br/api/pagamentos/webhook/mercado-pago`
- Evento: Pagamentos
- **Pendente**: adicionar `MP_WEBHOOK_SECRET=<valor>` no `.env` do servidor

---

## 🏗️ Backlog (funcionalidades ainda não iniciadas)

- [ ] Tela de notificações/novidades para membros no app
- [ ] Relatório financeiro exportável (PDF/Excel)
- [ ] Integração completa PIX com Mercado Pago (webhook ativo)
- [ ] Painel de métricas SaaS (MRR, churn, igrejas ativas)
- [ ] Sistema de onboarding guiado para nova igreja

---

## 🔑 Dados de infraestrutura (NÃO commitar segredos novos aqui)

| Item | Valor |
|------|-------|
| Servidor | `/home/ldfp8965/ldfp.com.br/` |
| Banco MySQL | host `localhost`, banco `ldfp8965_sistema_gestao`, user `ldfp8965_Leo` |
| Domínio | `https://ldfp.com.br` |
| Restart servidor | `touch tmp/restart.txt` |
| Branch principal | `main` |

---

## 🧠 Contexto técnico importante

- **Auth:** JWT com campo `role`. Roles super-admin válidos: `super-admin`, `super_admin`, `superadmin`, `master`
- **DB:** `pool.query()` em `src/config/db.js` — suporta MySQL (produção cPanel) e PostgreSQL (Neon)
- **Shell cliente:** `enterprise-shell.js` — inicializa em `main.enterprise-main` ou `main.main-content`
- **Shell super-admin:** `ldfp-master.js` — guard na linha 5-6, usa array `superRoles`
- **session.js:** Intercepta `window.fetch` globalmente, adiciona `Authorization: Bearer token`
- **Páginas com `roleAllowed()` já corretas:** `admin-inovacoes`, `admin-sistema`, `admin-usuarios`, `admin-novidades`
- **Páginas corrigidas nesta sessão (role guard direto):** `admin-modulos`, `admin-assinaturas`, `admin-edicao-cliente`, `admin-igrejas`, `admin-planos`, `admin-retomada`

---

## 📝 Como atualizar este arquivo ao terminar uma sessão

1. Mova itens concluídos para a tabela **"O que já está feito"**
2. Atualize o **hash do último commit**
3. Risque os itens do **Pendente no servidor** que foram feitos
4. Adicione novos itens ao **Backlog** se surgirem
