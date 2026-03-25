

## Múltiplos Telefones por Contato — Usando JSON no `custom_fields`

### Problema
Leads podem ter mais de um número de telefone, mas o sistema armazena apenas um no campo `phone` da tabela `contacts`. Não há como escolher para qual número enviar a mensagem.

### Abordagem
Armazenar telefones adicionais como array JSON dentro do campo `custom_fields` do contato (ex: `custom_fields.additional_phones`), mantendo o campo `phone` como número principal. Na hora de enviar, o usuário poderá selecionar qual número usar.

### Mudanças

**1. Painel de Contato — Gerenciar múltiplos telefones**
- Em `ContactInfoContent.tsx` e `LeadPanelContactInfo.tsx`: exibir o telefone principal + lista de telefones adicionais vindos de `custom_fields.additional_phones`
- Botão "Adicionar telefone" para incluir novos números ao array
- Cada telefone adicional terá rótulo opcional (ex: "Trabalho", "Pessoal") e botão de remover
- Opção de "tornar principal" (troca o `phone` pelo selecionado e move o antigo para a lista)

**2. Seletor de telefone no MessageView**
- Em `MessageView.tsx`: quando o contato tem telefones adicionais, exibir um dropdown/chip ao lado do campo de mensagem para escolher qual número receberá a mensagem
- O número selecionado será enviado como parâmetro `targetPhone` na chamada do edge function `send-inbox-message`
- Por padrão, usa o telefone principal (`contact.phone`)

**3. Edge Function `send-inbox-message`**
- Aceitar novo parâmetro opcional `targetPhone`
- Se fornecido, usar esse número ao invés do `contact.phone` para construir o `remoteJid`
- Mesma lógica para `send-inbox-media`

**4. Estrutura do JSON**
```json
{
  "additional_phones": [
    { "phone": "5527999887766", "label": "Trabalho" },
    { "phone": "5511988776655", "label": "Pessoal" }
  ]
}
```

### Arquivos a editar
- `src/components/inbox/ContactInfoContent.tsx` — UI de gerenciar telefones
- `src/components/inbox/lead-panel/LeadPanelContactInfo.tsx` — exibir telefones
- `src/components/inbox/MessageView.tsx` — seletor de telefone destino
- `supabase/functions/send-inbox-message/index.ts` — aceitar `targetPhone`
- `supabase/functions/send-inbox-media/index.ts` — aceitar `targetPhone`

### Sem migrações necessárias
O campo `custom_fields` (JSONB) já existe na tabela `contacts`, então não é preciso alterar o schema.

