

# Modo Embed Limpo para Formulários

## Problema Identificado

O formulário embutido via iframe está aparecendo com elementos visuais extras (background cinza, card branco com sombra, padding excessivo) que conflitam com o design do site onde está sendo incorporado.

### Resultado Atual
- Background colorido no body
- Container com box-shadow e border-radius
- Padding de 2.5rem no container
- Centralização com flexbox que ocupa 100vh

### Resultado Desejado
- Background transparente
- Sem sombras ou bordas arredondadas
- Apenas os campos do formulário e o botão de enviar
- Formulário adapta-se ao container do site

---

## Solução

Adicionar parâmetro `?embed=true` na URL do formulário que ativa um modo de renderização limpo, ideal para iframes.

### Modo Embed vs Modo Normal

| Aspecto | Modo Normal | Modo Embed |
|---------|-------------|------------|
| Background body | Colorido | Transparente |
| Container | Card com sombra | Sem container visual |
| Padding | 2.5rem | Mínimo (1rem) |
| Altura mínima | 100vh | auto |
| Logo/Header | Exibe | Oculta |
| Resultado | Página completa | Apenas campos |

---

## Alterações Necessárias

### 1. Edge Function `public-form` 

Modificar para aceitar o parâmetro `embed` e gerar estilos diferentes:

```typescript
// Detectar modo embed
const embed = url.searchParams.get('embed') === 'true';

// Estilos condicionais
body {
  background: ${embed ? 'transparent' : 'var(--bg-color)'};
  min-height: ${embed ? 'auto' : '100vh'};
  padding: ${embed ? '0' : '2rem'};
  display: ${embed ? 'block' : 'flex'};
}

.form-container {
  background: ${embed ? 'transparent' : 'white'};
  box-shadow: ${embed ? 'none' : '0 4px 24px rgba(0,0,0,0.1)'};
  border-radius: ${embed ? '0' : '16px'};
  padding: ${embed ? '0' : '2.5rem'};
}
```

### 2. FormCard.tsx

Atualizar o código embed para incluir `?embed=true`:

```typescript
const embedUrl = `${window.location.origin}/f/${form.slug}?embed=true`;
const embedCode = `<iframe src="${embedUrl}" ...></iframe>`;
```

### 3. PublicFormPage.tsx

Passar o parâmetro `embed` da query string para a Edge Function:

```typescript
const searchParams = new URLSearchParams(location.search);
const embedMode = searchParams.get('embed');

if (embedMode === 'true') {
  params.set('embed', 'true');
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/public-form/index.ts` | Adicionar suporte ao parâmetro `embed` e estilos condicionais |
| `src/components/forms/FormCard.tsx` | URL do embed com `?embed=true` |
| `src/pages/PublicFormPage.tsx` | Passar parâmetro `embed` para a Edge Function |

---

## Resultado Esperado

Após a correção:
1. O código embed copiado incluirá `?embed=true` na URL
2. O formulário renderizará apenas os campos, sem elementos visuais extras
3. O formulário se adaptará ao design do site onde for incorporado
4. O modo normal (sem `?embed=true`) continuará funcionando para visualização direta

