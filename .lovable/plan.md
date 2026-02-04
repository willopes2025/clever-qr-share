
# Edição em Massa: Funil e Contatos

## Visão Geral

Adicionar funcionalidade de edição em massa expandida que permita modificar múltiplos campos de uma vez, incluindo:
- **Funil List View**: Valor, Etapa, Campos Personalizados (lead)
- **Contatos**: Campos Personalizados (contato), associação a Funil/Etapa

## O Que Será Construído

### 1. Novo Dialog: "Edição em Massa Completa"

Um dialog unificado e mais poderoso que substitui/expande o `BulkEditFieldDialog` atual:

```
+----------------------------------------------------------+
| Editar em Massa (X selecionados)                         |
+----------------------------------------------------------+
| O que deseja alterar?                                    |
|                                                          |
| ☐ Valor                                                  |
|   [R$ _________]                                         |
|                                                          |
| ☐ Etapa                                                  |
|   [Selecione uma etapa ▼]                                |
|                                                          |
| ☐ Campo Personalizado                                    |
|   [Selecione ▼]  →  [Novo valor ▼ / ___]                 |
|                                                          |
| ☐ Responsável                                            |
|   [Selecione membro ▼]                                   |
|                                                          |
| ☐ Data de Previsão                                       |
|   [📅 __/__/____]                                        |
+----------------------------------------------------------+
| [Cancelar]                       [Aplicar Alterações]    |
+----------------------------------------------------------+
```

### 2. Alterações por Módulo

#### Funil (List View) - Campos Editáveis em Massa:
| Campo | Tipo | Comportamento |
|-------|------|---------------|
| Valor | Número | Atualiza `funnel_deals.value` |
| Etapa | Select | Move todos os deals para a etapa selecionada |
| Responsável | Select | Atualiza `funnel_deals.responsible_id` |
| Data de Previsão | Date | Atualiza `funnel_deals.expected_close_date` |
| Campo Personalizado (Lead) | Dinâmico | Atualiza `funnel_deals.custom_fields[key]` |

#### Contatos (Page) - Campos Editáveis em Massa:
| Campo | Tipo | Comportamento |
|-------|------|---------------|
| Campo Personalizado (Contato) | Dinâmico | Atualiza `contacts.custom_fields[key]` |
| Associar a Funil | Select | Cria novo deal no funil/etapa selecionados |

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/shared/BulkEditDialog.tsx` | Criar | Componente unificado de edição em massa |
| `src/components/funnels/FunnelListView.tsx` | Modificar | Substituir dialog atual pelo novo |
| `src/pages/Contacts.tsx` | Modificar | Adicionar botão "Editar Campos" nas ações em massa |
| `src/hooks/useFunnels.ts` | Modificar | Adicionar `bulkUpdateDeals` mutation |
| `src/hooks/useContacts.ts` | Modificar | Adicionar `bulkUpdateContacts` mutation |

## Fluxo de Uso

### Funil (List View):
1. Usuário seleciona múltiplos leads via checkbox
2. Clica em "Editar em Massa" na barra de ações
3. Seleciona quais campos quer alterar
4. Define os novos valores
5. Clica em "Aplicar"
6. Sistema atualiza todos os deals selecionados

### Contatos:
1. Usuário seleciona múltiplos contatos via checkbox
2. Clica em "Editar Campos" na barra de ações
3. Escolhe campo personalizado ou associação a funil
4. Define o valor
5. Clica em "Aplicar"

## Seção Técnica

### Novo Hook: `bulkUpdateDeals`

```typescript
const bulkUpdateDeals = useMutation({
  mutationFn: async ({ 
    dealIds, 
    updates 
  }: { 
    dealIds: string[]; 
    updates: {
      value?: number;
      stage_id?: string;
      responsible_id?: string | null;
      expected_close_date?: string | null;
      custom_field?: { key: string; value: unknown };
    };
  }) => {
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < dealIds.length; i += BATCH_SIZE) {
      const batch = dealIds.slice(i, i + BATCH_SIZE);
      
      // Se mudou de etapa, precisamos de lógica especial
      if (updates.stage_id) {
        for (const dealId of batch) {
          await updateDeal.mutateAsync({ 
            id: dealId, 
            stage_id: updates.stage_id 
          });
        }
      } else {
        // Para outros campos, update em batch
        const updateData: Record<string, unknown> = {};
        if (updates.value !== undefined) updateData.value = updates.value;
        if (updates.responsible_id !== undefined) updateData.responsible_id = updates.responsible_id;
        if (updates.expected_close_date !== undefined) updateData.expected_close_date = updates.expected_close_date;
        
        const { error } = await supabase
          .from('funnel_deals')
          .update(updateData)
          .in('id', batch);
          
        if (error) throw error;
      }
      
      // Custom fields - precisam ser atualizados individualmente
      if (updates.custom_field) {
        for (const dealId of batch) {
          const { data: deal } = await supabase
            .from('funnel_deals')
            .select('custom_fields')
            .eq('id', dealId)
            .single();
            
          await supabase
            .from('funnel_deals')
            .update({ 
              custom_fields: {
                ...(deal?.custom_fields || {}),
                [updates.custom_field.key]: updates.custom_field.value
              }
            })
            .eq('id', dealId);
        }
      }
    }
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['funnels'] });
    toast.success(`${variables.dealIds.length} lead(s) atualizado(s)`);
  }
});
```

### Novo Hook: `bulkUpdateContacts`

```typescript
const bulkUpdateContacts = useMutation({
  mutationFn: async ({
    contactIds,
    updates
  }: {
    contactIds: string[];
    updates: {
      custom_field?: { key: string; value: unknown };
      funnel_assignment?: { funnel_id: string; stage_id: string };
    };
  }) => {
    const BATCH_SIZE = 50;
    
    for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
      const batch = contactIds.slice(i, i + BATCH_SIZE);
      
      // Custom fields
      if (updates.custom_field) {
        for (const contactId of batch) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('custom_fields')
            .eq('id', contactId)
            .single();
            
          await supabase
            .from('contacts')
            .update({ 
              custom_fields: {
                ...(contact?.custom_fields || {}),
                [updates.custom_field.key]: updates.custom_field.value
              }
            })
            .eq('id', contactId);
        }
      }
      
      // Funnel assignment - criar deals
      if (updates.funnel_assignment) {
        for (const contactId of batch) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('name')
            .eq('id', contactId)
            .single();
            
          await supabase.from('funnel_deals').insert({
            user_id: user!.id,
            funnel_id: updates.funnel_assignment.funnel_id,
            stage_id: updates.funnel_assignment.stage_id,
            contact_id: contactId,
            title: contact?.name || 'Novo Lead',
            value: 0
          });
        }
      }
    }
  },
  onSuccess: (_, variables) => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['funnels'] });
    toast.success(`${variables.contactIds.length} contato(s) atualizado(s)`);
  }
});
```

### Componente BulkEditDialog

O componente será modular, recebendo:
- `mode`: 'deals' | 'contacts'
- `selectedIds`: IDs selecionados
- `fieldDefinitions`: campos personalizados disponíveis
- `stages`: etapas do funil (apenas para deals)
- `funnels`: lista de funis (apenas para contatos)
- `members`: membros da equipe (apenas para deals)
- `onConfirm`: callback de confirmação

### UI Melhorada para Funil List View

O botão atual "Editar Campo" será substituído por um dropdown com mais opções:

```
[▼ Editar em Massa]
├── Alterar Valor
├── Mover para Etapa
├── Alterar Responsável  
├── Alterar Data Previsão
├── Editar Campo Personalizado
└── Editar Múltiplos Campos... (abre dialog completo)
```

Isso dá atalhos rápidos para ações comuns e o dialog completo para edições mais complexas.
