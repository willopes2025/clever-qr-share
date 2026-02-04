
# Plano: Interface Mobile Exclusiva (App Mode)

## Analise da Situacao Atual

O projeto ja possui uma base solida para mobile:

| Componente | Status |
|------------|--------|
| `useIsMobile` hook | Existe e detecta < 768px |
| `MobileHeader` | Existe com logo, notificacoes e usuario |
| `MobileBottomNav` | Existe com 4 itens (Dashboard, Inbox, Contatos, Mais) |
| `MobileSidebarDrawer` | Existe como menu lateral completo |
| `DashboardLayout` | Ja diferencia mobile/desktop |
| PWA | Recem configurado |

**Problema atual**: As paginas (Dashboard, Contacts, Funnels, etc.) nao estao otimizadas para mobile - usam os mesmos componentes desktop com responsividade basica.

## Arquitetura Proposta

```text
src/
  layouts/
    AppLayout.tsx          # Nova: Decide mobile vs desktop
  mobile/
    layouts/
      MobileAppLayout.tsx  # Shell mobile com bottom nav + header
    pages/
      MobileHome.tsx       # Dashboard simplificado
      MobileInbox.tsx      # Ja otimizado (reutilizar)
      MobileContacts.tsx   # Lista simplificada
      MobileFunnels.tsx    # Kanban touch-friendly
      MobileSettings.tsx   # Configuracoes simplificadas
    components/
      MobileCard.tsx       # Cards touch-friendly
      MobileList.tsx       # Listas com swipe
      MobileSearchBar.tsx  # Busca fixa no topo
  components/
    (manter existentes como desktop)
```

## Etapas de Implementacao

### Etapa 1: AppLayout Router (Decisor Mobile/Desktop)

Criar `src/layouts/AppLayout.tsx`:

```typescript
const AppLayout = ({ children }) => {
  const isMobile = useIsMobile();
  
  // Mobile: usa shell mobile dedicado
  // Desktop: usa DashboardLayout existente
  return isMobile ? (
    <MobileAppLayout>{children}</MobileAppLayout>
  ) : (
    <DashboardLayout>{children}</DashboardLayout>
  );
};
```

### Etapa 2: MobileAppLayout (Shell Mobile)

Criar layout mobile otimizado com:
- Header compacto fixo (56px)
- Area de conteudo com scroll nativo
- Bottom navigation fixa (64px) com safe-area-inset
- Gestos de navegacao (swipe back)
- Transicoes suaves entre telas

```typescript
// MobileAppLayout.tsx
<div className="h-screen flex flex-col bg-background">
  <MobileHeader />
  <main className="flex-1 overflow-y-auto overscroll-contain">
    {children}
  </main>
  <MobileBottomNav />
</div>
```

### Etapa 3: Paginas Mobile Dedicadas

#### MobileHome (Dashboard Simplificado)

```typescript
// Foco em metricas chave + acoes rapidas
<div className="p-4 space-y-4">
  <QuickStats /> {/* 4 cards: Leads, Conversas, Campanhas, Vendas */}
  <QuickActions /> {/* Botoes grandes: Nova Conversa, Novo Lead */}
  <RecentActivity /> {/* Ultimas 5 atividades */}
</div>
```

#### MobileContacts (Lista Otimizada)

```typescript
// Lista vertical com busca fixa e swipe actions
<div className="flex flex-col h-full">
  <MobileSearchBar />
  <ScrollArea className="flex-1">
    <MobileContactList onSwipeLeft={handleOptOut} onSwipeRight={handleCall} />
  </ScrollArea>
  <FloatingActionButton onClick={addContact} />
</div>
```

#### MobileFunnels (Kanban Touch)

```typescript
// Tabs horizontais por etapa + lista vertical de deals
<div className="flex flex-col h-full">
  <FunnelSelector />
  <StageTabs stages={stages} />
  <DealsList stage={selectedStage} />
</div>
```

### Etapa 4: Componentes Mobile Especificos

| Componente | Descricao |
|------------|-----------|
| `MobileCard` | Padding maior (16px), sombras sutis, rounded-2xl |
| `MobileList` | Items com altura minima 64px, dividers |
| `MobileSearchBar` | Sticky no topo, full-width |
| `FloatingActionButton` | Botao flutuante para acao principal |
| `SwipeableRow` | Linha com acoes ao deslizar |
| `PullToRefresh` | Pull-to-refresh nativo |

### Etapa 5: Melhorias UX Nativo

```css
/* index.css - Adicoes mobile */
@media (max-width: 767px) {
  /* Prevenir zoom em inputs */
  input, select, textarea {
    font-size: 16px !important;
  }
  
  /* Scroll momentum iOS */
  .mobile-scroll {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  
  /* Prevenir highlight de tap */
  button, a {
    -webkit-tap-highlight-color: transparent;
  }
  
  /* Safe areas para notch/home bar */
  .safe-area-bottom {
    padding-bottom: env(safe-area-inset-bottom);
  }
}
```

### Etapa 6: Animacoes com Framer Motion

```typescript
// Transicoes entre paginas
const pageVariants = {
  initial: { opacity: 0, x: 20 },
  in: { opacity: 1, x: 0 },
  out: { opacity: 0, x: -20 }
};

// Fade suave para cards
const cardVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};
```

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/layouts/AppLayout.tsx` | Router mobile/desktop |
| `src/mobile/layouts/MobileAppLayout.tsx` | Shell mobile |
| `src/mobile/pages/MobileHome.tsx` | Dashboard mobile |
| `src/mobile/pages/MobileContacts.tsx` | Contatos mobile |
| `src/mobile/pages/MobileFunnels.tsx` | Funis mobile |
| `src/mobile/components/MobileCard.tsx` | Card otimizado |
| `src/mobile/components/MobileList.tsx` | Lista otimizada |
| `src/mobile/components/FloatingActionButton.tsx` | FAB |
| `src/mobile/components/SwipeableRow.tsx` | Linha com swipe |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Dashboard.tsx` | Usar AppLayout ao inves de DashboardLayout |
| `src/pages/Contacts.tsx` | Usar AppLayout e renderizar MobileContacts |
| `src/pages/Funnels.tsx` | Usar AppLayout e renderizar MobileFunnels |
| `src/components/MobileBottomNav.tsx` | Adicionar animacoes e feedback haptico |
| `src/components/MobileHeader.tsx` | Adicionar titulo da pagina dinamico |
| `src/index.css` | Adicionar estilos mobile-first |

## Prioridade de Implementacao

```text
1. AppLayout + MobileAppLayout (base)
2. MobileHome (dashboard simplificado)
3. Melhorias MobileBottomNav/Header
4. MobileContacts (lista otimizada)
5. MobileFunnels (kanban touch)
6. Componentes reutilizaveis (Card, List, FAB)
7. Animacoes e transicoes
```

## Resultado Esperado

**Visual**: App que parece nativo, sem elementos de "site"

**Performance**:
- Navegacao instantanea (60fps)
- Scroll suave com momentum
- Gestos responsivos

**UX**:
- Menos informacao, mais foco
- Acoes principais acessiveis com polegar
- Feedback visual e haptico

**Tecnico**:
- Mesmo backend/API
- Code splitting por plataforma
- Bundle mobile menor
