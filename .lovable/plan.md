

## Corrigir variáveis e melhorar layout da seção de IA nos templates

### Problemas
1. Só carrega `contactFieldDefinitions` — faltam os campos de `lead` (leadFieldDefinitions)
2. Com muitos campos, os chips ficam poluídos visualmente

### Solução

**Arquivo: `src/components/templates/TemplateFormDialog.tsx`**

1. **Incluir ambos os tipos de campos** — usar `fieldDefinitions` completo (ou concatenar `contactFieldDefinitions` + `leadFieldDefinitions`) para listar todas as variáveis

2. **Agrupar variáveis em seções colapsáveis** — substituir a lista plana de chips por um layout organizado:
   - **Dados do Contato** (nome, telefone, email) — sempre visível
   - **Campos de Contato** — colapsável, mostra campos custom do tipo `contact`
   - **Campos de Lead** — colapsável, mostra campos custom do tipo `lead`
   
   Cada grupo terá um cabeçalho clicável com ícone de chevron e os chips dentro. Iniciam colapsados para manter a interface limpa.

3. **Chips mais compactos** — mostrar apenas `{{key}}` no chip, com o label como tooltip (via atributo `title`), reduzindo o tamanho visual de cada chip

### Resultado
Todas as variáveis personalizadas (contato + lead) aparecerão organizadas em grupos colapsáveis, mantendo a interface limpa mesmo com dezenas de campos.

