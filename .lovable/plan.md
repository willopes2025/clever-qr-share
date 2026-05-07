## Problema

A sincronização da instância **Seven 7685** falha porque o endpoint `POST /chat/findChats/Seven 7685` da Evolution API retorna **500** com a mensagem `Cannot read properties of null (reading 'mediaUrl')`. Esse é um bug interno da Evolution (não do nosso código), provavelmente disparado por algum chat antigo com mídia inválida.

Hoje a edge function `sync-message-history` aborta inteira quando `findChats` falha, então o usuário vê apenas "erro de edge function" sem alternativa.

## Solução

Tornar a função tolerante a esse cenário com **3 estratégias de fallback**, em ordem:

### 1. Fallback A — usar contatos já existentes no banco
Se `findChats` falhar, em vez de abortar, buscar todos os `contacts` da organização da instância que têm conversa nessa `instance_id` e iterar sobre eles, chamando `findMessages` por `remoteJid` reconstruído (`{phone}@s.whatsapp.net`).

### 2. Fallback B — endpoint alternativo de chats
Tentar `POST /chat/findContacts/{instance}` (lista contatos brutos do WhatsApp) como segunda tentativa. Esse endpoint não monta o objeto de mídia que está quebrando o findChats.

### 3. Mensagem de erro clara
Se todos falharem, retornar 200 com `success: false` e um campo `evolutionError` explicando que o servidor Evolution está com problema, em vez de 500. O dialog frontend mostra o motivo real ("A Evolution API retornou erro interno ao listar chats — tente novamente em alguns minutos ou reconecte a instância").

### 4. Try/catch por chat já existe
O loop por chat já tem try/catch individual (linha 419), então um chat com problema não derruba os outros — só falta proteger o `findChats` inicial.

## Arquivos afetados

- `supabase/functions/sync-message-history/index.ts` — adicionar fallbacks A/B e melhorar mensagem de erro
- `src/components/instances/SyncHistoryDialog.tsx` — exibir `evolutionError` quando vier no payload de resposta

## Resultado esperado

Você consegue clicar em "Sincronizar" para a instância Seven 7685 com data 06/05/2026 e:
- Se a Evolution recuperar, sincroniza normalmente
- Se `findChats` continuar quebrado, o sistema usa os contatos existentes da Seven e busca mensagens individualmente daqueles contatos
- Em último caso, mensagem clara em vez de "erro de edge function"

## Observação importante

Se nenhum dos fallbacks trouxer mensagens, o problema está no **celular conectado** à instância Seven 7685 (Evolution não consegue ler o histórico local dele). Nesse caso a única solução é **reconectar a instância** (logout + novo QR Code) para forçar a Evolution a reconstruir o cache de chats.