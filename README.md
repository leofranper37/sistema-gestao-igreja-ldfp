# LDFP Gestão

Plataforma SaaS de gestão para igrejas evangélicas brasileiras.

## Planos
| Plano  | Preço      | Cadastros | Congregações |
|--------|------------|-----------|--------------|
| Éden   | Gratuito   | 30        | 1            |
| Hebrom | R$ 50/mês  | 150       | 1            |
| Betel  | R$ 75/mês  | 300       | 3            |
| Sião   | R$ 100/mês | 500       | 10           |

## Stack
- Backend: Node.js + Express
- Banco: MySQL
- Auth: JWT
- Frontend: HTML + CSS + JS (vanilla)

## Desenvolvimento
```bash
cp .env.example .env
npm install
npm run seed:superadmin
npm run dev
```

## Estrutura
- src/config: banco, logger, variáveis
- src/middlewares: auth JWT, erros
- src/routes: rotas da API
- src/services: regras de negócio
- src/controllers: entrada/saída HTTP
- public/js: auth e helpers
- public/css: design system LDFP
- scripts: seeds e utilitários de banco
