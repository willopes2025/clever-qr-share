

## Plano: Corrigir roteamento de resposta Meta para leads existentes

### Problema

Quando uma campanha Meta envia um template para um contato que **já possui conversa** no sistema (via Evolution API), o código encontra a conversa existente e reutiliza o ID dela, mas **não atualiza** os campos `provider` e `meta_phone_number_id`. Quando o contato responde, o sistema roteia a resposta pela Evolution API (telefone antigo) em vez do número Meta que enviou o template.

### Causa raiz

Em `send-campaign-messages/index.ts`, linhas 992-993: quando `existingConv` é encontrada, o código apenas faz `conversationId = existingConv.id` sem atualizar o provider da conversa para `meta`.

### Solução

**Arquivo: `supabase/functions/send-campaign-messages/index.ts`**

Em 2 pontos (sucesso e falha), após encontrar uma conversa existente, adicionar um `UPDATE` para atualizar o provider:

```typescript
if (existingConv) {
  conversationId = existingConv.id;
  // Atualizar provider para meta quando template é enviado via Meta
  await supabase.from('conversations').update({
    provider: 'meta',
    meta_phone_number_id: phoneNumberId,
  }).eq('id', conversationId);
}
```

Isso garante que:
- A conversa existente passe a ser tratada como Meta
- A resposta do contato será roteada pelo número Meta correto
- O `meta-whatsapp-webhook` encontrará a conversa com `provider: 'meta'`

### Arquivos modificados

| Arquivo | Alteração |
|---|---|
| `send-campaign-messages/index.ts` | Adicionar UPDATE de `provider` e `meta_phone_number_id` em 2 pontos (sucesso ~linha 993 e falha ~linha 943) |

### Impacto
- Nenhuma alteração de banco de dados
- 1 arquivo backend modificado
- Corrige o roteamento para todos os leads existentes que recebem templates Meta

