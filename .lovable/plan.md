## Plano

Implementar a troca automática do **número/instância da empresa** usado para responder no Inbox, com base na **última mensagem recebida do lead**.

### Comportamento esperado

- Quando uma mensagem **inbound** chegar por outro número da empresa:
  - Exemplo: conversa estava selecionada em **Brasil Visão Cidadã**.
  - O lead responde pelo número **Centro de Saúde Visual**.
  - O sistema passa automaticamente o seletor do topo para **Centro de Saúde Visual**.
  - A próxima resposta manual, mídia, template ou reação sai por esse número correto.

- O usuário ainda poderá trocar manualmente o número no seletor se quiser.
- A troca automática deve seguir a última origem **recebida do lead**, não a última mensagem enviada pela equipe.

### Ajustes técnicos

1. **No `MessageView.tsx`**
   - Calcular a última mensagem `inbound` da conversa.
   - Detectar sua origem:
     - `sent_via_instance_id` para WhatsApp Lite/Evolution.
     - `sent_via_meta_number_id` para WhatsApp Oficial/Meta.
   - Sincronizar `selectedInstanceId`, `selectedMetaNumberId` e `metaUsingEvoInstance` com essa origem quando ela mudar.
   - Evitar sobrescrever seleção manual sem necessidade: a automação roda quando a última mensagem recebida muda ou quando a conversa abre.

2. **Persistir a escolha na conversa**
   - Se a última mensagem inbound veio por WhatsApp Lite, atualizar `conversations.instance_id` e limpar uso Meta quando necessário.
   - Se veio por Meta, atualizar `conversations.meta_phone_number_id`, `provider = 'meta'` e `instance_id = null`.
   - Isso mantém o seletor correto também depois de recarregar a página.

3. **Corrigir webhook Meta, se necessário**
   - O webhook Meta já salva `sent_via_meta_number_id` nas mensagens inbound.
   - Mas o update final da conversa precisa também manter `meta_phone_number_id = webhookPhoneNumberId`, para a conversa ficar apontada para o número Meta que recebeu a última mensagem.

4. **Manter compatibilidade com Evolution**
   - O webhook Evolution já atualiza `conversations.instance_id` para a instância que recebeu a mensagem.
   - A UI passará a refletir isso automaticamente pela última mensagem inbound.

5. **Feedback visual opcional e discreto**
   - Manter o seletor atual no topo como fonte visual da decisão.
   - Se couber sem poluir, adicionar tooltip/label curto indicando que o número selecionado acompanha a última mensagem recebida.

### Resultado

O atendente não precisará trocar manualmente de **Brasil Visão Cidadã** para **Centro de Saúde Visual** quando o lead responder em outro número da empresa; a próxima resposta já sairá pelo canal correto.