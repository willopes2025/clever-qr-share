

# Plano: Adicionar Tag Automatica aos Contatos que Receberam Mensagem

## Visao Geral

Adicionar uma opcao no formulario de criacao/edicao de campanha para selecionar ou criar uma tag que sera automaticamente atribuida aos contatos cujas mensagens foram **entregues com sucesso**.

## Fluxo do Usuario

```text
+------------------------------------------+
| Nova Campanha                            |
+------------------------------------------+
| Nome: Black Friday 2024                  |
| Template: [Promocao Black Friday]        |
| Lista: [Clientes VIP]                    |
|                                          |
| ─── Tag de Entrega ───────────────────── |
| Adicionar tag aos contatos que           |
| receberam a mensagem:                    |
|                                          |
| [x] Aplicar tag ao entregar              |
|                                          |
| Tag: [Selecione ou crie uma tag   v]     |
|      ├─ 🏷️ Black Friday 2024            |
|      ├─ 🏷️ Promocao                      |
|      ├─ 🏷️ Cliente Ativo                 |
|      └─ + Criar nova tag...              |
|                                          |
| [Criar nova tag]                         |
| Nome: [________________]                 |
| Cor:  [🔵 Azul]                          |
|                                          |
+------------------------------------------+
```

## Alteracoes no Banco de Dados

### 1. Adicionar coluna na tabela `campaigns`

```sql
ALTER TABLE campaigns
ADD COLUMN tag_on_delivery_id uuid REFERENCES tags(id) ON DELETE SET NULL;
```

Esta coluna armazenara o ID da tag que sera aplicada aos contatos quando a mensagem for entregue.

## Alteracoes no Frontend

### 1. Atualizar `CampaignFormDialog.tsx`

**Arquivo:** `src/components/campaigns/CampaignFormDialog.tsx`

Adicionar:
- Estado `tagOnDeliveryId` para armazenar a tag selecionada
- Estado `enableTagOnDelivery` (switch on/off)
- Query para buscar tags existentes
- Dropdown para selecionar tag existente
- Opcao para criar nova tag inline
- UI para criar nova tag (nome + cor)

Campos a adicionar no formulario:
```typescript
// Novos estados
const [enableTagOnDelivery, setEnableTagOnDelivery] = useState(false);
const [tagOnDeliveryId, setTagOnDeliveryId] = useState<string | null>(null);
const [showCreateTag, setShowCreateTag] = useState(false);
const [newTagName, setNewTagName] = useState('');
const [newTagColor, setNewTagColor] = useState('#3B82F6');

// Query para buscar tags
const { data: tags } = useQuery({
  queryKey: ['tags', user?.id],
  queryFn: async () => {
    const { data } = await supabase.from('tags').select('*').order('name');
    return data;
  },
});
```

### 2. Atualizar Interface de Submissao

**Arquivo:** `src/components/campaigns/CampaignFormDialog.tsx`

Adicionar `tag_on_delivery_id` nos dados enviados:

```typescript
interface CampaignFormDialogProps {
  onSubmit: (data: {
    // ... campos existentes
    tag_on_delivery_id: string | null;  // NOVO
  }) => Promise<{ id: string } | void>;
}
```

### 3. Atualizar `useCampaigns.ts`

**Arquivo:** `src/hooks/useCampaigns.ts`

Adicionar `tag_on_delivery_id` na interface `Campaign` e nas mutations:

```typescript
export interface Campaign {
  // ... campos existentes
  tag_on_delivery_id: string | null;
}
```

### 4. Atualizar `Campaigns.tsx`

**Arquivo:** `src/pages/Campaigns.tsx`

Passar o novo campo `tag_on_delivery_id` nas funcoes `handleCreate` e `handleUpdate`.

## Alteracoes no Backend (Edge Function)

### 1. Atualizar `send-campaign-messages/index.ts`

**Arquivo:** `supabase/functions/send-campaign-messages/index.ts`

Modificar a logica de envio para:
1. Buscar `tag_on_delivery_id` da campanha
2. Apos confirmar entrega com sucesso (`status: 'sent'`), adicionar a tag ao contato

```typescript
// Buscar campanha com tag_on_delivery_id
const { data: campaign } = await supabase
  .from('campaigns')
  .select('*, tag_on_delivery_id')
  .eq('id', campaignId)
  .single();

// Apos envio bem sucedido (linha ~765)
if (evolutionResponse.ok && evolutionResult.key) {
  // ... codigo existente de update status ...
  
  // Aplicar tag se configurada
  if (campaign.tag_on_delivery_id && message.contact_id) {
    await supabase
      .from('contact_tags')
      .upsert(
        { contact_id: message.contact_id, tag_id: campaign.tag_on_delivery_id },
        { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
      );
    console.log(`Tag ${campaign.tag_on_delivery_id} applied to contact ${message.contact_id}`);
  }
}
```

## Consideracoes Importantes

1. **Tag so e aplicada em caso de sucesso**: A tag so sera adicionada quando `evolutionResponse.ok && evolutionResult.key` for verdadeiro
2. **Evitar duplicatas**: Uso de `upsert` com `onConflict` para nao criar tags duplicadas
3. **Tag opcional**: O switch permite que a funcionalidade seja opcional
4. **Criacao inline**: Usuario pode criar nova tag diretamente no formulario

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/campaigns/CampaignFormDialog.tsx` | Adicionar UI de selecao/criacao de tag |
| `src/hooks/useCampaigns.ts` | Adicionar `tag_on_delivery_id` na interface e mutations |
| `src/pages/Campaigns.tsx` | Passar novo campo para handlers |
| `supabase/functions/send-campaign-messages/index.ts` | Aplicar tag apos envio bem sucedido |
| **Migration SQL** | Adicionar coluna `tag_on_delivery_id` |

## Fluxo Tecnico

```text
1. Usuario cria campanha com tag "Black Friday 2024"
   ↓
2. Campanha salva com tag_on_delivery_id = "uuid-da-tag"
   ↓
3. Usuario inicia campanha
   ↓
4. Edge function envia mensagem para contato X
   ↓
5. API Evolution retorna sucesso
   ↓
6. Edge function:
   - Atualiza campaign_messages.status = 'sent'
   - Insere em contact_tags (contact_id, tag_id)
   ↓
7. Contato X agora tem a tag "Black Friday 2024"
```

## Impacto

- Permite segmentar contatos que realmente receberam a campanha
- Facilita criacao de listas dinamicas baseadas em engajamento
- Melhora rastreabilidade de campanhas
- Nao afeta campanhas existentes (campo opcional/nullable)

