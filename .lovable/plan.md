
# Correção: Botão "Editar em Massa" Desabilitado Incorretamente

## Problema Identificado

O botão de edição em massa no Funil (List View) está **desabilitado** quando não existem campos personalizados cadastrados, mesmo que a funcionalidade de edição em massa permita alterar outros campos como valor, etapa, responsável e data de previsão.

### Código Problemático (Linha 670-678)

```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => setBulkEditDialogOpen(true)}
  disabled={!fieldDefinitions?.length}  // ← Bloqueia o botão desnecessariamente
>
  <Edit className="h-4 w-4 mr-2" />
  Editar Campo  // ← Texto desatualizado
</Button>
```

### Por Que Isso Está Errado

O `BulkEditDialog` agora permite editar:
- Valor
- Etapa
- Responsável
- Data de Previsão
- Campo Personalizado (opcional)

A condição `disabled={!fieldDefinitions?.length}` era válida para o antigo dialog que só editava campos personalizados, mas agora é incorreta para o novo dialog mais completo.

## Solução

1. **Remover** a condição `disabled` do botão
2. **Atualizar** o texto do botão de "Editar Campo" para "Editar em Massa"

## Arquivo a Modificar

| Arquivo | Linha | Alteração |
|---------|-------|-----------|
| `src/components/funnels/FunnelListView.tsx` | 670-678 | Remover `disabled` e atualizar texto |

## Alteração

De:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setBulkEditDialogOpen(true)}
  disabled={!fieldDefinitions?.length}
>
  <Edit className="h-4 w-4 mr-2" />
  Editar Campo
</Button>
```

Para:
```tsx
<Button
  variant="outline"
  size="sm"
  onClick={() => setBulkEditDialogOpen(true)}
>
  <Edit className="h-4 w-4 mr-2" />
  Editar em Massa
</Button>
```

## Resultado Esperado

Após a correção:
- O botão "Editar em Massa" aparecerá **sempre** que houver leads selecionados
- Usuários poderão editar valor, etapa, responsável e data de previsão mesmo sem campos personalizados
- O texto do botão refletirá melhor a funcionalidade expandida
