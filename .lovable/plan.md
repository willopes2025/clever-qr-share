## Diagnóstico

O sistema usa larguras **fixas** em pixels nos painéis principais, sem breakpoints intermediários. No seu monitor (~1126px de largura útil), a soma é:

```
Sidebar global (256)  +  Lista de conversas (320)  +  Painel do lead (384)  =  960px fixos
                                                                Sobra: ~166px para o CHAT
```

Por isso as mensagens aparecem espremidas no centro, exatamente como mostra o seu print. O problema se repete em outras telas (Funis, Calendário, CRM) porque o `DashboardSidebar` também é fixo em `w-64` e nenhuma página tem breakpoint para telas entre 1024–1440px.

### Pontos identificados
- `src/pages/Inbox.tsx`: lista `w-80` e painel `w-96` hardcoded; sem auto‑colapso em telas médias.
- `src/components/DashboardSidebar.tsx`: largura `w-64` / `w-16` sem considerar viewport.
- Falta um breakpoint intermediário (`lg`/`xl`) – tudo trata só `mobile` vs `desktop`.
- Outras páginas com grids (`Dashboard`, `Funis`, `Campaigns`) usam colunas fixas sem `xl:`/`2xl:` adicionais.

---

## Plano de melhoria

### 1. Inbox responsivo de verdade (prioridade alta)
- Tornar a lista de conversas e o painel do lead **proporcionais e adaptáveis**:
  - Telas `<1280px`: lista 280px, painel do lead **colapsado por padrão** (abre como overlay/sheet sobre o chat).
  - Telas `1280–1536px`: lista 300px, painel 340px.
  - Telas `≥1536px`: lista 320px, painel 384px (atual).
- Detectar largura via hook novo `useBreakpoint()` (md/lg/xl/2xl) e auto‑colapsar painel direito quando não couber.
- Painel do lead vira **overlay flutuante** em telas médias (igual mobile usa Sheet), mantendo o chat sempre com largura mínima de ~520px.

### 2. Sidebar global adaptativa
- `DashboardSidebar`: auto‑colapsar para `w-16` (ícones) quando viewport `<1280px`, mantendo possibilidade do usuário expandir manualmente.
- Persistir a preferência manual (já existe em `SidebarContext`), mas usar o auto‑colapso como **default inteligente** baseado no tamanho.

### 3. Header da Inbox enxuto em telas médias
No print, o header do chat tem "Marcar como lida", seletor de responsável, "Acionar IA", chip do lead — tudo competindo por espaço. Vamos:
- Esconder rótulos de texto em `<1280px` (manter só ícones com tooltip).
- Agrupar ações secundárias em menu "…" quando a largura disponível for insuficiente.

### 4. Grids genéricas com mais breakpoints
- Adicionar `xl:` e `2xl:` nos grids de Dashboard/Funnels/Campaigns para aproveitar telas grandes e evitar quebras feias em telas médias.
- Padronizar containers com `min-w-0` onde estiver faltando (evita overflow horizontal).

### 5. Painel direito do lead
- Adicionar barra de **resize** (drag) entre chat e painel do lead, com largura mínima/máxima e persistência por usuário em `localStorage`.

### 6. Verificação
- Testar em viewports: 1024, 1280, 1366, 1440, 1536, 1920 via preview do navegador.
- Validar especificamente a tela do print (1126px) — chat deve ficar com ≥520px.

---

## Detalhes técnicos

- Novo hook `src/hooks/useBreakpoint.ts` baseado em `matchMedia` (md=768, lg=1024, xl=1280, 2xl=1536).
- `src/pages/Inbox.tsx`: substituir `w-80`/`w-96` por classes condicionais ao breakpoint; auto‑colapsar painel direito ao detectar `xl` ou menos.
- `src/components/DashboardSidebar.tsx`: aplicar auto‑colapso inicial ouvindo o mesmo hook.
- `src/components/inbox/MessageView.tsx` (header): tornar labels `hidden xl:inline`.
- Componente novo `src/components/inbox/ResizeHandle.tsx` para o drag entre chat e painel.

Sem mudanças de back‑end nem de regras de negócio — apenas frontend e layout.
