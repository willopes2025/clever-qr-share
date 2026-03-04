

# Usar pushName do WhatsApp como nome inicial do contato

## Problema

Na linha 766 do `receive-webhook/index.ts`, o `pushName` (nome do perfil WhatsApp) é extraído corretamente. Porém:

1. Se a **primeira mensagem** é enviada pelo usuário (outgoing/fromMe), o `pushName` é descartado e o nome fica "Cliente"
2. Quando o contato **responde depois**, o webhook tem o `pushName` correto, mas o código **nunca atualiza** o nome de contatos existentes — só usa o `pushName` na criação

## Solução

Adicionar lógica para atualizar o nome do contato existente com o `pushName` quando:
- O contato já existe no banco
- O nome atual é genérico ("Cliente", null, vazio, ou apenas números/telefone)
- O `pushName` recebido é válido (não vazio, não é número de telefone)

### Mudança no `receive-webhook/index.ts`

Após o bloco que encontra o contato existente (por volta da linha 910-917, onde já atualiza `label_id`), adicionar verificação:

```
Se contact existe E pushName é válido E nome atual é genérico → atualizar nome com pushName
```

Nomes considerados "genéricos" (que devem ser substituídos pelo pushName):
- "Cliente"
- null / undefined / vazio
- Apenas dígitos (ex: "5527988355451")
- Formato de telefone brasileiro

Isso garante que:
- Se o usuário editou o nome manualmente (ex: "Marina Jadjesky"), ele **não é sobrescrito**
- Apenas nomes genéricos/placeholder são substituídos pelo nome real do WhatsApp

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/receive-webhook/index.ts` | Adicionar lógica para atualizar nome genérico com pushName válido |

