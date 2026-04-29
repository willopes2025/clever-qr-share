## Diagnóstico

A mensagem "Perfeito." (id `9cf327b1...`, 18:06) falhou com `error_message = "Internal Server Error"`, mas as mensagens enviadas segundos antes e depois (18:05, 18:06:41, 18:08) funcionaram normalmente para o **mesmo contato LID** (`LID_151050073964640`).

Isso indica:

1. **Não é bug de código nem do contato LID** — o `remoteJid` está sendo montado corretamente (`151050073964640@lid`) e o mesmo fluxo funcionou nas mensagens vizinhas.
2. **Foi uma falha transitória da Evolution API** — ela retornou HTTP 500 com corpo `"Internal Server Error"` (texto plano, não JSON). O código atual (`send-inbox-message/index.ts` linhas 563-595) captura esse texto e o salva como `error_message`, mas não tem nenhuma estratégia de retry.
3. **Pior ainda**: a mensagem é gravada como `sending` antes do fetch e marcada como `failed` após. Não há retry, então qualquer "soluço" da Evolution = mensagem perdida.

## Causa raiz

Falha pontual da Evolution API (HTTP 500). Sem mecanismo de retry, qualquer instabilidade da API externa resulta em "Falha no envio" para o usuário.

## Plano de correção

### 1. Adicionar retry automático com backoff em `send-inbox-message/index.ts`

Envolver a chamada `fetch` para `/message/sendText/` em uma função de retry:
- **3 tentativas** no total
- Backoff: 500ms → 1500ms → 3000ms
- Retry apenas em erros transitórios: HTTP 500, 502, 503, 504 ou network error
- **Não** retentar em 400, 401, 404 (erros permanentes do payload/instância)

### 2. Melhorar a mensagem de erro salva

Quando a Evolution retornar texto plano (não-JSON), incluir o status HTTP no `error_message`:
- Antes: `"Internal Server Error"`
- Depois: `"Evolution API HTTP 500: Internal Server Error (após 3 tentativas)"`

Isso facilita debug futuro e diferencia falha transitória de erro de payload.

### 3. Aplicar o mesmo padrão em `send-inbox-media`

A função de envio de mídia tem o mesmo padrão e deve receber o mesmo retry para consistência.

## Arquivos afetados

- `supabase/functions/send-inbox-message/index.ts` — adicionar helper `fetchWithRetry` e usar nas chamadas Evolution (linha ~554) e logo das mensagens de mídia internas
- `supabase/functions/send-inbox-media/index.ts` — mesmo padrão de retry

## Resultado esperado

- Falhas transitórias da Evolution API deixam de gerar "Falha no envio" visível ao usuário em ~95% dos casos
- Mensagens de erro mais informativas quando ainda assim falhar
- Sem mudanças no comportamento de envio bem-sucedido