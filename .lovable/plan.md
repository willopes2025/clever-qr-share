# Botões com roteamento por resposta (estilo Kommo)

## O que vai mudar (visão de produto)

Hoje o construtor de Chatbot tem o nó **"List Message"** (lista do WhatsApp) e **"Pergunta"** (texto livre), mas:

- A lista até é enviada com opções, **mas o fluxo não bifurca** pela opção que o lead clica — sempre segue um único caminho.
- Não existe um nó de **botões rápidos** (Meta reply buttons / opções 1, 2, 3) com uma saída para cada botão.
- Não há saídas para **"Outra resposta"** (digitou algo fora das opções), **"Sem resposta"** (timeout) e **"Falha ao enviar"** — exatamente o que o Kommo mostra na captura de tela.

A proposta é igualar o comportamento do Kommo: cada botão/opção vira uma saída independente do nó, e o fluxo é roteado pela resposta do lead.

## Mudanças

### 1. Novo nó "Botões" (`buttons`)

- Adicionar à barra lateral do builder, na categoria **Mensagens**.
- Configuração:
  - Texto da mensagem (com chips de variáveis).
  - Lista de **1 a 3 botões** (limite do WhatsApp Cloud API), cada um com um rótulo curto.
  - Toggle opcional **"Aguardar resposta"** com timeout em minutos (padrão 60).
- Envio:
  - **Canal Meta:** envia como `interactive` do tipo `button` com `reply.id = btn_<n>`.
  - **Canal Evolution:** envia como texto numerado ("1 - X / 2 - Y / 3 - Z") como fallback, aceitando o número digitado.
- Saídas (handles na borda inferior do nó):
  - Uma saída para cada botão configurado.
  - Saída **"Outra resposta"** (qualquer texto fora das opções).
  - Saída **"Sem resposta"** (timeout estourou).
  - Saída **"Falha ao enviar"** (erro no envio do interactive).

### 2. List Message ganha roteamento por opção

- Cada item da lista vira uma saída separada (`option_0`, `option_1`, ...).
- Mesmas saídas extras: **"Outra resposta"**, **"Sem resposta"**, **"Falha ao enviar"**.
- Compatibilidade: fluxos existentes que tem só uma aresta saindo do List Message continuam caindo no caminho default (a primeira aresta sem `source_handle`).

### 3. Captura da resposta (resume)

- Quando chega mensagem do lead enquanto a execução está em `waiting_input` no nó `buttons` ou `list_message`:
  - Identificar o `id` do botão clicado / `rowId` da lista (Meta envia em `interactive.button_reply.id` / `list_reply.id`; Evolution em `selectedRowId` / `selectedButtonId`).
  - Se vier texto puro, tentar casar com o número (1/2/3) ou com o rótulo do botão (case-insensitive).
  - Resolver a aresta pelo `source_handle` correspondente (`btn_0`, `option_0`, `other`, `timeout`, `failed`).
  - Se nenhuma aresta combinar, cair no `getNextNode` default (igual hoje).

### 4. Visual do nó no canvas

- Nó com header próprio (ícone de botão), preview do texto e lista de botões com bolinha colorida em cada saída — espelha o card que aparece na captura do Kommo (PIX / BOLETO / DEPÓSITO + Outra/Sem resposta/Falha).

## Detalhes técnicos

### Frontend (sem mudança de schema visual)

- `src/components/chatbot-builder/nodes/ButtonsNode.tsx` (novo) — renderiza handle por botão + 3 handles fixos (`other`, `timeout`, `failed`).
- `src/components/chatbot-builder/nodes/ListMessageNode.tsx` — adicionar handles por item (`option_<i>`) e os 3 handles fixos.
- `src/components/chatbot-builder/ChatbotFlowSidebar.tsx` — entrada nova `{ type: "buttons", label: "Botões", icon: MousePointerClick, color: "bg-sky-500" }`.
- `src/components/chatbot-builder/ChatbotFlowEditor.tsx` — registrar o novo `nodeType` no `nodeTypes`.
- `src/components/chatbot-builder/ChatbotNodeConfig.tsx` — painel de config com lista de botões (CRUD) + toggle de timeout. Reaproveitar `VariableChipsSelector`.

### Backend (`supabase/functions/execute-chatbot-flow/index.ts`)

- Adicionar `case 'buttons':`
  - Tenta enviar via Meta (`interactive.button`) se `metaPhoneNumberId` estiver resolvido; senão, fallback para texto numerado via Evolution.
  - Em caso de erro de envio, segue imediatamente pela aresta `failed` (sem entrar em waiting_input).
  - Em sucesso, marca `waiting_input` + `scheduled_resume_at = now + timeoutMin` para acionar saída `timeout`.
- Atualizar `case 'list_message':` para também marcar `scheduled_resume_at` e passar a resolver a aresta pelo `source_handle`.
- Atualizar bloco de resume (linhas ~250-275) para:
  - Ler `inputValue` + `inputMeta` (novo campo opcional vindo do webhook com `buttonId` / `rowId`).
  - Função `resolveBranch(node, inputValue, inputMeta)` que devolve `source_handle` ou `null`.
  - Se a execução foi acordada por `scheduled_resume_at` sem novo input → usar handle `timeout`.
- Quando bifurcar, usar `getNextNode(node.id, handle)` que já existe (linhas 329-337).

### Webhook de entrada (Meta + Evolution)

- Confirmar nas funções de webhook (`meta-whatsapp-webhook`, `evolution-webhook`) que, ao chamar `execute-chatbot-flow` para resumir, é repassado `inputValue` (texto) e um novo campo `inputMeta` com `{ buttonId, rowId }`. Pequeno ajuste, sem mudança de contrato externo.

## Validação

1. Criar fluxo: Início → Botões (PIX / Boleto / Depósito) com 3 saídas + Outra/Sem resposta/Falha.
2. Testar em Meta: clicar em "PIX" → segue caminho PIX. Digitar "qualquer coisa" → cai em "Outra resposta". Não responder em 1 min → cai em "Sem resposta".
3. Testar em Evolution: receber "1 - PIX / 2 - Boleto / 3 - Depósito"; responder "2" → segue caminho Boleto.
4. Repetir os mesmos cenários com List Message.
5. Forçar erro de envio (número Meta sem template aprovado) → confirmar saída "Falha ao enviar".
6. Fluxos antigos com List Message de uma saída só continuam funcionando.

## Fora do escopo

- Botões com URL ou call-to-action (Meta `cta_url`) — pode entrar depois.
- Mais de 3 botões (limite do WhatsApp; usar List Message).
