# Soul ERP — Projeto de Arquitetura

> ERP de frente de caixa em modelo **SaaS de revenda**. Primeiro cliente e piloto: **Soul Muscle**
> (quiosques de sorvete e loja), com foco em **emitir nota fiscal** e **controlar a performance do PDV**.
>
> Versão 1.0 · Status: **Proposta — aguardando validação técnica do time**

## Para que serve este pacote

Descrever a arquitetura completa com detalhe suficiente para que os programadores possam
**criticar as decisões, estimar o esforço e começar a implementar** sem ambiguidade de contrato.

## Índice

| # | Documento | Conteúdo |
|---|-----------|----------|
| 00 | [Visão Geral](./00-VISAO-GERAL.md) | O que é o produto, decisões já tomadas, objetivos, escopo, personas, glossário |
| 01 | [Requisitos](./01-REQUISITOS.md) | RF rastreados à lista original, RNF e regras de negócio |
| 02 | [Arquitetura](./02-ARQUITETURA.md) | C4, stack, módulos, agente local, offline-first, multi-tenant |
| 03 | [Modelo de Dados](./03-MODELO-DADOS.md) | ERD, DDL completo, RLS, particionamento, índices |
| 04 | [Módulos](./04-MODULOS.md) | PDV, fiscal, performance, tenancy, estoque, financeiro, canais, relatórios |
| 05 | [APIs](./05-API.md) | Endpoints, contratos, protocolo de sincronização offline, tempo real |
| 06 | [Fiscal](./06-FISCAL.md) | Gateway de terceiro, contingência, comparativo e POC de provedor |
| 07 | [Segurança](./07-SEGURANCA.md) | Ameaças, isolamento, auditoria, LGPD, PCI, segredos |
| 08 | [Roadmap](./08-ROADMAP.md) | Fases, esforço, time, marcos, riscos |
| 09 | [ADRs](./09-ADRS.md) | 11 decisões arquiteturais com alternativas e consequências |
| 10 | [Qualidade e DevOps](./10-QUALIDADE-DEVOPS.md) | Testes, CI/CD, observabilidade, backup, operação |

## Decisões já fechadas pelo negócio

| # | Decisão |
|---|---------|
| D1 | **SaaS único na nuvem**, multi-tenant |
| D2 | **PostgreSQL próprio** — sem Supabase/BaaS |
| D3 | **Emissão fiscal por API de terceiro** — nenhuma configuração na Receita Federal ou SEFAZ |
| D4 | **Uma licença por CNPJ**; grupo econômico apenas para dashboard gerencial consolidado |
| D5 | **PDV em Windows** com impressora térmica (e **balança**, para sorvete no peso) |
| D6 | **Maquininha de cartão avulsa na v1**; TEF integrado fica para a Fase 3 |
| D7 | Planos comerciais **Básico / Ideal / Completo** por mensalidade por CNPJ |
| D8 | Escopo funcional alvo = **superset da lista "Completo"** recebida |

## Resumo da arquitetura

- **Frontend**: React 18 + TypeScript + Vite + Tailwind/shadcn. O **PDV é um PWA offline-first** —
  vende com internet caída por até 72h e sincroniza depois, sem duplicar nem perder venda.
- **Backend**: **NestJS (Node 22)** como monólito modular, API REST com OpenAPI e workers em
  **BullMQ/Redis** (fiscal, integrações, relatórios, telemetria).
- **Banco**: **PostgreSQL 16** com Prisma, `tenant_id` em toda tabela, **RLS forçada**,
  particionamento mensal nas tabelas de movimento e réplica de leitura para relatórios.
- **Periféricos**: agente local **SM Bridge** no PC do quiosque (impressora ESC/POS, gaveta,
  **balança**, leitor) — o navegador não acessa esses dispositivos sozinho.
- **Fiscal**: **não falamos com a SEFAZ**. Gateway de terceiro atrás de uma camada anticorrupção
  (`FiscalProvider`) — trocar de provedor não encosta no PDV. A **venda nunca espera a nota**.
- **Performance do PDV**: contadores ao vivo em Redis + WebSocket, curva de horário, mix de
  produtos e **monitor de saúde dos terminais** com alertas.
- **Revenda**: tenant = CNPJ, grupo econômico para visão consolidada, planos por **entitlement**
  (ligar/desligar módulo sem deploy) e medição de uso para faturamento.

## O que o time precisa responder para validar

1. **A escolha de stack e o monólito modular fazem sentido?** ([ADR-001](./09-ADRS.md), [ADR-002](./09-ADRS.md))
2. **O PDV offline-first está bem desenhado?** Especialmente a idempotência por UUID gerado no cliente ([ADR-003](./09-ADRS.md), [05 §6](./05-API.md))
3. **O SM Bridge cobre os periféricos reais?** Levantar modelo exato da balança e da impressora de cada quiosque ([02 §6](./02-ARQUITETURA.md))
4. **A contingência fiscal proposta é aceitável?** — **é a pendência mais importante do projeto**, precisa passar pelo contador antes da F1 ([06 §5](./06-FISCAL.md))
5. **O isolamento multi-tenant está suficiente?** ([03 §10](./03-MODELO-DADOS.md), [07 §4](./07-SEGURANCA.md))
6. **O modelo de dados atende sorvete?** Peso, grade de sabores, lote e validade ([03 §4](./03-MODELO-DADOS.md))
7. **As estimativas do roadmap são realistas para este time?** ([08](./08-ROADMAP.md))

Pontos abertos estão marcados como "validar" no fim dos documentos 02, 03 e no [08 §5](./08-ROADMAP.md).
