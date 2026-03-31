

## Organização de Mensagens por Conversa/Instância no Inbox

### Problema Atual
Hoje, todas as mensagens de um contato aparecem em um fluxo contínuo único, sem indicação visual de qual número (instância Evolution ou número Meta) enviou/recebeu cada mensagem. O usuário não sabe por qual canal o lead está sendo atendido.

No Kommo (referência), as mensagens são agrupadas em **cards visuais separados por conversa/instância**, com um cabeçalho identificando o número/canal usado.

### Solução Proposta

Agrupar visualmente as mensagens no chat por **blocos de conversa**, identificando o número/instância utilizado. Cada bloco terá um cabeçalho visual que mostra de qual número a interação aconteceu.

```text
┌─────────────────────────────────────────┐
│  ☁ Programa Seven (Meta)               │  ← Cabeçalho do bloco
│  via +55 27 99999-0001                  │
├─────────────────────────────────────────┤
│  [mensagens deste número]               │
│  ...                                    │
└─────────────────────────────────────────┘

  21/02/2026 19:01 SalesBot - Tags: ATENDIMENTO

┌─────────────────────────────────────────┐
│  📱 Seven7685 (Evolution)              │  ← Outro bloco
│  via +55 27 99999-0002                  │
├─────────────────────────────────────────┤
│  [mensagens deste número]               │
│  ...                                    │
└─────────────────────────────────────────┘
```

### Implementação Técnica

**1. Armazenar origem por mensagem** (migração SQL)
- Adicionar colunas `sent_via_instance_id` e `sent_via_meta_number_id` na tabela `inbox_messages` para registrar por qual número cada mensagem foi enviada/recebida
- Atualizar edge functions (`send-inbox-message`, `meta-whatsapp-send`, `meta-whatsapp-webhook`, `evolution-webhook`) para gravar essas colunas ao inserir mensagens

**2. Componente `ConversationCard`** (novo componente)
- Cabeçalho com ProviderBadge + nome da instância/número Meta + telefone formatado
- Número da conversa (ex: "Conversa Nº A72927")
- Container visual com borda sutil e fundo diferenciado

**3. Lógica de agrupamento no `MessageView.tsx`**
- Agrupar mensagens sequenciais pelo mesmo `sent_via_instance_id` ou `sent_via_meta_number_id`
- Quando a origem muda, inserir um novo cabeçalho de card
- Manter o `DateSeparator` existente dentro dos cards
- Eventos de sistema (bot, automação, movimentação) aparecem entre os cards como timeline

**4. Atualizar `MessageBubble.tsx`**
- Exibir indicador discreto do número de origem quando houver múltiplas origens na conversa (tooltip ou badge pequeno)

**5. Atualizar ConversationList**
- Mostrar o último número utilizado de forma mais proeminente na lista de conversas

### Arquivos Modificados
- `supabase/functions/send-inbox-message/index.ts` — gravar `sent_via_*`
- `supabase/functions/meta-whatsapp-send/index.ts` — gravar `sent_via_meta_number_id`
- `supabase/functions/meta-whatsapp-webhook/index.ts` — gravar `sent_via_meta_number_id`
- `supabase/functions/evolution-webhook/index.ts` — gravar `sent_via_instance_id`
- `src/components/inbox/ConversationCard.tsx` — novo componente de card
- `src/components/inbox/MessageView.tsx` — lógica de agrupamento
- `src/components/inbox/MessageBubble.tsx` — badge de origem
- Migração SQL — novas colunas em `inbox_messages`

### Notas
- Mensagens já existentes sem as novas colunas aparecerão em um bloco "sem identificação" ou usarão o `instance_id`/`meta_phone_number_id` da conversa como fallback
- A separação é puramente visual — não altera a estrutura de dados de conversas

