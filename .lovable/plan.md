## Situação atual

Hoje existem **dois lugares** onde se pode escolher o número de envio para um chatbot:

1. **No chatbot** (`ChatbotFlowFormDialog`) → campo "Instância WhatsApp (opcional)" salvo em `chatbot_flows.instance_id` (apenas Evolution).
2. **Na automação do funil** (`AutomationFormDialog` → ação "Acionar fluxo de chatbot") → campo "Número de envio" salvo em `funnel_automations.action_config.sender` (Evolution **ou** Meta).

### Como está funcionando hoje (bug)

- A automação envia `overrideInstanceId` / `overrideMetaPhoneNumberId` para `execute-chatbot-flow` e isso **sempre vence**.
- O `chatbot_flows.instance_id` configurado no chatbot **não é lido** pela `execute-chatbot-flow` — ou seja, hoje ele simplesmente não faz nada.
- Se nenhum dos dois estiver setado, usa-se a `conversation.instance_id` e, como último recurso, o número padrão do usuário.

## Regra de precedência proposta

Do mais específico para o mais genérico:

```text
1. Automação (sender escolhido no card de automação)   ← mais específico, vence
2. Chatbot (instance_id configurado no fluxo)
3. Conversa (instance_id da conversa do contato)
4. Fallback automático (instância padrão do usuário / Meta)
```

Justificativa: a automação é o gatilho mais contextual ("neste funil, nesta etapa, dispare este chatbot por este número"), então deve sobrescrever o padrão do chatbot. O padrão do chatbot, por sua vez, sobrescreve o que estava na conversa.

**Resposta direta à sua pergunta:** se os dois campos estiverem preenchidos, **vence o da automação**. O do chatbot só será usado se a automação não definir um número (opção "Automático").

## O que muda no código

### 1. `supabase/functions/execute-chatbot-flow/index.ts`
- Carregar `chatbot_flows.instance_id` junto com o flow.
- Aplicar a precedência:
  - Se `overrideInstanceId`/`overrideMetaPhoneNumberId` (automação) → usa esse.
  - Senão se `flow.instance_id` (chatbot) → usa esse.
  - Senão mantém `conversation.instance_id` + fallback existente.

### 2. `src/components/chatbot-builder/ChatbotFlowFormDialog.tsx`
- Atualizar o helper text do campo "Instância WhatsApp" para deixar claro:
  > "Será usado quando a automação que aciona este chatbot não definir um número específico. Automações com número escolhido têm prioridade."
- (Opcional) adicionar suporte a número Meta também, mantendo paridade com a automação. **Status:** deixar para uma segunda iteração — não pedido agora.

### 3. `src/components/funnels/AutomationFormDialog.tsx`
- Renomear a opção padrão "Automático (conversa do contato)" para **"Automático (usar padrão do chatbot ou da conversa)"** e adicionar uma linha de ajuda explicando a precedência.

### 4. `supabase/functions/resume-scheduled-flows/index.ts`
- Nenhuma mudança: já repassa o override armazenado em `chatbot_executions.variables`. Só vai herdar a nova precedência via `execute-chatbot-flow`.

## Validação

1. Criar chatbot com instância A.
2. Criar automação que dispara esse chatbot **sem** escolher número → deve enviar pela instância A.
3. Editar a automação e escolher instância B → deve enviar por B (ignorando A).
4. Remover escolha da automação → volta a enviar por A.
5. Remover instância do chatbot e da automação → cai no fallback (conversa / padrão do usuário).