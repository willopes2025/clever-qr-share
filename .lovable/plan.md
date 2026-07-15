## Problema

O link curto gerado no inbox de um lead (ex.: Rotary Club) está sendo tratado como se identificasse o próprio remetente:

- `FormLinkButton` envia `contact_id` e `conversation_id` como `static_params` do short link.
- `submit-form` ao detectar `static_params.contact_id` reusa o contato existente (linhas 483-519 de `supabase/functions/submit-form/index.ts`), atualiza os dados dele com o que a outra pessoa preencheu e dispara a automação para o número original.

Resultado: quem preenche não vira lead novo, e o lead do Rotary é sobrescrito.

## Objetivo

Ao compartilhar o link do inbox com outra pessoa:
1. Sempre criar um novo contato/lead a partir do telefone/email preenchido (não reutilizar o contato de origem).
2. Registrar no `tracking` do novo deal os dados do lead que originou o compartilhamento (referrer), aparecendo nos campos de UTM/origem do lead novo.

## Mudanças

### 1. `src/components/inbox/FormLinkButton.tsx`
Trocar os `staticParams` enviados ao criar o short link. Em vez de:
```
{ contact_id, conversation_id }
```
enviar chaves de rastreamento (que o `submit-form` já mescla em `tracking`):
```
{
  utm_source: 'indicacao',
  utm_medium: 'inbox',
  utm_campaign: 'lead-<contact_display_id ou id curto>',
  utm_referrer_contact_id: contactId,
  utm_referrer_conversation_id: conversationId,
  utm_referrer_name: <nome do contato de origem>,
}
```
Isso exige receber `contactName` (e opcionalmente `contactDisplayId`) via props — a chamada em `MessageInput`/afins passa a repassar esses dados.

### 2. `supabase/functions/submit-form/index.ts`
- Remover (ou tornar opt-in por outra chave, ex.: `static_params.update_existing_contact === 'true'`) o bloco das linhas 483-519 que reutiliza `staticContactId`. Sem isso, o fluxo natural (linhas 521-575) já busca por telefone/email e cria um contato novo quando não existe.
- Garantir que as chaves `utm_referrer_contact_id`, `utm_referrer_conversation_id`, `utm_referrer_name` sejam incluídas na lista `trackingKeys` (linha 79) para que entrem no `tracking` do deal criado.
- Manter o `shared_by` já existente (atribuição do usuário que compartilhou).

### 3. `src/components/funnels/DealTrackingSection.tsx`
Adicionar labels amigáveis para as novas chaves em `LABELS` e `ORDER`:
- `utm_referrer_contact_id` → "Indicado por (ID)"
- `utm_referrer_name` → "Indicado por"
- `utm_referrer_conversation_id` → "Conversa de origem"

## Fora de escopo

- Não mexer no `create-form-short-link` (ele só persiste o que vier em `static_params`).
- Não mexer no fluxo `/s/:code` — o `ShortLinkRedirect` continua propagando `static_params` como query, então as novas chaves UTM já viajam para o formulário e para o `submit-form`.
- Nenhuma migração de banco: `funnel_deals.tracking` é `jsonb` livre.