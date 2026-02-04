

# Plano: Corrigir Sobreposicao do Usuario no Sidebar Mobile

## Problema Identificado

Na segunda imagem, o avatar do usuario esta aparecendo **no meio da lista de navegacao**, sobrepondo os itens "Disparos" e "Chatbots". Isso ocorre devido a um problema de layout no `MobileSidebarDrawer.tsx`.

## Causa Raiz

```typescript
// Linha 175 - ScrollArea com altura fixa
<ScrollArea className="flex-1 h-[calc(100vh-14rem)]">

// Linha 233 - Secao inferior com posicao absoluta
<div className="absolute bottom-0 left-0 right-0 ...">
```

O calculo `100vh - 14rem` (224px) nao reserva espaco suficiente para a secao inferior que ocupa aproximadamente 230px (user card + plan button + logout + paddings).

Resultado: quando ha muitos itens de navegacao, a secao absoluta "sobe" e sobrepoe o conteudo.

## Solucao

Remover o posicionamento absoluto e usar Flexbox para garantir que:
1. A navegacao ocupe o espaco disponivel com scroll
2. A secao inferior fique sempre fixa no fundo, sem sobrepor

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/MobileSidebarDrawer.tsx` | Corrigir layout com Flexbox |

## Alteracao Proposta

### Antes (codigo atual)

```typescript
<ScrollArea className="flex-1 h-[calc(100vh-14rem)]">
  <nav>...</nav>
</ScrollArea>

{/* Bottom section */}
<div className="absolute bottom-0 left-0 right-0 ...">
```

### Depois (correcao)

```typescript
<div className="flex flex-col h-[calc(100vh-3.5rem)]">
  {/* Navigation - scrollable */}
  <ScrollArea className="flex-1 min-h-0">
    <nav>...</nav>
  </ScrollArea>

  {/* Bottom section - fixed at bottom, no absolute */}
  <div className="flex-shrink-0 border-t ...">
```

## Detalhes Tecnicos

1. **Container Flex**: Envolver ScrollArea e secao inferior em um container flex com altura fixa
2. **ScrollArea**: Usar `flex-1 min-h-0` para crescer e permitir scroll interno
3. **Secao Inferior**: Remover `absolute` e usar `flex-shrink-0` para nao encolher

## Resultado Esperado

- Navegacao com scroll correto
- Secao do usuario sempre visivel no fundo
- Nenhuma sobreposicao de elementos
- Layout responsivo independente da quantidade de itens

