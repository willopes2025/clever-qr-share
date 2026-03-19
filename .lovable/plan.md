

## Plano: Separar conversas por número Meta e exibir número correto no Inbox

### Problema Atual
1. **Conversas Meta não mostram qual número recebeu a mensagem** — o campo `meta_phone_number_id` está preenchido nas conversas, mas não é exibido na lista nem no header do chat.
2. **O seletor de instância no MessageView só mostra instâncias Evolution API** — para conversas Meta, não há como ver/trocar o número Meta remetente.
3. **O filtro por número Meta já existe nos filtros** (`metaPhoneNumberId`), mas precisa de melhor visibilidade.

### O que será feito

**1. Exibir o número Meta na lista de conversas**
- Na `ConversationList`, ao lado do `ProviderBadge`, mostrar o número Meta formatado (ex: `+55 27 2666-0075`) buscando da tabela `meta_whatsapp_numbers` via um hook/query.
- Criar um pequeno hook `useMetaWhatsAppNumbers` que carrega os números ativos e permite mapear `phone_number_id` → `phone_number` / `display_name`.

**2. Adaptar o seletor de número no MessageView para conversas Meta**
- Quando `conversation.provider === 'meta'`, substituir o seletor de instâncias Evolution pelo seletor de números Meta.
- Listar os números da tabela `meta_whatsapp_numbers` (ativos) no dropdown.
- Ao trocar o número, atualizar `conversation.meta_phone_number_id` no banco.
- Desabilitar a validação `!selectedInstanceId` para conversas Meta (usar `meta_phone_number_id` em vez disso).

**3. Mostrar o número Meta no header do chat**
- Abaixo do nome do contato no `MessageView`, exibir o número Meta de onde veio/vai a conversa (ex: "via +55 27 2666-0075").

**4. Melhorar filtro rápido por número Meta**
- Adicionar chips de filtro rápido ou tornar o filtro `metaPhoneNumberId` mais acessível nos `ConversationFilters`, listando os números Meta como opções no dropdown.

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useMetaWhatsAppNumbers.ts` | **Novo** — hook para buscar números Meta ativos |
| `src/components/inbox/MessageView.tsx` | Seletor condicional: Evolution vs Meta; header com número Meta |
| `src/components/inbox/ConversationList.tsx` | Exibir número Meta ao lado do ProviderBadge |
| `src/components/inbox/ConversationFilters.tsx` | Popular dropdown de números Meta usando o novo hook |

### Detalhes técnicos

- O hook `useMetaWhatsAppNumbers` fará `supabase.from('meta_whatsapp_numbers').select('phone_number_id, phone_number, display_name').eq('is_active', true)` e retornará um mapa `Record<string, { phone_number, display_name }>`.
- No `MessageView`, a lógica de envio já funciona para Meta via `send-inbox-message` — só precisa garantir que o `meta_phone_number_id` correto esteja na conversa.
- O seletor Meta usará o mesmo componente `Select` mas populado com números Meta em vez de instâncias Evolution.

