# 09 · Registros de Decisão Arquitetural (ADRs)

Formato: contexto → decisão → alternativas → consequências. ADR aceito só muda por outro ADR.

---

## ADR-001 · Backend próprio (NestJS + PostgreSQL), sem BaaS
**Status:** Aceito (decisão do negócio) · **Data:** 2026-08

**Contexto.** O produto será revendido a terceiros, com dados fiscais e financeiros de vários CNPJs.
Havia a opção de usar um BaaS (Supabase/Firebase), mas o negócio decidiu **não usar Supabase**.

**Decisão.** Backend NestJS (Node 22, TypeScript) sobre PostgreSQL 16 gerenciado por nós, com Prisma,
Redis/BullMQ e object storage S3-compatível.

**Alternativas.**
- *Supabase/BaaS*: rápido no começo, mas amarra o produto a um fornecedor, dificulta transação
  complexa (venda + estoque + fiscal + financeiro num commit só), encarece em escala multi-tenant e
  limita o controle sobre RLS e particionamento. **Descartado por decisão do negócio.**
- *Django/Rails*: maduros para ERP, mas quebram o idioma único com o front React do time.
- *Go/Java*: performance melhor, curva e custo de time maiores sem ganho que importe neste volume.

**Consequências.** (+) Controle total de transação, isolamento e custo; tipos compartilhados entre
PDV, API e retaguarda. (−) Precisamos operar banco, backup, migração e observabilidade — o que
exige disciplina de DevOps que o BaaS entregava pronto ([10](./10-QUALIDADE-DEVOPS.md)).

---

## ADR-002 · Monólito modular, não microsserviços
**Status:** Aceito

**Contexto.** ERP tem muitos domínios acoplados por transação (venda toca estoque, fiscal, caixa e
financeiro ao mesmo tempo). O time tem ~6 pessoas.

**Decisão.** Um único deployable (`apps/api`) com módulos de fronteira explícita, verificados por
lint de dependência. Workers escalam separado, mas compartilham o mesmo código.

**Alternativas.** *Microsserviços*: consistência distribuída, saga e observabilidade cara para um
time deste tamanho. *Monólito sem fronteira*: barato hoje, impossível de extrair depois.

**Consequências.** (+) Transação ACID direta, deploy simples, refatoração barata. (−) Escala vertical
por mais tempo; disciplina de fronteira precisa ser automatizada, não combinada.

---

## ADR-003 · PDV offline-first com outbox e ID gerado no cliente
**Status:** Aceito

**Contexto.** Quiosque de shopping tem internet instável. Caixa parado é receita perdida e fila.

**Decisão.** PWA com IndexedDB (Dexie), catálogo replicado localmente, venda gravada localmente,
outbox com envio em lote idempotente. **O UUID v7 da venda nasce no PDV** e é a chave de idempotência.

**Alternativas.** *Online-first com cache*: mais simples, mas para de vender quando cai. *Servidor
local na loja*: robusto, porém multiplica o custo de suporte por unidade — inviável para revenda.

**Consequências.** (+) A loja não para; sincronização sem conflito porque o PDV só cria fatos.
(−) Numeração fiscal só sai online (tratado em [06 §5](./06-FISCAL.md)); catálogo precisa caber no
navegador; testar offline é obrigatório em toda release do PDV.

---

## ADR-004 · Agente local SM Bridge para periféricos
**Status:** Aceito

**Contexto.** O PDV roda em Windows com impressora térmica e gaveta — nada disso é acessível pelo
navegador (Web Serial não cobre o cenário, e o PDV precisa funcionar como PWA).

**Decisão.** Agente local em Tauri + sidecar Node, instalado como serviço do Windows, HTTP local em
`https://localhost:9123`, pareado ao terminal por token, com autoatualização.

**Alternativas.** *App Electron/Tauri completo* (sem PWA): um instalador só, mas perde atualização
instantânea da UI. *WebUSB/Web Serial*: cobertura insuficiente e experiência ruim de permissão.
*Impressão por driver do Windows*: sem controle de gaveta e sem diagnóstico do equipamento.

**Consequências.** (+) Acesso completo aos periféricos, PDV segue web. (−) Dois artefatos para
instalar e atualizar; suporte precisa diagnosticar o agente (por isso ele reporta no heartbeat).
*Reabrir se V4 do [02 §11](./02-ARQUITETURA.md) apontar app único.*

---

## ADR-005 · Emissão fiscal por gateway de terceiro
**Status:** Aceito (decisão do negócio)

**Contexto.** Falar direto com a SEFAZ exige certificado, assinatura XML, 27 UFs, contingência e
manutenção permanente de layout — meses de trabalho e uma obrigação eterna.

**Decisão.** Provedor externo atrás de uma interface `FiscalProvider`. O provedor contratado é a
**Focus NFe**; PlugNotas e Tecnospeed ficam como alternativas, e trocar é escrever outro adaptador.
Nenhuma configuração junto à Receita Federal ou SEFAZ pela equipe.

**Alternativas.** *Emissor próprio*: controle total e sem custo por nota, mas custo de construção e
manutenção altíssimo. *Biblioteca open-source local*: elimina a mensalidade, mas devolve para nós a
manutenção fiscal — que é justamente o que se quis evitar.

**Consequências.** (+) Time entrega em semanas, não meses; sem risco de layout desatualizado.
(−) Custo por documento; dependência de terceiro (mitigada pelo adaptador); **a emissão passa a
depender de internet** — a venda continua acontecendo offline e a nota sai quando a conexão volta
([06 §5](./06-FISCAL.md)).

---

## ADR-006 · Multi-tenant em banco único com RLS
**Status:** Aceito

**Contexto.** Produto de revenda, com licença por CNPJ e centenas de tenants pequenos.

**Decisão.** Banco único, schema único, `tenant_id` em toda tabela, RLS forçada no Postgres +
isolamento na aplicação. Grupo econômico agrega tenants apenas para leitura.

**Alternativas.** *Banco por tenant*: isolamento perfeito, mas migração e custo por cliente
inviáveis em centenas de quiosques. *Schema por tenant*: melhor que banco, ainda pesado (milhares de
tabelas, migração lenta).

**Consequências.** (+) Custo baixo, migração única, consulta consolidada de grupo trivial.
(−) Um bug de isolamento é catastrófico → duas camadas + teste de invasão obrigatório no CI. Cliente
muito grande pode, no futuro, ser movido para banco dedicado com o mesmo schema.

---

## ADR-007 · Sem TEF: o pagamento é lançado, não capturado
**Status:** Aceito (decisão do negócio)

**Contexto.** Os quiosques recebem na maquineta da adquirente, em dinheiro ou por Pix. Integrar TEF
exigiria homologação com a adquirente, pinpad por terminal e um caminho crítico a mais dentro da
venda — para uma operação que já funciona bem com a maquineta ao lado do caixa.

**Decisão.** O sistema **não conversa com a adquirente**. O operador lança o que recebeu: meio de
pagamento, valor e, em cartão, bandeira e parcelas. Esse lançamento é o que alimenta a nota fiscal,
o fechamento do caixa e a conciliação. O NSU do comprovante é opcional, digitado só quando a loja
quiser casamento exato com o extrato.

**Alternativas.** *TEF integrado*: elimina erro de digitação e dá conciliação exata, mas custa
homologação, pinpad por PDV e dependência de uma adquirente. *Maquineta inteligente rodando o PDV*:
resolveria o pagamento, mas prenderia toda a operação a um fornecedor e trocaria o PDV de plataforma.

**Consequências.** (+) Nada de dado de cartão no sistema, menos hardware e uma integração a menos
para manter; a venda nunca trava por falha de comunicação com adquirente. (−) O valor lançado pode
divergir do que passou na maquineta, e a conciliação é por aproximação (risco R-04) — mitigado
medindo a taxa de acerto e, se necessário, digitando o NSU.

## ADR-008 · Dinheiro em inteiro de centavos
**Status:** Aceito

**Decisão.** Todo valor monetário é `bigint` de centavos no banco e `number` inteiro na API, com
aritmética centralizada em `packages/money`. Quantidade usa `numeric(14,4)`, embora a venda ao
consumidor seja sempre inteira — as casas servem à ficha técnica e ao insumo de produção.
Arredondamento explícito e uma única vez, no final do cálculo.

**Consequências.** (+) Fim dos erros de centavo em desconto, rateio e imposto. (−) Toda formatação
passa pelo helper; lint proíbe `float` para dinheiro; revisão de PR cobra isso.

---

## ADR-009 · Venda imutável e append-only
**Status:** Aceito

**Decisão.** Venda finalizada não sofre `UPDATE` de valor. Correção gera novo registro (devolução,
troca, cancelamento). Movimento de estoque e caixa seguem a mesma regra.

**Consequências.** (+) Auditoria confiável, conciliação possível, exigência fiscal atendida.
(−) Corrigir erro dá mais trabalho ao operador — e é assim que tem de ser.

---

## ADR-010 · Entitlements desde o primeiro commit
**Status:** Aceito

**Contexto.** O sistema será revendido em planos Básico/Ideal/Completo (D7).

**Decisão.** Toda feature de plano nasce atrás de uma chave de entitlement, bloqueada no servidor e
escondida no cliente. Planos e limites são dados (`plan.features`/`plan.limits`), não código.

**Consequências.** (+) Comercial muda plano sem deploy; upsell fica natural. (−) Um pouco mais de
cerimônia em cada feature — muito mais barato que retrofitar depois de vender o plano errado.

---

## ADR-011 · Numeração fiscal e sequencial de venda atribuídos pelo servidor
**Status:** Aceito

**Contexto.** Vendas nascem offline em vários terminais; numeração fiscal não pode ter buraco nem
duplicidade por série.

**Decisão.** O PDV gera o **UUID** da venda (idempotência). O **número sequencial** da venda e o
**número fiscal** são atribuídos pelo servidor, por (loja) e (CNPJ, série).

**Consequências.** (+) Zero colisão de numeração. (−) O cupom impresso offline mostra um
identificador provisório e o número definitivo aparece na nota — precisa estar claro no layout do
cupom para não confundir o cliente.
