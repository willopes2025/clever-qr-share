

## Plano: Corrigir tratamento de erro "Bad Gateway" no envio de mensagens

### Problema
A Evolution API está retornando `502 Bad Gateway` como texto puro. O código na linha 356 de `send-inbox-message/index.ts` tenta fazer `response.json()` diretamente, o que falha com `"Unexpected token 'B', "Bad Gateway" is not valid JSON"`. Isso impede que a mensagem seja marcada como falha e que o erro seja retornado de forma legível ao usuário.

### Causa Raiz
Falta de tratamento para respostas não-JSON da Evolution API. Quando o servidor retorna 502/503/504, o body é HTML ou texto puro.

### Solução
Envolver o `response.json()` em um try-catch com fallback para `response.text()` em caso de erro de parsing, tanto no bloco Evolution API quanto no bloco Meta API.

### Alterações

**`supabase/functions/send-inbox-message/index.ts`**
- Linha ~356 (Evolution API): Substituir `const result = await response.json()` por um bloco seguro:
  ```typescript
  let result: any;
  try {
    result = await response.json();
  } catch {
    const text = await response.text().catch(() => `HTTP ${response.status}`);
    result = { error: text || `HTTP ${response.status}` };
  }
  ```
- Linha ~177 e ~249 (Meta API): Aplicar o mesmo padrão de fallback nos dois `.json()` do fluxo Meta para consistência.

### Impacto
- A mensagem será corretamente marcada como `failed` no banco
- O usuário verá a mensagem de erro real em vez de um crash genérico
- Nenhuma alteração de banco de dados

