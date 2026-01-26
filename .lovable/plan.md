
# Plano: Escolha de Tipo de Entidade no Mapeamento de Importacao

## Visao Geral

Ao importar uma planilha de contatos, o usuario podera escolher se cada campo mapeado e um campo de **Contato** ou de **Lead/Deal**. Os campos serao pareados com os campos personalizados ja existentes no banco de dados, separados por tipo de entidade.

## Arquitetura Atual vs. Proposta

```text
ATUAL:
+---------------------------+
|  Coluna CSV: "Empresa"    |
|  Mapear para: [dropdown]  |
|    - Ignorar              |
|    - Nome                 |
|    - Telefone             |
|    - Campos Personalizados|  <- Todos misturados
|    - Criar novo campo     |
+---------------------------+

PROPOSTO:
+---------------------------+
|  Coluna CSV: "Empresa"    |
|  Mapear para: [dropdown]  |
|    - Ignorar              |
|    - Nome (Contato)       |
|    - Telefone (Contato)   |
|  ─── Campos do Contato ───|
|    - CNPJ                 |
|    - CPF                  |
|  ─── Campos do Lead ──────|
|    - Origem               |
|    - Atendente            |
|  ─── Criar Novo Campo ────|
|    + Novo campo...        |  <- Abre dialog com seletor de entidade
+---------------------------+
```

## Alteracoes Necessarias

### 1. Atualizar Interface `NewFieldConfig`

**Arquivo:** `src/components/contacts/CreateFieldInlineDialog.tsx`

Adicionar `entity_type` a interface:

```typescript
export interface NewFieldConfig {
  field_name: string;
  field_key: string;
  field_type: FieldType;
  options?: string[];
  is_required?: boolean;
  entity_type?: 'contact' | 'lead';  // NOVO
}
```

### 2. Atualizar `CreateFieldInlineDialog`

**Arquivo:** `src/components/contacts/CreateFieldInlineDialog.tsx`

Adicionar seletor de tipo de entidade no formulario de criacao:

```text
+---------------------------+
| Nome do Campo             |
| [Empresa               ]  |
+---------------------------+
| Tipo de Entidade          |  <- NOVO
| (•) Contato  ( ) Lead     |
+---------------------------+
| Tipo do Campo             |
| [Texto                  ] |
+---------------------------+
```

Alteracoes:
- Adicionar estado `entityType` com valor padrao 'contact'
- Adicionar `RadioGroup` ou `ToggleGroup` para selecionar 'contact' ou 'lead'
- Incluir `entity_type` no objeto retornado por `handleSubmit`
- Adicionar prop opcional `defaultEntityType` para pre-selecionar

### 3. Atualizar Mapeamento no `ImportContactsDialogV2`

**Arquivo:** `src/components/contacts/ImportContactsDialogV2.tsx`

Modificar o dropdown de mapeamento para separar campos por entidade:

**Estrutura do SelectContent:**
```text
- Ignorar coluna
- Campos Padrao (Nome, Telefone, Email, Notas, ID Externo)
─── Campos do Contato ───────────────────
  - CNPJ (texto)
  - CPF (texto)
  - Empresa (texto)
─── Campos do Lead ─────────────────────
  - Origem (selecao)
  - Atendente (texto)
  - Status IA (texto)
─── Criar Novo Campo ───────────────────
  + Criar campo personalizado...
```

Alteracoes:
- Filtrar `existingFields` por `entity_type === 'contact'` e `entity_type === 'lead'`
- Adicionar separadores visuais para cada grupo
- Mostrar badge indicando tipo de entidade em campos novos

### 4. Atualizar Interface `ColumnMapping`

**Arquivo:** `src/components/contacts/ImportContactsDialogV2.tsx`

Adicionar tracking de entity_type no mapeamento:

```typescript
interface ColumnMapping {
  csvColumn: string;
  targetField: string;
  isNewField?: boolean;
  newFieldConfig?: NewFieldConfig;
  entityType?: 'contact' | 'lead';  // NOVO - para campos existentes
}
```

### 5. Atualizar `handleImport` para Separar Dados

**Arquivo:** `src/components/contacts/ImportContactsDialogV2.tsx`

Modificar a logica de construcao dos contatos para separar custom_fields:

```typescript
const contacts = contactsToImport.map((row) => {
  const contact = {
    phone: "",
    custom_fields: {},      // Campos do CONTATO
    lead_custom_fields: {}, // Campos do LEAD (NOVO)
  };

  Object.entries(columnMappings).forEach(([column, mapping]) => {
    // ... logica existente para campos padrao ...
    
    if (mapping.targetField.startsWith("custom:")) {
      const fieldKey = mapping.targetField.replace("custom:", "");
      const field = existingFields.find(f => f.field_key === fieldKey);
      
      if (field?.entity_type === 'lead') {
        contact.lead_custom_fields[fieldKey] = value;
      } else {
        contact.custom_fields[fieldKey] = value;
      }
    }
  });

  return contact;
});
```

### 6. Atualizar `useContacts.importContacts`

**Arquivo:** `src/hooks/useContacts.ts`

Modificar para:
- Aceitar `entity_type` nos novos campos
- Salvar campos de lead no deal quando existir
- Criar deal automaticamente se houver campos de lead

```typescript
// Na interface de contacts
contacts: {
  phone: string;
  name?: string;
  email?: string;
  custom_fields?: Record<string, unknown>;
  lead_custom_fields?: Record<string, unknown>;  // NOVO
}[];

// Ao criar novos campos
const fieldsToInsert = newFields.map((field, index) => ({
  field_name: field.field_name,
  field_key: field.field_key,
  field_type: field.field_type,
  options: field.options || [],
  is_required: field.is_required || false,
  display_order: index,
  user_id: user.id,
  entity_type: field.entity_type || 'contact',  // NOVO
}));

// Ao inserir contatos
// Se tiver lead_custom_fields, criar/atualizar deal
```

### 7. Atualizar Props do Componente

**Arquivo:** `src/pages/Contacts.tsx`

Passar campos separados por tipo para o dialog:

```typescript
<ImportContactsDialogV2
  existingFields={fieldDefinitions}  // Ja inclui entity_type de cada campo
  // ...
/>
```

## Fluxo do Usuario

1. Usuario carrega planilha CSV
2. Sistema detecta colunas e tenta auto-mapear
3. Para cada coluna, usuario ve:
   - Campos padrao (Nome, Telefone, Email, etc.)
   - **Campos do Contato** (separados)
   - **Campos do Lead** (separados)
   - Opcao de criar novo campo
4. Ao criar novo campo, usuario escolhe:
   - Nome do campo
   - **Tipo de entidade (Contato ou Lead)**
   - Tipo de variavel (texto, numero, data, etc.)
5. Ao importar:
   - Campos de contato salvos em `contacts.custom_fields`
   - Campos de lead salvos em `funnel_deals.custom_fields`

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/contacts/CreateFieldInlineDialog.tsx` | Adicionar seletor entity_type |
| `src/components/contacts/ImportContactsDialogV2.tsx` | Separar campos por entidade no dropdown, rastrear entity_type no mapeamento |
| `src/hooks/useContacts.ts` | Aceitar entity_type nos newFields, separar custom_fields por entidade |
| `src/components/leads/ImportLeadsDialog.tsx` | Aplicar mesma logica de separacao |

## Consideracoes Tecnicas

1. **Compatibilidade retroativa**: Campos existentes sem entity_type sao tratados como 'contact'
2. **Criacao de deal**: Se houver campos de lead na importacao, sera necessario definir em qual funil/etapa criar o deal (ou usar um padrao)
3. **Validacao**: Garantir que campos obrigatorios de cada entidade sejam preenchidos

## Impacto

- Usuarios poderao organizar melhor os dados importados
- Campos de lead ficarao vinculados ao deal, nao ao contato
- Maior flexibilidade na importacao de dados de diferentes origens
