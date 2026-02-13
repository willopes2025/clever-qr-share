

## Adicionar Campo "Distrito" com API do IBGE ao Formulario

### O que sera feito

Criar um novo tipo de campo `district` (Distrito) no form builder que busca distritos da API do IBGE filtrados por UF, seguindo o mesmo padrao ja existente para municipios.

### Fluxo do usuario

1. No builder, o usuario adiciona o campo "Distrito" (categoria Especiais)
2. Nas propriedades do campo, o usuario configura quais UFs filtrar (ou deixa vazio para carregar todas)
3. No formulario publico, o lead ve um campo de busca/select que carrega os distritos via API do IBGE em tempo real

### API do IBGE utilizada

```text
GET https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/distritos?orderBy=nome
```

Retorna um array de objetos com `id` e `nome` de cada distrito da UF.

### Alteracoes

**1. Novo service: `src/services/ibgeDistritos.ts`**
- Seguir o mesmo padrao de `src/services/ibgeMunicipios.ts`
- Funcoes: `fetchDistritosByUf`, `fetchDistritosForMultipleUfs`, `searchDistritosInList`
- Cache em memoria para evitar chamadas repetidas

**2. Novo hook: `src/hooks/useIbgeDistritos.ts`**
- Seguir o padrao de `src/hooks/useIbgeMunicipios.ts`
- Receber array de UFs, retornar lista de distritos e funcao de busca

**3. Atualizar `src/components/forms/builder/FieldPalette.tsx`**
- Adicionar na categoria "Especiais": `{ type: 'district', label: 'Distrito', icon: MapPin, category: 'Especiais' }`

**4. Atualizar `src/components/forms/builder/FieldPreview.tsx`**
- Adicionar case `district` no switch, renderizando um select com placeholder "Selecione o distrito..."

**5. Atualizar `src/components/forms/builder/FieldProperties.tsx`**
- Para campos do tipo `district`, exibir opcao de configurar UFs filtradas (multi-select com os 27 estados)

**6. Atualizar `supabase/functions/public-form/index.ts`**
- Adicionar case `district` na funcao `generateFieldHtml`
- Renderizar um `<select>` com busca que carrega distritos da API do IBGE via JavaScript no lado do cliente
- O HTML gerado incluira um script inline que faz fetch na API do IBGE ao carregar a pagina (usando as UFs configuradas no campo)
- Opcao de busca/filtro no select para facilitar a selecao quando houver muitos distritos

### Detalhes tecnicos

- A API do IBGE e publica e nao requer autenticacao
- Os distritos sao mais granulares que municipios (um municipio pode ter varios distritos)
- O campo armazenara o nome do distrito selecionado como valor da submissao
- As UFs configuradas serao salvas em `field.settings.ufs` (array de strings como `["SP", "RJ"]`)
- No HTML publico, o JavaScript fara fetch direto na API do IBGE (client-side), sem necessidade de edge function intermediaria
