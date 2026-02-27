

# Correção: Vídeo do template não sendo enviado no Inbox

## Problema Identificado

Ao selecionar o template "Disparo prestação de contas" via comando `/` no Inbox, apenas o texto é enviado ao contato -- o vídeo (16MB) não chega. Verifiquei no banco de dados que:

- O template existe com `media_type: video` e `media_url` apontando para o storage
- **Nenhuma mensagem** no banco de dados utiliza a URL do template (`template-1772015898240.mp4`), confirmando que a mídia nunca foi enviada via Inbox com esse template
- Vários vídeos foram enviados individualmente (via upload manual), confirmando que o fluxo de mídia funciona em geral

## Causa Raiz

O fluxo de seleção de template (`handleSlashSelect` em `MessageView.tsx`) tem dois problemas:

1. **Envio assíncrono sem feedback adequado**: A mídia é enviada via `await handleSendMedia(...)`, mas se a instância não estiver selecionada ou ocorrer um erro, o toast de erro pode passar despercebido enquanto o texto permanece no input
2. **Texto e mídia desconectados**: O texto vai para o campo de input (usuário envia manualmente com Enter), mas a mídia é disparada automaticamente. Se a mídia falhar, o usuário não percebe e envia apenas o texto

## Solução

Modificar o fluxo de seleção de template para **enviar texto e mídia juntos** de forma mais robusta:

### Mudanças em `src/components/inbox/MessageView.tsx`

1. **Enviar o texto automaticamente junto com a mídia** quando o template tem mídia: ao invés de apenas colocar o texto no input e enviar a mídia separadamente, enviar o texto via `handleSendMessage` automaticamente e depois enviar a mídia com um pequeno delay

2. **Melhorar feedback de erro**: Quando a mídia falhar, mostrar um toast claro indicando que "O vídeo do template não foi enviado"

3. **Validar instância antes de processar**: Verificar se há instância selecionada logo no início do `handleSlashSelect`, antes de processar o template

### Mudança no fluxo:

```text
ANTES:
1. Template selecionado
2. Texto colocado no input (usuario precisa apertar Enter)
3. Media enviada automaticamente (se falhar, usuario nao percebe)
4. Usuario aperta Enter -> envia texto
Resultado: texto chega, video pode nao chegar

DEPOIS:
1. Template selecionado
2. Valida instancia selecionada
3. Envia texto automaticamente via handleSendMessage
4. Envia media automaticamente com feedback claro de erro
Resultado: ambos sao enviados juntos, com feedback claro
```

### Detalhes da implementacao

No `handleSlashSelect`, quando o template tem midia:
- Chamar `handleSendMessage` com o conteudo processado (envio automatico do texto)
- Aguardar 500ms para evitar race condition
- Chamar `handleSendMedia` com o `media_url` do template
- Se a midia falhar, mostrar toast explicito: "Erro ao enviar o vídeo do template"
- Limpar o campo de mensagem

Quando o template NAO tem midia:
- Manter comportamento atual (texto no input, usuario envia manualmente)

