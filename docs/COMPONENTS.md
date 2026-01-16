# Componentes React

## Visão Geral

Os componentes seguem o padrão de composição do React com TypeScript, utilizando shadcn/ui como base.

## Estrutura de Pastas

```
src/components/
├── ui/                    # Componentes base (shadcn)
├── inbox/                 # Inbox/Mensagens
├── campaigns/             # Campanhas
├── contacts/              # Contatos
├── funnel/                # CRM/Funil
├── ai-agent/              # Agentes de IA
├── forms/                 # Formulários
├── dashboard/             # Dashboard/Widgets
├── settings/              # Configurações
└── layout/                # Layout (Header, Sidebar)
```

---

## Componentes Base (ui/)

Componentes do shadcn/ui customizados:

| Componente | Descrição |
|------------|-----------|
| `Button` | Botões com variantes |
| `Input` | Campo de entrada |
| `Select` | Dropdown de seleção |
| `Dialog` | Modal/diálogo |
| `Card` | Container com estilo |
| `Table` | Tabela de dados |
| `Tabs` | Navegação por abas |
| `Toast` | Notificações |

### Exemplo de Uso

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

export const MyComponent = () => (
  <Card>
    <CardHeader>
      <CardTitle>Título</CardTitle>
    </CardHeader>
    <CardContent>
      <Input placeholder="Digite algo..." />
      <Button>Enviar</Button>
    </CardContent>
  </Card>
);
```

---

## Inbox (`inbox/`)

### ConversationList
Lista de conversas com filtros e busca.

```tsx
<ConversationList
  conversations={conversations}
  selectedId={selectedConversationId}
  onSelect={(id) => setSelectedConversationId(id)}
  onMarkAsRead={(id) => markAsRead(id)}
/>
```

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| conversations | Conversation[] | Lista de conversas |
| selectedId | string | ID da conversa selecionada |
| onSelect | (id: string) => void | Callback de seleção |
| onMarkAsRead | (id: string) => void | Marcar como lida |

---

### MessageView
Visualização de mensagens de uma conversa.

```tsx
<MessageView
  conversationId={conversationId}
  messages={messages}
  onSendMessage={handleSendMessage}
/>
```

**Props:**
| Prop | Tipo | Descrição |
|------|------|-----------|
| conversationId | string | ID da conversa |
| messages | Message[] | Lista de mensagens |
| onSendMessage | (content: string) => void | Enviar mensagem |

---

### MessageComposer
Área de composição de mensagens.

```tsx
<MessageComposer
  onSend={handleSend}
  onSendMedia={handleSendMedia}
  disabled={isLoading}
/>
```

**Features:**
- Input de texto com emoji picker
- Upload de mídia (imagem, áudio, documento)
- Gravação de áudio
- Templates rápidos

---

### NewConversationDialog
Diálogo para iniciar nova conversa.

```tsx
<NewConversationDialog
  onConversationCreated={(id) => navigate(`/inbox?conversation=${id}`)}
/>
```

---

## Campanhas (`campaigns/`)

### CampaignList
Lista de campanhas com ações.

```tsx
<CampaignList
  campaigns={campaigns}
  onStart={(id) => startCampaign(id)}
  onPause={(id) => pauseCampaign(id)}
  onEdit={(id) => openEditor(id)}
/>
```

---

### CampaignEditor
Editor de campanha (wizard multi-step).

```tsx
<CampaignEditor
  campaign={campaign}
  onSave={handleSave}
  onCancel={handleCancel}
/>
```

**Steps:**
1. Informações básicas
2. Seleção de lista
3. Template de mensagem
4. Configurações de envio
5. Revisão e confirmação

---

### CampaignStats
Estatísticas de uma campanha.

```tsx
<CampaignStats campaignId={campaignId} />
```

**Métricas:**
- Total de contatos
- Enviadas
- Entregues
- Falhadas
- Taxa de entrega

---

## Contatos (`contacts/`)

### ContactList
Lista de contatos com busca e filtros.

```tsx
<ContactList
  contacts={contacts}
  onSelect={(contact) => openContact(contact)}
  onEdit={(contact) => editContact(contact)}
/>
```

---

### ContactCard
Card de visualização de contato.

```tsx
<ContactCard
  contact={contact}
  onMessage={() => startConversation(contact.id)}
  onEdit={() => editContact(contact.id)}
/>
```

---

### ContactForm
Formulário de criação/edição de contato.

```tsx
<ContactForm
  contact={contact}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

**Campos:**
- Nome
- Telefone (com validação brasileira)
- Email
- Notas
- Campos personalizados
- Tags

---

## CRM/Funil (`funnel/`)

### FunnelKanban
Visualização Kanban do funil de vendas.

```tsx
<FunnelKanban
  funnelId={funnelId}
  deals={deals}
  stages={stages}
  onMoveDeal={(dealId, stageId) => moveDeal(dealId, stageId)}
/>
```

**Features:**
- Drag and drop de cards
- Filtros por responsável, valor, data
- Ações rápidas nos cards
- Totalizadores por etapa

---

### DealCard
Card de um deal no Kanban.

```tsx
<DealCard
  deal={deal}
  onOpen={() => openDeal(deal.id)}
  onWon={() => markAsWon(deal.id)}
  onLost={() => markAsLost(deal.id)}
/>
```

---

### DealDetails
Painel de detalhes de um deal.

```tsx
<DealDetails
  dealId={dealId}
  onClose={handleClose}
/>
```

**Seções:**
- Informações do deal
- Contato associado
- Histórico de atividades
- Tarefas
- Notas

---

## Agentes de IA (`ai-agent/`)

### AgentConfigForm
Formulário de configuração do agente.

```tsx
<AgentConfigForm
  config={agentConfig}
  onSave={handleSave}
/>
```

**Abas:**
- Personalidade
- Mensagens (saudação, despedida, fallback)
- Comportamento (limites, horários)
- Base de conhecimento
- Integrações

---

### KnowledgeBaseManager
Gerenciador da base de conhecimento.

```tsx
<KnowledgeBaseManager
  agentId={agentId}
  items={knowledgeItems}
  onAdd={handleAdd}
  onDelete={handleDelete}
/>
```

---

## Dashboard (`dashboard/`)

### WidgetGrid
Grid de widgets personalizáveis.

```tsx
<WidgetGrid
  widgets={userWidgets}
  onReorder={handleReorder}
  onResize={handleResize}
/>
```

---

### Widgets Disponíveis

| Widget | Descrição |
|--------|-----------|
| `ConversationsWidget` | Resumo de conversas |
| `CampaignStatsWidget` | Métricas de campanhas |
| `FunnelWidget` | Pipeline de vendas |
| `TasksWidget` | Tarefas pendentes |
| `RecentContactsWidget` | Contatos recentes |

---

## Padrões de Código

### Props com TypeScript

```tsx
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'ghost';
  onClick: () => void;
  disabled?: boolean;
}

export const Button = ({ 
  label, 
  variant = 'primary', 
  onClick, 
  disabled = false 
}: ButtonProps) => {
  // ...
};
```

### Composição

```tsx
// Componente composto
<Card>
  <Card.Header>
    <Card.Title>Título</Card.Title>
    <Card.Description>Descrição</Card.Description>
  </Card.Header>
  <Card.Content>
    Conteúdo
  </Card.Content>
  <Card.Footer>
    <Button>Ação</Button>
  </Card.Footer>
</Card>
```

### Hooks Customizados

```tsx
// Hook para lógica reutilizável
const useContact = (contactId: string) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['contact', contactId],
    queryFn: () => fetchContact(contactId)
  });

  const updateContact = useMutation({
    mutationFn: (data) => updateContactApi(contactId, data)
  });

  return { contact: data, isLoading, error, updateContact };
};
```

---

## Temas e Estilização

### Tokens de Design

Usar tokens semânticos do design system:

```tsx
// ✅ Correto
<div className="bg-background text-foreground">
<Button className="bg-primary text-primary-foreground">

// ❌ Evitar
<div className="bg-white text-black">
<Button className="bg-blue-500 text-white">
```

### Responsividade

```tsx
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-3 
  gap-4
">
  {items.map(item => <Card key={item.id} />)}
</div>
```

### Animações

```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.2 }}
>
  Conteúdo animado
</motion.div>
```
