# Prisma model suggestion

Adicione ao `schema.prisma` para manter os bancos e evitar que saldos sumam:

```prisma
model Banco {
  id          Int      @id @default(autoincrement())
  nomeBanco   String
  agencia     String?
  conta       String?
  saldoInicial Float    @default(0)
  tipo        String   @default("Corrente")
  createdAt   DateTime @default(now())
}
```

Depois rode:

```bash
npx prisma migrate dev --name add_bancos
```

E crie um endpoint POST `/api/bancos` para inserir registros no banco de dados.
