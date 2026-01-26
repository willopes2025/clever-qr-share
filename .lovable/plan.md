

# Plano: Exibir Nome Completo na Seção de Dados do Contato

## Problema Identificado

O formulário está salvando o nome corretamente na coluna `contacts.name`, porém:
- O nome só aparece no **header** do painel (pequeno, no topo)
- A seção "Dados do Contato" (`ContactFieldsSection`) mostra apenas Telefone, Email e campos personalizados
- O campo "Nome Completo" não aparece na lista de campos editáveis

## Solução

Adicionar o campo "Nome Completo" como o primeiro campo na seção `ContactFieldsSection`, seguindo o mesmo padrão visual dos outros campos.

## Alteracoes Necessarias

### 1. Atualizar `ContactFieldsSection.tsx`

Adicionar o campo "Nome Completo" como campo editavel, antes do telefone e email:

```text
+---------------------------+
|  Dados do Contato         |
+---------------------------+
|  Nome Completo    [Bruno Tovar] <- NOVO
|  Telefone         [5527...]
|  Email            [email@...]
|  CNPJ             [...]
|  (outros campos personalizados)
+---------------------------+
```

**Alteracoes no codigo:**
- Adicionar estado `isEditingName` para controlar edicao do nome
- Adicionar input editavel para o campo nome
- Adicionar mutation para salvar o nome no banco
- Posicionar o campo Nome antes de Telefone e Email

### 2. Considerar Adicao de Nome ao Lead (Titulo do Deal)

O titulo do deal (`funnel_deals.title`) ja recebe o nome automaticamente quando criado via formulario. Se o usuario quiser editar o titulo do deal separadamente, podemos tambem:
- Adicionar campo "Titulo do Lead" na `LeadFieldsSection`
- Permitir editar o `funnel_deals.title` independentemente do nome do contato

## Fluxo Esperado Apos a Correcao

1. Usuario preenche formulario com "Nome Completo: Bruno Tovar"
2. Sistema salva em `contacts.name = 'Bruno Tovar'`
3. Sistema cria deal com `funnel_deals.title = 'Bruno Tovar'`
4. Na sidebar do inbox:
   - **Dados do Lead**: mostra campos personalizados de lead + titulo do deal
   - **Separador**: "Bruno Tovar"
   - **Dados do Contato**: 
     - **Nome Completo**: Bruno Tovar (editavel)
     - Telefone: 5527...
     - Email: ...
     - (campos personalizados do contato)

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/inbox/lead-panel/ContactFieldsSection.tsx` | Adicionar campo Nome Completo editavel no inicio da lista |
| `src/components/inbox/lead-panel/LeadFieldsSection.tsx` | (Opcional) Adicionar campo Titulo do Lead editavel |

## Impacto

- O nome do contato sera visivel e editavel na secao "Dados do Contato"
- Segue o mesmo padrao visual dos outros campos
- Nao afeta a funcionalidade existente do header

