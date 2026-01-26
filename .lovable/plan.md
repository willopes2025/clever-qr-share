
# Plano: Separar Dados de Contato e Lead no Sistema

## Visao Geral do Problema

Atualmente, o sistema usa uma unica tabela `custom_field_definitions` para todos os campos personalizados, e esses campos sao armazenados apenas no `contacts.custom_fields`. Isso causa confusao porque:

1. Campos que sao especificos do **Lead/Deal** (ex: origem do lead, atendente, tentativas) estao misturados com campos do **Contato** (ex: CNPJ, CPF, empresa)
2. Quando um contato tem multiplos deals em funis diferentes, os campos do lead deveriam ser por deal, nao por contato
3. A sidebar atual mostra tudo junto, sem separacao visual clara

## Arquitetura Proposta

```text
+---------------------------+
|      SIDEBAR DO LEAD      |
+---------------------------+
|  [Header: Nome + ID]      |
|  [Tags]                   |
|  [Barra de Funil]         |
+---------------------------+
|  DADOS DO LEAD (deal)     |  <-- Campos do tipo "lead"
|  - Responsavel            |      armazenados em funnel_deals.custom_fields
|  - Origem do Lead         |
|  - Atendente              |
|  - Status IA              |
+---------------------------+
|  --- Nome do Contato ---  |  <-- Separador visual
+---------------------------+
|  DADOS DO CONTATO         |  <-- Campos do tipo "contact"
|  - Telefone               |      armazenados em contacts.custom_fields
|  - Email                  |
|  - CNPJ                   |
|  - Empresa                |
+---------------------------+
```

## Alteracoes no Banco de Dados

### 1. Adicionar coluna `entity_type` na tabela `custom_field_definitions`

Nova coluna para distinguir se o campo e de Contato ou Lead:

```sql
ALTER TABLE custom_field_definitions 
ADD COLUMN entity_type text NOT NULL DEFAULT 'contact' 
CHECK (entity_type IN ('contact', 'lead'));
```

Valores:
- `contact`: Campo armazenado em `contacts.custom_fields`
- `lead`: Campo armazenado em `funnel_deals.custom_fields`

## Alteracoes no Frontend

### 2. Atualizar Hook `useCustomFields`

**Arquivo:** `src/hooks/useCustomFields.ts`

- Adicionar `entity_type` ao tipo `CustomFieldDefinition`
- Criar funcoes auxiliares para filtrar campos por tipo:
  - `contactFieldDefinitions`: campos onde `entity_type = 'contact'`
  - `leadFieldDefinitions`: campos onde `entity_type = 'lead'`
- Adicionar mutation para atualizar `funnel_deals.custom_fields`

### 3. Atualizar `CustomFieldsManager` (Dialog de Criacao)

**Arquivo:** `src/components/inbox/CustomFieldsManager.tsx`

Adicionar selector no formulario de criacao de campo:

```text
+------------------------+
| Tipo de Entidade       |
| [Contato] [Lead/Deal]  |  <-- RadioGroup ou ToggleGroup
+------------------------+
```

O usuario escolhe se o campo e do Contato ou do Lead antes de definir nome, tipo de variavel, etc.

### 4. Criar Componente `LeadFieldsSection`

**Arquivo (novo):** `src/components/inbox/lead-panel/LeadFieldsSection.tsx`

Componente que exibe e edita campos do tipo "lead", lendo/escrevendo em `funnel_deals.custom_fields`:

- Busca o deal ativo do contato no funil atual
- Renderiza campos onde `entity_type = 'lead'`
- Salva alteracoes em `funnel_deals.custom_fields`

### 5. Criar Componente `ContactFieldsSection`

**Arquivo (novo):** `src/components/inbox/lead-panel/ContactFieldsSection.tsx`

Componente que exibe e edita campos do tipo "contact", lendo/escrevendo em `contacts.custom_fields`:

- Renderiza campos onde `entity_type = 'contact'`
- Salva alteracoes em `contacts.custom_fields`

### 6. Atualizar `RightSidePanel` e `LeadPanelTabContent`

**Arquivo:** `src/components/inbox/RightSidePanel.tsx`

Reorganizar a sidebar conforme a imagem de referencia:

```text
<LeadPanelHeader />
<LeadPanelTagsSection />
<LeadPanelFunnelBar />
<LeadPanelTabs />

<LeadFieldsSection />     <-- NOVO: Dados do Lead (acima)

<Separator with Contact Name />  <-- NOVO: Linha divisoria com nome

<ContactFieldsSection />  <-- NOVO: Dados do Contato (abaixo)

<LeadPanelNotes />
<ActivityTimeline />
```

### 7. Atualizar `DealFormDialog` e `DealCustomFieldsEditor`

**Arquivo:** `src/components/funnels/DealFormDialog.tsx`
**Arquivo:** `src/components/funnels/DealCustomFieldsEditor.tsx`

- Filtrar para mostrar apenas campos onde `entity_type = 'lead'`
- Garantir que campos de lead sao salvos em `funnel_deals.custom_fields`

### 8. Atualizar `InlineFieldCreator`

**Arquivo:** `src/components/contacts/InlineFieldCreator.tsx`

- Adicionar prop `entityType` para definir o tipo padrao
- Ou adicionar seletor inline para o usuario escolher

## Fluxo do Usuario

### Ao Criar um Novo Campo Personalizado:

1. Usuario abre o dialog "Campos Personalizados"
2. Clica em "Adicionar Campo"
3. **NOVO**: Seleciona se o campo e de "Contato" ou "Lead/Deal"
4. Define nome, tipo de variavel (texto, numero, data, selecao, etc.)
5. Salva o campo

### Ao Visualizar a Sidebar:

1. **Acima**: Dados do Lead (campos do deal atual)
   - Responsavel, Origem, Status, etc.
2. **Separador**: Linha com nome do contato
3. **Abaixo**: Dados do Contato (campos do contato)
   - Telefone, Email, CNPJ, Empresa, etc.

## Arquivos a Criar/Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| Migracao SQL | Criar | Adicionar coluna `entity_type` |
| `src/hooks/useCustomFields.ts` | Modificar | Adicionar `entity_type`, filtros e mutation para deals |
| `src/components/inbox/CustomFieldsManager.tsx` | Modificar | Adicionar seletor de tipo de entidade |
| `src/components/inbox/lead-panel/LeadFieldsSection.tsx` | Criar | Editor de campos do lead (deal) |
| `src/components/inbox/lead-panel/ContactFieldsSection.tsx` | Criar | Editor de campos do contato |
| `src/components/inbox/lead-panel/ContactSeparator.tsx` | Criar | Separador visual com nome do contato |
| `src/components/inbox/RightSidePanel.tsx` | Modificar | Reorganizar layout com separacao |
| `src/components/inbox/lead-panel/LeadPanelTabContent.tsx` | Modificar | Ajustar para usar nova estrutura |
| `src/components/funnels/DealCustomFieldsEditor.tsx` | Modificar | Filtrar apenas campos de lead |
| `src/components/contacts/InlineFieldCreator.tsx` | Modificar | Adicionar suporte a `entity_type` |

## Migracao de Dados Existentes

Os campos existentes serao marcados como `entity_type = 'contact'` por padrao (via `DEFAULT 'contact'`). O usuario podera reclassificar campos existentes atraves do CustomFieldsManager editando o tipo de entidade.

## Beneficios

1. **Clareza**: Usuario sabe exatamente onde cada dado e armazenado
2. **Flexibilidade**: Mesmo contato pode ter dados diferentes em deals diferentes
3. **Organizacao Visual**: Sidebar segue padrao do Kommo (referencia do usuario)
4. **Filtros**: Campos de lead poderao ser usados como filtros especificos do funil
