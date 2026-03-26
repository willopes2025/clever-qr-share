

## Mostrar nome do lead no lugar do LID

### Problema
Abaixo do nome do contato no header do painel lateral, está exibindo o `contact_display_id` (ex: `LID_234483773124750`). O usuário quer mostrar o **título do lead (deal)** no lugar.

### Solução

**1. `RightSidePanel.tsx`** — passar o título do deal ativo para o `LeadPanelHeader`:
- Adicionar prop `dealTitle={activeDeal?.title}` ao componente `LeadPanelHeader`

**2. `LeadPanelHeader.tsx`** — substituir o `ContactIdBadge` pelo título do deal:
- Adicionar prop `dealTitle?: string | null` na interface
- Onde hoje exibe `<ContactIdBadge displayId={contactDisplayId} />`, exibir o `dealTitle` em texto (estilo discreto, `text-xs text-muted-foreground`) quando disponível
- Se não houver deal, manter o `ContactIdBadge` como fallback

### Resultado
O header do painel mostrará o título do lead (deal) ativo do contato. Se não houver deal, continua exibindo o ID do contato como hoje.

