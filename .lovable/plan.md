

## Corrigir sobrescrita de nome de contatos importados pelo pushName do WhatsApp

### Causa Raiz

No webhook `receive-webhook`, quando um contato é encontrado por telefone (linha 810-816), a query SELECT busca apenas `id, label_id, phone` — **não inclui `name`**. Isso faz com que `contact.name` seja `undefined`, que é tratado como string vazia na lógica de pushName (linha 940), fazendo o sistema considerar o nome como "genérico" e sobrescrevê-lo com o pushName do WhatsApp.

Contatos importados com nomes corretos (ex: "Wanderlon Silva") perdem o nome porque o sistema acha que o nome está vazio.

### Solução

**Arquivo:** `supabase/functions/receive-webhook/index.ts`

1. **Linha 812** — Adicionar `name` ao SELECT da busca por telefone:
   - De: `.select('id, label_id, phone')`
   - Para: `.select('id, label_id, phone, name')`

Isso é tudo. Com `contact.name` corretamente carregado, a lógica existente de `isGenericName` funcionará como esperado — nomes reais como "Wanderlon Silva" não serão considerados genéricos e não serão sobrescritos pelo pushName.

### Resultado

Contatos importados com nomes corretos manterão seus nomes mesmo quando responderem mensagens no WhatsApp. A atualização por pushName continuará funcionando apenas para contatos sem nome ou com nomes genéricos (números de telefone, "Cliente", etc.).

