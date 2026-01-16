# Documentação do Banco de Dados

## Visão Geral

O banco de dados utiliza PostgreSQL via Supabase com Row Level Security (RLS) habilitado em todas as tabelas.

## Tabelas Principais

### Autenticação e Usuários

#### `profiles`
Informações adicionais do usuário.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do perfil (PK) |
| user_id | uuid | Referência ao auth.users |
| full_name | text | Nome completo |
| avatar_url | text | URL do avatar |
| role | text | Papel (admin, member) |
| organization_id | uuid | Organização do usuário |

---

### Contatos e Conversas

#### `contacts`
Contatos do CRM.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do contato (PK) |
| user_id | uuid | Dono do contato |
| phone | text | Telefone (obrigatório) |
| name | text | Nome do contato |
| email | text | Email |
| avatar_url | text | URL do avatar |
| status | text | Status (active, inactive) |
| notes | text | Observações |
| custom_fields | jsonb | Campos personalizados |
| label_id | uuid | Label/etiqueta |
| opted_out | boolean | Optou por não receber mensagens |
| last_message_at | timestamptz | Última mensagem |
| created_at | timestamptz | Data de criação |

**Políticas RLS:**
- Usuários podem ver/editar apenas seus próprios contatos

---

#### `conversations`
Conversas de chat.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da conversa (PK) |
| user_id | uuid | Dono da conversa |
| contact_id | uuid | Contato relacionado |
| instance_id | uuid | Instância WhatsApp |
| status | text | Status (open, closed) |
| unread_count | integer | Mensagens não lidas |
| last_message_at | timestamptz | Última mensagem |
| last_message_preview | text | Preview da última msg |
| ai_handled | boolean | Se IA está respondendo |
| ai_paused | boolean | Se IA está pausada |
| is_pinned | boolean | Conversa fixada |
| provider | text | Provedor (whatsapp, instagram) |

**Políticas RLS:**
- Usuários podem ver/editar apenas suas próprias conversas

---

#### `messages`
Mensagens das conversas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da mensagem (PK) |
| conversation_id | uuid | Conversa relacionada |
| user_id | uuid | Dono da mensagem |
| content | text | Conteúdo da mensagem |
| sender | text | Remetente (user, contact, system) |
| message_type | text | Tipo (text, image, audio, etc) |
| media_url | text | URL da mídia |
| status | text | Status (sent, delivered, read) |
| whatsapp_message_id | text | ID da msg no WhatsApp |
| metadata | jsonb | Metadados extras |
| created_at | timestamptz | Data de envio |

**Realtime:** Habilitado para atualizações em tempo real.

---

### WhatsApp

#### `whatsapp_instances`
Instâncias do WhatsApp conectadas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da instância (PK) |
| user_id | uuid | Dono da instância |
| instance_name | text | Nome da instância |
| api_url | text | URL da API Evolution |
| api_key | text | Chave da API |
| phone_number | text | Número conectado |
| status | text | Status (connected, disconnected) |
| qr_code | text | QR Code para conexão |
| connection_status | text | Status detalhado |

---

### Campanhas

#### `campaigns`
Campanhas de mensagens em massa.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da campanha (PK) |
| user_id | uuid | Dono da campanha |
| name | text | Nome da campanha |
| status | text | Status (draft, running, paused, completed) |
| list_id | uuid | Lista de broadcast |
| template_id | uuid | Template de mensagem |
| instance_id | uuid | Instância WhatsApp |
| total_contacts | integer | Total de contatos |
| sent | integer | Mensagens enviadas |
| delivered | integer | Mensagens entregues |
| failed | integer | Mensagens falhadas |
| scheduled_at | timestamptz | Agendamento |
| started_at | timestamptz | Início do envio |
| completed_at | timestamptz | Conclusão |

---

#### `broadcast_lists`
Listas de contatos para campanhas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da lista (PK) |
| user_id | uuid | Dono da lista |
| name | text | Nome da lista |
| description | text | Descrição |
| type | enum | Tipo (manual, dynamic) |
| filter_criteria | jsonb | Critérios de filtro (dynamic) |

---

#### `message_templates`
Templates de mensagens.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do template (PK) |
| user_id | uuid | Dono do template |
| name | text | Nome do template |
| content | text | Conteúdo com variáveis |
| category | text | Categoria |
| variables | jsonb | Variáveis disponíveis |

---

### CRM / Funil

#### `funnels`
Funis de vendas.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do funil (PK) |
| user_id | uuid | Dono do funil |
| name | text | Nome do funil |
| description | text | Descrição |
| is_default | boolean | Funil padrão |

---

#### `funnel_stages`
Etapas do funil.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID da etapa (PK) |
| funnel_id | uuid | Funil relacionado |
| name | text | Nome da etapa |
| color | text | Cor da etapa |
| order_index | integer | Ordem de exibição |
| is_won | boolean | Etapa de ganho |
| is_lost | boolean | Etapa de perda |

---

#### `funnel_deals`
Deals/Negócios do CRM.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do deal (PK) |
| user_id | uuid | Dono do deal |
| contact_id | uuid | Contato relacionado |
| stage_id | uuid | Etapa atual |
| title | text | Título do deal |
| value | numeric | Valor do negócio |
| expected_close_date | date | Data prevista de fechamento |
| won_at | timestamptz | Data de ganho |
| lost_at | timestamptz | Data de perda |
| lost_reason | text | Motivo da perda |

---

### Agentes de IA

#### `ai_agent_configs`
Configurações de agentes de IA.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do agente (PK) |
| user_id | uuid | Dono do agente |
| agent_name | text | Nome do agente |
| personality_prompt | text | Prompt de personalidade |
| greeting_message | text | Mensagem de saudação |
| goodbye_message | text | Mensagem de despedida |
| fallback_message | text | Mensagem de fallback |
| is_active | boolean | Se está ativo |
| response_mode | text | Modo de resposta |
| max_interactions | integer | Máximo de interações |
| handoff_keywords | text[] | Palavras-chave para handoff |
| active_hours_start | integer | Hora de início (0-23) |
| active_hours_end | integer | Hora de fim (0-23) |

---

#### `ai_agent_knowledge_items`
Base de conhecimento do agente.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | uuid | ID do item (PK) |
| agent_config_id | uuid | Agente relacionado |
| title | text | Título |
| content | text | Conteúdo original |
| processed_content | text | Conteúdo processado |
| source_type | text | Tipo (text, file, website) |
| status | text | Status de processamento |

---

## Funções do Banco

### `update_updated_at_column()`
Trigger para atualizar automaticamente o campo `updated_at`.

```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### `increment_unread_count()`
Incrementa contador de mensagens não lidas.

### `decrement_unread_count()`
Decrementa contador de mensagens não lidas.

---

## Políticas RLS Comuns

### Padrão de Acesso por Usuário

```sql
-- SELECT
CREATE POLICY "Users can view own data"
ON public.table_name
FOR SELECT
USING (auth.uid() = user_id);

-- INSERT
CREATE POLICY "Users can insert own data"
ON public.table_name
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE
CREATE POLICY "Users can update own data"
ON public.table_name
FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE
CREATE POLICY "Users can delete own data"
ON public.table_name
FOR DELETE
USING (auth.uid() = user_id);
```

### Acesso por Organização

```sql
CREATE POLICY "Organization members can view data"
ON public.table_name
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles
    WHERE id = auth.uid()
  )
);
```

---

## Índices Importantes

```sql
-- Busca de contatos por telefone
CREATE INDEX idx_contacts_phone ON contacts(phone);

-- Busca de conversas por contato
CREATE INDEX idx_conversations_contact_id ON conversations(contact_id);

-- Ordenação de mensagens
CREATE INDEX idx_messages_conversation_created ON messages(conversation_id, created_at);

-- Campanhas por status
CREATE INDEX idx_campaigns_status ON campaigns(status);
```

---

## Realtime

Tabelas com Realtime habilitado:
- `messages` - Atualizações de mensagens em tempo real
- `conversations` - Atualizações de conversas
- `whatsapp_instances` - Status de conexão

```sql
-- Habilitar realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```
