# 00 · Visão Geral

## 1. O que estamos construindo

Um **ERP de frente de caixa em modelo SaaS, vendido por revenda**, cujo primeiro cliente e piloto
é a **Soul Muscle** — rede de quiosques que vende sorvete em **potes fechados**, complementos e
produtos de loja.

Duas dores dão origem ao produto:

1. **Emitir nota fiscal** de cada venda do quiosque, sem que ninguém da operação precise lidar com
   certificado, SEFAZ ou Receita Federal.
2. **Enxergar a performance do PDV** — quanto cada quiosque vende, em que horário, o que vende, e se
   o terminal está saudável (online, sincronizado, sem nota presa, impressora funcionando).

O sistema nasce **multiempresa desde a primeira linha de código**, porque será licenciado a outros
clientes: **uma licença por CNPJ**, com **grupo econômico** agrupando CNPJs da mesma rede para
visão gerencial consolidada (matriz + filiais no mesmo dashboard).

## 2. Decisões já tomadas pelo negócio

Estas decisões vieram do dono do produto e **não estão em aberto** para o time — o que se discute é
*como* implementá-las, não *se*:

| # | Decisão | Consequência arquitetural |
|---|---------|---------------------------|
| D1 | **SaaS único na nuvem**, multi-tenant | Isolamento por tenant é requisito de segurança de nível 1 (ver [07](./07-SEGURANCA.md)) |
| D2 | **Sem Supabase/BaaS** — PostgreSQL próprio | Backend NestJS + Postgres + Redis, controle total de transação e custo ([ADR-001](./09-ADRS.md)) |
| D3 | **Emissão fiscal por API de terceiros** | Camada anticorrupção `fiscal` com adaptador por provedor; zero configuração SEFAZ ([06](./06-FISCAL.md)) |
| D4 | **Uma licença por CNPJ**; grupo econômico só para leitura gerencial | Tenant = CNPJ; `economic_group` agrega tenants ([03 §2](./03-MODELO-DADOS.md)) |
| D5 | **PDV em computador Windows com impressora térmica** | Exige agente local `SM Bridge` para impressora, gaveta e leitor de código ([02 §6](./02-ARQUITETURA.md)) |
| D6 | **Sem TEF integrado** | O pagamento acontece fora do sistema — dinheiro, Pix ou maquineta — e é **lançado** pelo operador; é esse lançamento que vira a nota fiscal ([ADR-007](./09-ADRS.md)) |
| D7 | **Planos comerciais Básico / Ideal / Completo** por mensalidade por CNPJ | Motor de *entitlements* liga e desliga módulo por tenant ([04 §12](./04-MODULOS.md)) |
| D8 | Escopo funcional alvo = **superset da lista "Completo"** | Todos os módulos da lista entram no plano de fases, nenhum é descartado ([01](./01-REQUISITOS.md)) |

## 3. Objetivos e métricas

| # | Objetivo | Métrica de sucesso |
|---|----------|--------------------|
| O1 | Vender rápido no quiosque | Venda de dois potes com pagamento concluída em **< 40s**; item no carrinho em **< 200ms** |
| O2 | Nunca parar de vender | PDV opera **offline por até 72h** e sincroniza sem perder nem duplicar venda |
| O3 | Nota fiscal sem dor | NFC-e autorizada em **< 5s (p95)**; nenhum funcionário toca em certificado ou site da SEFAZ |
| O4 | Performance visível | Dono vê faturamento do dia **por quiosque em tempo real** (atraso < 30s) |
| O5 | Operação monitorada | Terminal offline, venda não sincronizada ou nota presa geram **alerta em < 5min** |
| O6 | Escalar como produto | Ativar um novo CNPJ cliente em **< 1h**, sem deploy e sem código novo |
| O7 | Estoque sob controle | Baixa automática na venda; divergência de inventário **< 2%** ao mês por quiosque |

## 4. Escopo

### 4.1 MVP (Fase 1) — o que precisa existir para a Soul Muscle operar

- PDV de balcão para quiosque: venda por pote e por item, desconto e múltiplos meios de pagamento
- Abertura, sangria, suprimento e fechamento de caixa
- **NFC-e via gateway fiscal**, com fila e reprocessamento automático
- Impressão do cupom em impressora térmica + abertura de gaveta
- Cadastro de produtos, preço por loja e código de barras
- Usuários, papéis e login rápido de operador
- **Painel de performance em tempo real** por quiosque + curva de horário + mix de produtos
- **Monitor de saúde dos terminais**
- Multi-tenant, licença por CNPJ, grupo econômico e planos

### 4.2 Fases seguintes (planejadas desde já — ver [08](./08-ROADMAP.md))

Estoque completo com inventário · Compras e importação de XML · Financeiro (contas a pagar/receber,
DRE) · Contratos de cartões e conciliação de recebíveis · Conciliação bancária ·
Terminal de autoatendimento · Mesas/comandas · Delivery · Ordem de serviço · Produção/ficha
técnica · Relatório dinâmico.

### 4.3 Fora de escopo

Folha de pagamento · escrituração contábil e SPED (entregamos XMLs e relatórios ao contador) ·
e-commerce próprio (haverá API pública) · WMS de centro de distribuição.

## 5. Personas

| Persona | Uso | Restrições que a arquitetura precisa respeitar |
|---------|-----|-----------------------------------------------|
| **Atendente do quiosque** | Vender o dia todo | Espaço apertado, pouco treinamento, tela sempre aberta, teclado + leitor de código |
| **Gerente / dono da rede** | Ver performance, aprovar desconto e cancelamento | Consome muito o dashboard no celular |
| **Financeiro / retaguarda** | Fechamento, estoque, compras, conciliação | Web, multi-loja, planilhas de saída |
| **Contador do cliente** | Baixar XMLs e relatórios por competência | Acesso restrito, só leitura fiscal |
| **Revendedor / suporte (nós)** | Ativar cliente, trocar plano, diagnosticar terminal | Painel de back-office **separado**, com acesso auditado ao tenant |
| **Cliente final** | Recebe cupom e (futuro) usa o totem | Não tem login; cupom por QR/link |

## 6. Premissas

- P1 — Internet do quiosque é instável (shopping, 4G): **queda é evento normal**, não exceção.
- P2 — O certificado digital A1 fica custodiado no **provedor fiscal**, com upload uma vez por CNPJ.
- P3 — Cada PDV roda Windows 10/11, 4 GB RAM, com impressora térmica ESC/POS e leitor de código.
- P4 — Todo produto é vendido **por unidade fechada**: pote de sorvete (300ml, 500ml, 1L),
  casquinha, complemento e bebida. Não existe venda fracionada por peso.
- P5 — O pagamento é feito fora do sistema — dinheiro, Pix ou maquineta de cartão — e **lançado**
  pelo operador. Esse lançamento é o que alimenta a nota fiscal e o fechamento do caixa
  (ver risco R-04 em [08 §5](./08-ROADMAP.md)).
- P6 — O time domina TypeScript/React; o backend será TypeScript para manter um único idioma.

## 7. Restrições

- R1 — **Legislação fiscal**: venda a consumidor exige NFC-e autorizada (ou contingência válida).
  Isso torna a venda **imutável** depois de fechada e condiciona o fluxo offline ([06 §5](./06-FISCAL.md)).
- R2 — **PCI-DSS**: nenhum dado de cartão entra no sistema. A maquineta fala direto com a
  adquirente; guardamos apenas bandeira, parcelas, valor e, quando digitado, o NSU.
- R3 — **LGPD**: CPF na nota, cadastro de cliente e fidelidade são dados pessoais de titulares que
  **não são nossos clientes diretos** — o cliente da revenda é o controlador, nós somos operador.
- R4 — Guarda de documentos fiscais por **5 anos**.
- R5 — Custo de infra precisa caber no preço de mensalidade de um quiosque: preferir serviços
  gerenciados baratos e um único cluster multi-tenant.

## 8. Glossário

| Termo | Significado |
|-------|-------------|
| **Tenant** | Cliente licenciado = **um CNPJ**. Unidade de isolamento de dados e de cobrança |
| **Grupo econômico** | Conjunto de tenants (matriz + filiais) com dashboard consolidado |
| **PDV / terminal** | Ponto de venda físico (computador do quiosque) |
| **SM Bridge** | Agente local que roda no PDV e fala com impressora, gaveta e leitor |
| **Gateway fiscal** | API de terceiro que assina e transmite os documentos à SEFAZ por nós |
| **NFC-e** | Nota Fiscal de Consumidor Eletrônica (mod. 65) — a nota da venda no quiosque |
| **NF-e** | Nota Fiscal Eletrônica (mod. 55) — compra, transferência entre unidades |
| **Contingência** | Modo de emissão quando SEFAZ/gateway estão fora do ar |
| **Grade** | Matriz de variações do produto (ex.: sabor × tamanho) |
| **SKU** | Variação vendável, com EAN, preço e saldo próprios |
| **FEFO** | Consumir primeiro o lote com validade mais próxima |
| **Outbox** | Fila local do PDV com o que ainda não subiu para a nuvem |
| **Entitlement** | Chave que liga/desliga uma funcionalidade conforme o plano contratado |
| **Sangria / Suprimento** | Retirada / entrada de dinheiro na gaveta |
