

# Adicionar aba "WhatsApp Business" nas Configuracoes

## Problema

O componente `MetaWhatsAppSettings` (que contem o fluxo de Embedded Signup da Meta) existe no codigo, mas nao esta adicionado como uma aba na pagina de Configuracoes. Somente a aba "WhatsApp" (Evolution API) aparece.

## Solucao

Adicionar uma nova aba "WhatsApp Business" no array `allTabs` em `src/pages/Settings.tsx`, apontando para o componente `MetaWhatsAppSettings`.

## Detalhes Tecnicos

### Arquivo: `src/pages/Settings.tsx`

1. Importar o componente `MetaWhatsAppSettings`
2. Importar o icone `MessageSquare` do lucide-react
3. Adicionar entrada no array `allTabs` logo apos a aba "WhatsApp":

```typescript
{
  value: "whatsapp-business",
  label: "WhatsApp Business",
  icon: MessageSquare,
  permission: "manage_settings",
  adminOnly: true,
  component: MetaWhatsAppSettings
}
```

Isso adicionara a aba com permissao restrita a administradores (mesma logica das outras abas sensiveis como Integracoes e API).

