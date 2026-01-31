

# Plano: Corrigir Dados de Lead Não Aparecendo no Funil

## Problema Identificado

Quando um contato é adicionado via formulário e roteado para um funil, os dados como **município** e **data do evento** não aparecem na etapa do funil.

### Causa Raiz (Análise Detalhada)

Baseado na investigação do banco de dados:

```
contact_custom_fields: { municipio: "Vila velha" }  ✅ SALVO
deal_custom_fields: {}                               ❌ VAZIO
```

O sistema possui dois tipos de campos personalizados:
- **Campos de Contato** (`entity_type='contact'`): Salvos em `contacts.custom_fields`
- **Campos de Lead** (`entity_type='lead'`): Salvos em `funnel_deals.custom_fields`

O problema ocorre porque:

1. O campo "município" está configurado como `entity_type='contact'`
2. O formulário salva corretamente em `contacts.custom_fields`
3. Quando o deal é criado, o sistema **NÃO copia os dados** para `funnel_deals.custom_fields`
4. A seção "Campos do Lead" no funil só exibe campos com `entity_type='lead'`
5. O usuário não tem nenhum campo definido como `entity_type='lead'`

## Solução Proposta

### Parte 1: Adicionar Opção de Mapeamento para Lead no Builder

No `FieldProperties.tsx`, adicionar uma nova opção de mapeamento para campos de lead:

```text
Mapeamento para o Lead
├── Não salvar no perfil
├── Campo nativo do contato (Nome, Email, Telefone)
├── Campo personalizado existente (Contato) 
├── Campo personalizado existente (Lead)    ← NOVO
├── Criar novo campo personalizado
└── Criar novo campo de Lead                ← NOVO
```

### Parte 2: Modificar Submit-Form para Salvar Dados de Lead

No `submit-form/index.ts`, quando processar campos mapeados, separar entre:
- `contactCustomFields`: Campos com `entity_type='contact'`
- `dealCustomFields`: Campos com `entity_type='lead'`

Quando criar o deal, incluir os `dealCustomFields`:

```typescript
.insert({
  funnel_id: form.target_funnel_id,
  stage_id: stageId,
  contact_id: contactId,
  user_id: form.user_id,
  title: contactData.name || 'Lead do Formulário',
  source: `Formulário: ${form.name}`,
  custom_fields: dealCustomFields,  // ← ADICIONAR
})
```

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/forms/builder/FieldProperties.tsx` | Adicionar opções `lead_field` e `new_lead_field` |
| `supabase/functions/submit-form/index.ts` | Separar campos por entity_type e incluir no deal |

## Alterações Técnicas

### 1. FieldProperties.tsx

```typescript
// Adicionar nas opções do Select de mapping_type:
<SelectItem value="lead_field">Campo de Lead existente</SelectItem>
<SelectItem value="new_lead_field">Criar novo campo de Lead</SelectItem>

// Adicionar seções condicionais para exibir campos de lead:
{localField.mapping_type === 'lead_field' && (
  <Select ...>
    {leadFieldDefinitions?.map((cf) => (...))}
  </Select>
)}
```

### 2. submit-form/index.ts

```typescript
// Ao processar campos, verificar entity_type:
let dealCustomFields: Record<string, any> = {};

for (const field of formFields) {
  // ... lógica existente para contact_field ...
  
  if (field.mapping_type === 'lead_field' && field.mapping_target && fieldValue) {
    dealCustomFields[field.mapping_target] = fieldValue;
  }
  
  // ... outros casos ...
}

// Ao criar deal:
.insert({
  // ... campos existentes ...
  custom_fields: Object.keys(dealCustomFields).length > 0 ? dealCustomFields : null,
})
```

## Fluxo Esperado Após Correção

```text
1. Usuário configura formulário
   ├── Campo "Município" → Mapear para Lead (lead_field)
   └── Campo "Data Evento" → Criar novo campo de Lead (new_lead_field)

2. Lead preenche formulário
   └── submit-form processa:
       ├── Dados de contato → contacts.custom_fields
       └── Dados de lead → funnel_deals.custom_fields

3. Deal é criado no funil
   └── custom_fields = { "municipio": "Vila Velha", "data_evento": "2026-02-15" }

4. Usuário visualiza card no funil
   └── Seção "Dados do Lead" exibe municipio e data_evento ✅
```

## Solução Temporária para Dados Existentes

Para os dados que já foram submetidos (como os da Andressa Martins), será necessário:

1. Criar campos de Lead no sistema (via Gerenciador de Campos)
2. Migrar os dados de `contacts.custom_fields` para `funnel_deals.custom_fields`

Isso pode ser feito via query SQL ou manualmente no sistema.

