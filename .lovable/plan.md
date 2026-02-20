
# Corrigir preview de links do formulario no WhatsApp (OG Tags)

## Problema Atual

As meta tags Open Graph (que geram a preview do link no WhatsApp) so sao adicionadas ao HTML quando o campo `og_image_url` esta preenchido. Alem disso, faltam as tags `og:description`, `og:url` e `og:type`, que sao essenciais para a preview completa.

## Como Funciona Hoje

No arquivo `supabase/functions/public-form/index.ts` (linhas 200-203):

```
${form.og_image_url ? `
  <meta property="og:image" content="...">
  <meta property="og:title" content="...">
` : ''}
```

Isso significa que se voce nao colocar uma imagem, nenhuma tag OG e gerada — e o WhatsApp nao mostra preview nenhuma.

## Solucao

Alterar a Edge Function `public-form` para **sempre** gerar as tags OG essenciais, independente de ter imagem ou nao:

```
<meta property="og:type" content="website">
<meta property="og:title" content="[Titulo da pagina ou nome do formulario]">
<meta property="og:description" content="[Meta description do formulario]">
<meta property="og:url" content="[URL publica do formulario]">
[se tiver imagem] <meta property="og:image" content="[URL da imagem]">
```

## Como Configurar (Apos a Correcao)

1. Abra o formulario no editor
2. Va na aba **Aparencia**
3. Preencha os campos na secao "SEO e Compartilhamento":
   - **Titulo da Pagina (SEO)** — Texto em negrito que aparece na preview
   - **Descricao (Meta Description)** — Texto descritivo abaixo do titulo
   - **Imagem de Compartilhamento (OG Image)** — URL de uma imagem para a miniatura

## Alteracoes Tecnicas

### Arquivo: `supabase/functions/public-form/index.ts`

Substituir o bloco condicional das meta tags OG (linhas 200-203) por tags que sao sempre renderizadas:

- `og:type` sempre como "website"
- `og:title` sempre presente, usando `page_title` ou `form.name`
- `og:description` sempre presente quando `meta_description` existir
- `og:url` construido a partir do slug do formulario
- `og:image` condicional, apenas quando `og_image_url` estiver preenchido
