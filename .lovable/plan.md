

# Plano: Duplicar Campos, Ocultar e Lógica Condicional no Form Builder

## O que muda

### 1. Duplicar Campo (Botão direito / Context Menu)
Ao clicar com o botão direito em um campo no canvas, aparece um menu de contexto com opções: **Duplicar** e **Excluir**. Duplicar cria uma cópia do campo com `position + 1` e label sufixada com "(cópia)".

### 2. Ocultar Campo (Visibilidade condicional)
No painel de propriedades (`FieldProperties.tsx`), adicionar uma seção **"Lógica Condicional"** que permite:
- Ativar/desativar visibilidade condicional via toggle
- Selecionar o **campo de referência** (outro campo do formulário, ex: "Tem dependente?")
- Selecionar o **operador** (igual a, diferente de, contém, está vazio)
- Definir o **valor esperado** (ex: "Sim")

Os dados ficam salvos no campo `conditional_logic` (JSONB já existente na tabela `form_fields`):
```json
{
  "enabled": true,
  "field_id": "uuid-do-campo-referencia",
  "operator": "equals",
  "value": "Sim"
}
```

### 3. Renderização condicional no formulário público
Na edge function `public-form`, adicionar JavaScript que esconde/mostra campos com base na `conditional_logic`, reagindo a mudanças no campo de referência em tempo real.

## Arquivos a editar

### `src/components/forms/builder/FieldCanvas.tsx`
- Substituir o botão de delete por um **ContextMenu** (Radix) no clique direito com opções: Duplicar, Excluir
- Adicionar prop `onDuplicateField`
- Manter o botão de delete no hover como atalho visual

### `src/pages/FormBuilder.tsx`
- Criar handler `handleDuplicateField` que lê o campo selecionado, cria um novo com `createField.mutate(...)` copiando todos os dados exceto `id`

### `src/components/forms/builder/FieldProperties.tsx`
- Adicionar seção **"Lógica Condicional"** no final do painel:
  - Toggle para ativar
  - Select para escolher campo de referência (lista dos outros campos do formulário)
  - Select para operador
  - Input para valor esperado
- Requer receber `allFields` como prop adicional

### `supabase/functions/public-form/index.ts`
- Ao gerar o HTML dos campos, adicionar `data-conditional-field`, `data-conditional-operator`, `data-conditional-value` nos campos com lógica condicional
- Adicionar script JS que escuta `change`/`input` nos campos referenciados e faz `show/hide` dos campos dependentes

## Sem migração de banco
O campo `conditional_logic` (JSONB) já existe na tabela `form_fields`.

