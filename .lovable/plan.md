# Corrigir chatbot "Endereço CSV" que envia mas o cliente não recebe

## O que está acontecendo (verificado)

O fluxo executa até o fim (todas as execuções constam como `completed`, sem erro), mas as mensagens nunca chegam ao WhatsApp.

Motivo confirmado nos dados: os contatos dessa conversa não têm telefone real — o campo está preenchido com um marcador de LID, por exemplo `LID_79671760785409` (o número real fica em `label_id`). O executor do chatbot só usa o fallback `@lid` quando o telefone está **vazio**; como o marcador não é vazio, ele envia literalmente `LID_79671760785409` como destinatário para a Evolution API, que rejeita.

Segundo problema, que escondeu o primeiro: no envio de texto e de mídia via Evolution o código grava a mensagem como `status: 'sent'` sem olhar a resposta da API. Por isso as mensagens aparecem no chat como enviadas, sem `whatsapp_message_id` e sem erro. Nas mensagens do fluxo de 04/08 às 12:44, as três saíram com `whatsapp_message_id` nulo — sinal claro de recusa silenciosa.

## Correções

1. **Destinatário correto (causa raiz)**
   Em `supabase/functions/execute-chatbot-flow/index.ts`, tratar telefones no formato `LID_<numero>` (e qualquer valor sem dígitos suficientes) como "sem telefone", usando `label_id` (ou o número extraído do próprio marcador) no formato `<lid>@lid` para a Evolution. Os caminhos Meta continuam exigindo telefone real.

2. **Parar de marcar falha como sucesso**
   Nos envios via Evolution (texto e mídia) do mesmo arquivo: verificar `resp.ok` e a presença de erro no corpo; quando falhar, gravar `status: 'failed'` e preencher `error_message` com o retorno da API, além de logar. Assim o operador vê o erro real no Inbox em vez de uma mensagem "enviada" fantasma.

3. **Verificação após o deploy**
   Disparar o fluxo "Endereço CSV" para o mesmo contato e conferir que as mensagens gravadas passam a ter `whatsapp_message_id` preenchido (ou, se falharem, com erro visível).

## Observação

Contatos com telefone `LID_...` só terão número real quando o `resolve-lid-contacts` conseguir resolvê-lo; a correção acima garante o envio mesmo enquanto o número permanecer como LID.

## Arquivos afetados

- `supabase/functions/execute-chatbot-flow/index.ts`
