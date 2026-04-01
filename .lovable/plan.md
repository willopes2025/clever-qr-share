

## Corrigir variáveis não substituídas na exibição de mensagens Meta

### Problema
Ao enviar campanhas com templates Meta, as mensagens chegam corretamente no WhatsApp do destinatário (a Meta API substitui as variáveis), mas a **mensagem salva no Inbox** e no preview mostra o texto bruto com `{{1}}`, `{{2}}` ao invés dos valores reais (nome, telefone, etc.).

Causa: na linha 1022 de `send-campaign-messages/index.ts`, o conteúdo salvo é `metaTemplate.body_text` sem substituir as variáveis pelos valores já resolvidos em `bodyParams`.

### Solução
Após resolver os `bodyParams`, substituir `{{1}}`, `{{2}}`, etc. no `body_text` pelos valores correspondentes antes de salvar no `inbox_messages` e `conversations.last_message_preview`.

### Arquivo alterado
**`supabase/functions/send-campaign-messages/index.ts`** (1 alteração)

Na seção de persistência (~linhas 1021-1022), substituir:
```typescript
const displayContent = metaTemplate.body_text || '';
```

Por lógica que percorre os `bodyParams` já resolvidos e substitui `{{N}}` no texto:
```typescript
let displayContent = metaTemplate.body_text || '';
if (bodyParams && bodyParams.length > 0) {
  bodyParams.forEach((param, idx) => {
    displayContent = displayContent.replace(
      new RegExp(`\\{\\{${idx + 1}\\}\\}`, 'g'),
      param.text || ''
    );
  });
}
```

Isso garante que o texto armazenado no Inbox reflita exatamente o que o destinatário recebeu (ex: "Opa, Patrícia!" ao invés de "Opa, {{1}}!").

### Escopo do `bodyParams`
A variável `bodyParams` é declarada dentro de um bloco `if (bodyVarCount > 0)`. Preciso movê-la para fora do bloco ou declarar no escopo mais amplo para que esteja acessível na seção de persistência (~40 linhas abaixo). Alternativamente, posso fazer a substituição inline logo após a construção dos params.

### Detalhes técnicos
- A mesma correção precisa ser aplicada na seção de erro (~linha 963) onde o conteúdo também é salvo com template bruto
- Nenhuma alteração de banco de dados necessária
- A correção afeta apenas futuras mensagens; mensagens já salvas mantêm o texto bruto

