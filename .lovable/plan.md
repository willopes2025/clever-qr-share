
# Plano: Tornar Linhas da Tabela de Contatos Clicáveis

## Problema Identificado
As linhas da tabela de contatos no componente `ContactsTableConfigurable` não possuem um handler de clique implementado. Quando você clica em qualquer lugar da linha (exceto nos botões e checkboxes), nada acontece.

## Solução

Modificar o componente `ContactsTableConfigurable.tsx` para:

1. **Adicionar `onClick` na `TableRow`** que chama o `onEdit(contact)` ao clicar na linha
2. **Adicionar `cursor-pointer`** para indicar visualmente que a linha é clicável
3. **Ignorar cliques em elementos interativos** (checkbox, botões, dropdowns) usando `event.stopPropagation()` ou verificando o target do evento

## Arquivos a Modificar

### `src/components/contacts/ContactsTableConfigurable.tsx`

**Alteração na `TableRow` (linha 262-264)**:
```tsx
// De:
<TableRow
  key={contact.id}
  className="border-neon-cyan/10 hover:bg-dark-700/30 transition-colors"
>

// Para:
<TableRow
  key={contact.id}
  className="border-neon-cyan/10 hover:bg-dark-700/30 transition-colors cursor-pointer"
  onClick={(e) => {
    // Ignorar cliques em elementos interativos
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('[role="checkbox"]') ||
      target.closest('[role="menuitem"]') ||
      target.closest('[data-radix-collection-item]')
    ) {
      return;
    }
    onEdit(contact);
  }}
>
```

## Comportamento Esperado Após a Mudança

- Clicar em qualquer célula da linha (telefone, nome, status, data, etc.) abrirá o formulário de edição do contato
- Clicar no checkbox continuará apenas selecionando/desselecionando o contato
- Clicar no botão de tag continuará abrindo o seletor de tags
- Clicar no menu de ações (⋮) continuará abrindo o menu normalmente
- O cursor mudará para "pointer" ao passar sobre as linhas, indicando que são clicáveis

## Detalhes Técnicos

A verificação `target.closest()` garante que cliques em elementos filhos interativos (como botões dentro de dropdowns) não acionem a edição:

- `button` - Qualquer botão (menu de ações, botão de tag)
- `[role="checkbox"]` - Checkboxes de seleção
- `[role="menuitem"]` - Itens de menu dropdown
- `[data-radix-collection-item]` - Elementos de coleção do Radix UI (dropdowns)

Esta é uma alteração simples e pontual que resolve o problema sem afetar outras funcionalidades.
