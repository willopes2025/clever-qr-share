# Soul ERP

ERP de frente de caixa da **Soul Muscle**: vende no quiosque, emite a nota fiscal
e mostra a performance de cada unidade em tempo real. Construído como produto de
revenda — multiempresa por CNPJ, com planos comerciais desde o primeiro commit.

> A arquitetura completa, com decisões e roadmap, está em [`../docs/erp/`](../docs/erp/README.md).

## O que já funciona

| Área | Estado |
|------|--------|
| PDV offline-first: venda por pote, caixa e lançamento de pagamentos | ✅ |
| PWA instalável: o PDV **abre** e vende com a internet caída | ✅ |
| Impressão do cupom e abertura da gaveta pelo agente local | ✅ |
| Sangria, suprimento e fechamento de caixa por conferência cega | ✅ |
| Sincronização idempotente (reenviar não duplica venda) | ✅ |
| Emissão de NFC-e via gateway, com fila e retentativa | ✅ (provedor `fake` em desenvolvimento) |
| Venda offline com a nota saindo quando a conexão volta | ✅ |
| Estoque com baixa automática, lote e consumo FEFO | ✅ |
| Painel de performance: faturamento ao vivo, curva do dia, mix | ✅ |
| Monitor de saúde dos terminais com alertas | ✅ |
| Multiempresa, grupo econômico, planos e medição de uso | ✅ |
| Conciliações, mesas, delivery, autoatendimento, OS, produção | planejado (fases 3 a 5) |

## Estrutura

```
erp/
├── packages/
│   ├── money/        aritmética de centavos e rateio de desconto
│   ├── contracts/    schemas Zod compartilhados entre PDV e API
│   └── ui/           identidade visual da marca e formatação pt-BR
├── apps/
│   ├── api/          NestJS + Prisma + PostgreSQL (monólito modular)
│   ├── pdv/          PWA do caixa, offline-first
│   ├── web/          retaguarda e painel de performance
│   └── bridge/       agente local: impressora térmica e gaveta
└── scripts/          teste de fumaça e roteiros de navegador
```

## Como rodar

**1. Banco e dependências**

```bash
npm install
docker compose up -d          # postgres + redis
cp apps/api/.env.example apps/api/.env
```

**2. Migrar e semear**

```bash
npm run db:migrate -w @soul/api
npm run db:seed -w @soul/api
```

O seed cria a rede Soul Muscle com três quiosques, catálogo de sorvete e duas
semanas de vendas — o painel já sobe com dados. Ao final ele imprime as
credenciais e o código de ativação do terminal.

**3. Subir os três aplicativos**

```bash
npm run dev -w @soul/api     # API        :3000  (docs em /v1/docs)
npm run dev -w @soul/pdv     # PDV        :5173
npm run dev -w @soul/web     # retaguarda :5174
npm run dev -w @soul/bridge  # agente local :9123 (ver apps/bridge/README.md)
```

## Verificação

```bash
npx vitest run --config vitest.config.ts    # 67 testes de domínio
node scripts/smoke.mjs                      # caminho crítico de ponta a ponta
node scripts/e2e-pdv.mjs                    # PDV num navegador real
node scripts/e2e-web.mjs                    # retaguarda num navegador real
node scripts/e2e-offline.mjs                # corta a rede e prova que o PDV vende assim mesmo
node scripts/e2e-fechamento.mjs             # sangria, conferência cega e relatório impresso
```

O teste de fumaça precisa do `DEVICE_TOKEN` impresso pelo seed:

```bash
DEVICE_TOKEN=soul-pdv-q01-xxxxxxxx node scripts/smoke.mjs
```

## Decisões que valem conhecer antes de mexer

| Decisão | Onde vive |
|---------|-----------|
| **Dinheiro é inteiro de centavos.** Nunca `float`. | `packages/money` |
| **O id da venda nasce no PDV** e é a chave de idempotência da sincronização. | `apps/pdv/src/lib/outbox.ts` |
| **A venda não espera a nota**: emissão é assíncrona, com retentativa. | `apps/api/src/modules/fiscal` |
| **O provedor fiscal fica atrás de um adaptador** — trocar não encosta no PDV. | `apps/api/src/modules/fiscal/fiscal-provider.ts` |
| **Toda tabela tem `tenant_id`** e política de RLS no banco. | `apps/api/prisma/migrations/*_row_level_security` |
| **Toda feature de plano nasce atrás de um entitlement.** | `apps/api/src/modules/tenancy` |
| **Periférico é acessado pelo agente local**, nunca pelo navegador. | `apps/bridge/` |
| **O aplicativo é guardado no terminal** por service worker: a primeira abertura precisa de internet, as seguintes não. | `apps/pdv/vite.config.ts` |

## Ambiente de desenvolvimento sem gateway fiscal

`FISCAL_PROVIDER=fake` emite notas simuladas e rejeita de propósito itens sem
NCM — o erro de cadastro mais comum em produção. Nenhum teste depende de rede
externa ou de contrato assinado com fornecedor.

## Instalação do PDV na loja

O PDV é servido pelo mesmo domínio da retaguarda e se instala como aplicativo do sistema
(atalho próprio, tela cheia, sem barra de navegação). O procedimento de abertura de uma unidade:

1. Abrir o endereço do PDV **com internet** e instalar o aplicativo pelo navegador.
2. Ativar o terminal com o código gerado na retaguarda.
3. Instalar o **SM Bridge** para impressora e gaveta.
4. Conferir que o aplicativo abre com o cabo de rede desconectado — é o teste que garante que a
   loja não para numa queda de link.

> **Atenção no procedimento da loja:** limpar os dados do navegador apaga o aplicativo guardado
> **e a fila de vendas ainda não sincronizadas**. O terminal deve rodar num perfil dedicado, sem
> limpeza automática de dados.
