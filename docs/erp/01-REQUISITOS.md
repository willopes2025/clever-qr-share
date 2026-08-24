# 01 · Requisitos

## 1. Rastreabilidade — lista original de features → módulos → fase

Mapa de **cada item da matriz Básico / Ideal / Completo recebida** para requisito, módulo e fase.
O alvo é o **superset do "Completo"**, com uma diferença: os limites numéricos do fornecedor atual
(2 PDVs, 20 usuários, 3000 notas) deixam de ser limite de produto e passam a ser **configuração
comercial por plano** — o motor de *entitlements* (RF-19), já que o sistema será **revendido**.

| Item da lista original | Requisito | Módulo | Fase | Plano mínimo |
|---|---|---|---|---|
| PDV — Frente de Caixa | RF-01 | `pos` | **F1** | Básico |
| Notas Fiscais (ilimitadas) | RF-05 | `fiscal` | **F1** | Básico |
| Usuários | RF-04 | `iam` | **F1** | Básico |
| Vendas | RF-07 | `sales` | **F1** | Básico |
| Relatórios | RF-17 | `reporting` | **F1/F2** | Básico |
| Estoque | RF-08 | `inventory` | F1 (básico) / F2 (completo) | Básico |
| Estoque em Grade | RF-10 | `catalog` + `inventory` | F2 | Ideal |
| Importação de XML | RF-06 | `purchasing` | F2 | Ideal |
| Financeiro | RF-09 | `finance` | F2 | Ideal |
| Contratos de cartões e outros | RF-11 | `receivables` | F3 | Completo |
| Conciliação Bancária | RF-12 | `finance/reconciliation` | F3 | Completo |
| TEF | RF-02 | `payments` + SM Bridge | **F3** (não é v1 — maquininha avulsa na v1) | Ideal |
| Terminais de Autoatendimento | RF-03 | `kiosk` | F4 | Completo |
| Controle de Mesas | RF-13 | `tables` | F4 | Completo |
| Delivery | RF-14 | `delivery` | F4 | Completo |
| Ordem de Serviço | RF-15 | `service-orders` | F5 | Completo |
| Produção | RF-16 | `production` | F5 | Completo |
| Relatório Dinâmico | RF-18 | `reporting/builder` | F5 | Completo |
| *(novo — exigido pela revenda)* | **RF-19** Multiempresa, licença por CNPJ e planos | `tenancy` | **F1** | — |
| *(novo — pedido do dono)* | **RF-20** Performance e saúde do PDV | `telemetry` + `analytics` | **F1** | Básico |

---

## 2. Requisitos funcionais

### RF-01 · PDV — Frente de Caixa `must` `F1`

| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| RF-01.1 | Abertura de caixa com fundo de troco, vinculada a operador e terminal | Sem caixa aberto, não vende |
| RF-01.2 | Venda por leitura de EAN, busca por nome/código e **teclas rápidas de produto** (sabor, casquinha, taça) | Item no carrinho em < 200ms com catálogo de 20k SKUs |
| RF-01.3 | **Venda por peso**: tara, leitura direta da balança e cálculo preço/kg | Peso lido do equipamento sem digitação; recálculo instantâneo do valor |
| RF-01.4 | **Leitura de EAN de balança** (código prefixo 2 com peso ou valor embutido) | Etiqueta gerada na balança é interpretada corretamente |
| RF-01.5 | Desconto por item e no total, com limite por papel | Acima do limite exige aprovação de gerente registrada |
| RF-01.6 | Pagamento **múltiplo**: dinheiro, cartão (maquininha avulsa), Pix, voucher, crédito do cliente | Soma ≥ total; troco só em dinheiro |
| RF-01.7 | Cartão na v1: operador escolhe **débito/crédito, bandeira e parcelas**; NSU opcional | Dado suficiente para conciliar depois com o extrato da adquirente (RF-11) |
| RF-01.8 | Identificação do cliente: CPF na nota, telefone, cadastro rápido | CPF validado; consentimento LGPD registrado |
| RF-01.9 | Sangria, suprimento e reforço com justificativa | Todo movimento vira lançamento + comprovante |
| RF-01.10 | Fechamento de caixa com **conferência cega** | Sistema calcula diferença por meio de pagamento e exige justificativa quando ≠ 0 |
| RF-01.11 | Cancelamento de item e de venda com motivo e permissão | Registrado em auditoria |
| RF-01.12 | Devolução/troca com rastreio da venda original | Gera documento de devolução, devolve estoque, gera crédito/estorno |
| RF-01.13 | Venda em espera (várias vendas abertas no mesmo terminal) | Retomar sem perder itens |
| RF-01.14 | **Operação 100% offline por até 72h** | Ver RNF-03 e protocolo em [05 §6](./05-API.md) |
| RF-01.15 | Impressão do cupom e abertura de gaveta | Via SM Bridge; falha de impressora **não** bloqueia a venda |
| RF-01.16 | Operação inteira por teclado, sem mouse | Teste com atendente real |

### RF-02 · TEF integrado `should` `F3` — **não é v1**

Na v1 a maquininha é avulsa (D6). O modelo de dados e a interface de pagamento já nascem prontos
para receber a captura, para que a entrada do TEF **não exija reescrever o PDV**:

- RF-02.1 — Valor enviado do PDV ao pinpad, sem redigitação.
- RF-02.2 — Retorno com NSU, autorização, bandeira, rede e parcelas gravado em `payment_transaction`.
- RF-02.3 — Confirmação em duas fases (*undo/confirm*): transação não confirmada é desfeita sozinha.
- RF-02.4 — Estorno pelo PDV com permissão de gerente.
- RF-02.5 — Pix por QR dinâmico com baixa automática via webhook do PSP (< 10s p95).
- RF-02.6 — Pelo menos dois provedores homologados (ex.: PayGo/SiTef e Stone), trocáveis por configuração.

### RF-03 · Terminal de autoatendimento `could` `F4`
Totem em modo quiosque, catálogo com foto, carrinho, pagamento sem dinheiro, envio do pedido ao
preparo com senha, limpeza automática do carrinho após 60s de inatividade e emissão fiscal idêntica à do PDV.

### RF-04 · Usuários, papéis e permissões `must` `F1`

- RF-04.1 — Usuários **ilimitados** por padrão; a quantidade cobrável é regra do plano (RF-19), não do código.
- RF-04.2 — Papéis: `owner`, `admin`, `gerente`, `caixa`, `estoquista`, `financeiro`, `contador (leitura fiscal)`, `suporte (revenda)`.
- RF-04.3 — Permissões granulares por ação (`sale.discount.above_limit`, `cash.close`, `product.cost.view`, `tenant.impersonate`).
- RF-04.4 — Login rápido do operador por **PIN** sobre a sessão do terminal.
- RF-04.5 — Aprovação supervisora *inline*, sem deslogar o operador.
- RF-04.6 — Trilha de auditoria imutável de toda ação sensível.
- RF-04.7 — Um usuário pode ter acesso a vários CNPJs do mesmo grupo econômico com papéis diferentes.

### RF-05 · Documentos fiscais via gateway `must` `F1`

- RF-05.1 — **NFC-e (mod. 65)** em toda venda do quiosque, emitida via API de terceiro.
- RF-05.2 — Nenhuma configuração junto à Receita Federal/SEFAZ pela equipe: certificado e transmissão são do provedor.
- RF-05.3 — Fila assíncrona com retentativa exponencial; **a venda nunca espera a nota**.
- RF-05.4 — Cancelamento no prazo legal, carta de correção e inutilização de numeração.
- RF-05.5 — Notas **ilimitadas** no produto (custo por volume é do gateway, tratado como custo variável do plano).
- RF-05.6 — Guarda de XML e DANFE por 5 anos com download em lote por competência para a contabilidade.
- RF-05.7 — Fluxo de contingência definido e testado ([06 §5](./06-FISCAL.md)).
- RF-05.8 — Cupom por QR/link (e-mail ou WhatsApp) além da via impressa.
- RF-05.9 — NF-e (mod. 55) para compras e transferências; NFS-e para OS (fases posteriores).
- RF-05.10 — Painel fiscal: notas autorizadas, rejeitadas, pendentes e canceladas por dia e por loja.

### RF-06 · Importação de XML `must` `F2`
Upload/pasta monitorada/busca automática na distribuição DF-e · de-para de código do fornecedor → SKU,
memorizado · conferência quantidade × valor · rateio de frete no custo · entrada com **lote e validade** ·
contas a pagar a partir das duplicatas · bloqueio de importação duplicada pela chave de 44 dígitos.

### RF-07 · Vendas `must` `F1`
Venda, devolução, troca, cancelamento · tabela de preço **por loja** · promoção por período e por
quantidade · cupom de desconto · combo/kit · comissão de vendedor · fidelidade/cashback e crédito do cliente (F2+).

### RF-08 · Estoque `must` `F1 (básico) / F2 (completo)`
**F1:** saldo por loja e SKU, baixa automática na venda, entrada manual, ajuste com motivo, alerta de mínimo.
**F2:** transferência entre lojas com documento, inventário cíclico e geral por celular, curva ABC,
ponto de reposição e sugestão de compra, **lote e validade com consumo FEFO** e bloqueio de venda de lote vencido.

### RF-09 · Financeiro `must` `F2`
Contas a pagar e a receber · centro de custo e plano de contas · fluxo de caixa realizado e projetado ·
baixa parcial, juros, multa e desconto · consolidação do caixa das lojas · DRE gerencial por loja e do grupo econômico.

### RF-10 · Estoque em grade `should` `F2`
Produto-pai com até dois eixos de variação (ex.: Sabor × Tamanho) gerando SKUs · matriz com saldo por
célula, entrada e contagem direto na grade · EAN, preço, custo e saldo por SKU · compra e venda sempre no SKU.

### RF-11 · Contratos de cartões e recebíveis `should` `F3`
Contrato por adquirente × bandeira × produto × faixa de parcelas (taxa % + fixa + prazo) · previsão de
recebível líquido por venda · importação do extrato/EDI da adquirente e conciliação automática ·
alerta de taxa cobrada ≠ contratada e de venda não repassada · antecipação com custo registrado ·
mesma mecânica para vale-refeição, iFood e marketplaces.

> **Atenção:** com maquininha avulsa (v1), a conciliação nasce **por aproximação** (valor + data +
> bandeira). A precisão sobe para ~100% quando o TEF entrar na F3 e trouxer o NSU.

### RF-12 · Conciliação bancária `should` `F3`
OFX/CNAB 240 e, quando houver, Open Finance via agregador · motor de regras (valor + data ± tolerância +
descritor) que aprende com as escolhas do usuário · tela de match lado a lado, conciliação em lote e
desfazer · relatório de pendências por conta.

### RF-13 · Mesas / comandas `could` `F4`
Mapa de mesas, comanda por cartão, transferência de itens, juntar e dividir conta (por pessoa ou item),
taxa de serviço, envio ao preparo por setor e pagamento parcial.

### RF-14 · Delivery `could` `F4`
Pedido por balcão/telefone/WhatsApp · endereço com taxa por bairro ou raio · status do pedido ·
entregador e fechamento de rota · integração iFood na mesma fila · cupom fiscal do pedido.

### RF-15 · Ordem de serviço `could` `F5`
Abertura com cliente e item, laudo, peças e serviços, orçamento e aprovação, técnico, prazo, garantia e
faturamento (NFS-e + NF-e de peças).

### RF-16 · Produção `could` `F5`
Ficha técnica com insumos e perda · ordem de produção com baixa de insumo e entrada do acabado ·
custo de produção · kit/combo montado na venda · painel de preparo (KDS) para o balcão.

### RF-17 · Relatórios `must` `F1/F2`
Vendas por período, loja, operador, produto e hora · ticket médio · margem · ruptura · giro ·
fiscal por competência · comissões · exportação XLSX/CSV/PDF · agendamento por e-mail · resumo diário automático.

### RF-18 · Relatório dinâmico `could` `F5`
Construtor visual sobre um **modelo semântico** (dimensões e métricas em português), com filtros,
agrupamentos, totais, gráficos, salvar, compartilhar, agendar e exportar — **sem SQL digitado** e
sempre limitado ao tenant e às permissões do usuário.

### RF-19 · Multiempresa, licenciamento e planos `must` `F1` *(novo — exigência da revenda)*

| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| RF-19.1 | **Tenant = um CNPJ licenciado**, com dados totalmente isolados | Teste automatizado prova que consulta de um tenant nunca lê linha de outro |
| RF-19.2 | **Grupo econômico** agregando vários tenants (matriz + filiais) | Dashboard consolidado do grupo, respeitando permissão por CNPJ |
| RF-19.3 | Planos **Básico / Ideal / Completo** liberando módulos por entitlement | Trocar plano libera/bloqueia módulo **sem deploy**, efeito em < 1min |
| RF-19.4 | Limites por plano: terminais, usuários, notas/mês, lojas | Ao atingir o limite, o sistema avisa e (conforme regra) bloqueia ou tarifa o excedente |
| RF-19.5 | **Medição de uso por tenant** (notas emitidas, terminais ativos, usuários) | Base para faturamento e para o painel da revenda |
| RF-19.6 | Onboarding de cliente: criar CNPJ, configurar fiscal e ativar em < 1h | Sem código, sem deploy, feito pelo suporte |
| RF-19.7 | Painel de back-office da revenda (clientes, planos, uso, faturas, suporte) | Aplicação separada, com acesso ao tenant **sempre auditado** |
| RF-19.8 | Suspensão e reativação por inadimplência | Suspenso: PDV entra em modo leitura após período de tolerância configurável |

### RF-20 · Performance e saúde do PDV `must` `F1` *(novo — pedido do dono)*

| ID | Requisito | Critério de aceite |
|----|-----------|--------------------|
| RF-20.1 | **Vendas em tempo real por quiosque**: faturamento, nº de vendas, ticket médio | Atualiza em < 30s; comparação lado a lado entre unidades |
| RF-20.2 | Comparativo com o mesmo dia da semana anterior e com a meta | Variação % visível no painel |
| RF-20.3 | **Curva de horário** por faixa de 30min e por dia da semana | Base para escala de gente e reposição |
| RF-20.4 | **Mix de produtos e sabores** mais vendidos, por loja e período | Top N com participação % e margem |
| RF-20.5 | **Saúde técnica do terminal**: online/offline, última sincronização, vendas pendentes, fila fiscal, impressora, balança | Cartão por terminal com semáforo |
| RF-20.6 | Alertas: terminal offline > 15min, venda não sincronizada > 30min, nota rejeitada, caixa aberto fora do horário | Notificação em < 5min (painel + e-mail/WhatsApp) |
| RF-20.7 | Painel mobile-first para o dono | Legível no celular, sem zoom |
| RF-20.8 | *(barato, porque o dado já existe)* desempenho por operador: ticket médio, descontos, cancelamentos | Ranking por loja e período |

---

## 3. Requisitos não funcionais

| ID | Categoria | Requisito | Como verificar |
|----|-----------|-----------|----------------|
| RNF-01 | Desempenho PDV | Item no carrinho < 200ms; finalizar venda < 1s (local) | Teste no PDV com 20k SKUs em cache local |
| RNF-02 | Desempenho API | p95 < 400ms; relatórios pesados em réplica de leitura ou assíncronos | k6 no CI |
| RNF-03 | Disponibilidade | PDV vende offline por **72h**; backend 99,5%/mês | Teste de caos: derrubar a rede do quiosque piloto |
| RNF-04 | Integridade | **Zero** venda perdida ou duplicada na sincronização | Idempotência por UUID gerado no PDV + teste de reenvio e de relógio atrasado |
| RNF-05 | Escalabilidade | 500 tenants × 3 terminais, 10M vendas/ano sem reescrita | Particionamento mensal das tabelas de movimento |
| RNF-06 | Isolamento | Um tenant **nunca** enxerga dado de outro | RLS no Postgres + guard de aplicação + teste de invasão no CI |
| RNF-07 | Segurança | Zero dado de cartão; segredos em cofre; TLS ponta a ponta | Revisão de segurança por release |
| RNF-08 | Auditoria | Quem/quando/o quê/antes/depois em toda ação sensível | Tabela `audit_log` append-only |
| RNF-09 | LGPD | Base legal por finalidade, minimização, expurgo, exportação e eliminação do titular | Checklist em [07 §6](./07-SEGURANCA.md) |
| RNF-10 | Observabilidade | Log estruturado, tracing, alerta de fila fiscal parada e de terminal mudo | Dashboards + alertas testados |
| RNF-11 | Manutenibilidade | Trocar gateway fiscal ou provedor TEF **sem tocar no PDV** | Teste de contrato por adaptador |
| RNF-12 | Backup/DR | RPO ≤ 5min, RTO ≤ 4h | PITR + ensaio mensal de restauração |
| RNF-13 | Instalação do PDV | Instalador Windows único, atualização automática e silenciosa | Rollout no piloto sem visita técnica |
| RNF-14 | Portabilidade dev | Todo o backend sobe com `docker compose up` | Ambiente local do desenvolvedor |
| RNF-15 | Localização | pt-BR, BRL, America/Sao_Paulo; **dinheiro em inteiro de centavos** | Lint proíbe `float` para dinheiro |

## 4. Regras de negócio críticas

| ID | Regra |
|----|-------|
| RN-01 | Venda finalizada é **imutável**. Corrige-se por devolução/troca/cancelamento formal, nunca por edição. |
| RN-02 | Estoque baixa na **finalização** da venda, não ao adicionar item ao carrinho. |
| RN-03 | Preço e custo praticados são **gravados na linha do item** (histórico), não lidos do cadastro depois. |
| RN-04 | Nenhum dinheiro entra ou sai da gaveta sem lançamento. |
| RN-05 | Caixa não fecha com venda pendente de sincronização ainda não reconhecida pelo servidor. |
| RN-06 | Documento fiscal rejeitado **bloqueia o fechamento contábil do dia, não a operação da loja**. |
| RN-07 | Desconto acima do limite do papel exige aprovação identificada. |
| RN-08 | Item por peso só pode ser vendido com peso vindo da balança ou do EAN de balança — nunca digitado, salvo permissão. |
| RN-09 | Lote vencido não é vendido; lote a vencer em ≤ N dias alerta o operador. |
| RN-10 | Tenant suspenso por inadimplência entra em modo leitura **após** o período de tolerância, e nunca no meio de uma venda aberta. |
