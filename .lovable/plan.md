## Objetivo

No painel direito da Inbox, o código exibido abaixo do nome do contato (no header) hoje cai em "código do contato" como fallback quando não há lead no funil. Vamos separar:

- **Topo do card (LeadPanelHeader):** mostrar apenas o código do lead (`#<leadNumber>`) e o título do deal, somente quando existir um lead no funil. Sem fallback para o código do contato.
- **Seção "Dados do Contato" (ContactFieldsSection):** sempre mostrar o código do contato (`#<contact_display_id>`) como uma linha de campo no topo da lista, com botão de copiar.

## Mudanças

### 1. `src/components/inbox/lead-panel/LeadPanelHeader.tsx`
- Remover o bloco de fallback que renderiza `<ContactIdBadge displayId={contactDisplayId} />` quando não há `dealTitle`/`leadNumber`.
- Manter apenas a linha `#<leadNumber>` + `dealTitle` quando existirem.
- Remover import não usado de `ContactIdBadge` e da variável `contactDisplayId`.

### 2. `src/components/inbox/lead-panel/ContactFieldsSection.tsx`
- Adicionar nova prop opcional `contactDisplayId?: string | null`.
- Logo após o header "Dados do Contato" (antes do campo "Nome Completo"), adicionar uma linha:
  - Label: `ID do Contato`
  - Valor: `<ContactIdBadge displayId={contactDisplayId} size="sm" />` (com botão de copiar já incluso no componente).
- Renderizar a linha apenas quando `contactDisplayId` existir.

### 3. `src/components/inbox/RightSidePanel.tsx`
- Passar `contactDisplayId={(conversation.contact as any)?.contact_display_id}` para `<ContactFieldsSection />`.

## Fora de escopo

- Não mexer em lógica de dados, queries, ou outros painéis (kanban, lista de leads).
- Não alterar estilo geral do header além da remoção do fallback.
