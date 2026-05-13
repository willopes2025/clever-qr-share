## Objetivo
Permitir escolher, dentro da automação **Acionar fluxo de chatbot**, qual número (Evolution ou Meta WhatsApp) será usado para disparar as mensagens do fluxo — em vez de depender da instância da conversa do contato (ou de um fallback aleatório).

## Onde aparece (UI)

No diálogo **Editar Automação** (`AutomationFormDialog.tsx`), logo abaixo do seletor "Fluxo de Chatbot", adicionar um novo seletor:

```
Fluxo de Chatbot     [ Venda Ganha ▾ ]
Número de envio      [ Usar número da conversa do contato (padrão) ▾ ]
                       ── WhatsApp (Evolution) ──
                       • Mercearia Saudável
                       • Wide Comercial
                       ── WhatsApp Oficial (Meta) ──
                       • +55 84 8180-5060
```

Comportamento:
- Padrão = "Usar número da conversa do contato" (mantém retrocompatibilidade).
- Lista usa `useWhatsAppInstances` (já importado no arquivo) e `useMetaWhatsAppNumbers` (já importado).
- Valor salvo em `action_config.sender` no formato já usado em outras partes do projeto: `evo:<instance_id>` ou `meta:<phone_number_id>`.

## Mudanças técnicas

### 1. Frontend — `src/components/funnels/AutomationFormDialog.tsx`
- Bloco `actionType === 'trigger_chatbot_flow'` (linha 1289): adicionar `<Select>` para `action_config.sender`.
- Carregar `instances` e `metaNumbers` (hooks já importados, basta consumir).

### 2. Edge Function — `supabase/functions/process-funnel-automations/index.ts`
- Case `trigger_chatbot_flow` (linha 1071): ler `actionConfig.sender`, dividir em `evo:` / `meta:` e enviar no body para `execute-chatbot-flow` como `overrideInstanceId` ou `overrideMetaPhoneNumberId`.
- Persistir esse override também em `chatbot_executions` (campos `instance_id` / `meta_phone_number_id` se existirem na tabela; senão, dentro de `variables`) para que retomadas agendadas (`resume-scheduled-flows`) também respeitem o número.

### 3. Edge Function — `supabase/functions/execute-chatbot-flow/index.ts`
- Aceitar `overrideInstanceId` e `overrideMetaPhoneNumberId` no body.
- Quando presentes, sobrescrever `resolvedInstanceId` / `metaPhoneNumberId` ANTES do bloco de fallback (linhas 86–121).
- Não atualizar `conversations.instance_id` quando o override foi usado (evita "sequestrar" a conversa do contato com outro número).

### 4. `resume-scheduled-flows` — `supabase/functions/resume-scheduled-flows/index.ts`
- Repassar override armazenado em `chatbot_executions` ao re-chamar `execute-chatbot-flow`, para delays longos manterem o número escolhido.

## Sem mudanças de schema necessárias
Tudo cabe em `funnel_automations.action_config` (jsonb) e no payload entre as edge functions. Caso seja útil persistir o override por execução para o resume, podemos guardá-lo no `variables` jsonb que já é usado.

## Validação após implementação
1. Criar automação "Venda Ganha" → escolher um número específico → mover deal para a etapa.
2. Verificar `chatbot_executions` recebe o override e `execute-chatbot-flow` envia pela instância escolhida (logs).
3. Testar fluxo com nó `delay` longo + `resume-scheduled-flows` para garantir que retoma com o mesmo número.
