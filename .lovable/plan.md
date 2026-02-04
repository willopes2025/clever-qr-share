
# Plano: Aplicar MobileAppLayout em Todas as Paginas e Limpar Duplicatas

## Situacao Atual

### Paginas que precisam migrar para MobileAppLayout

| Pagina | Layout Atual | Status |
|--------|--------------|--------|
| Dashboard | MobileAppLayout | Ja migrado |
| Inbox | DashboardLayout (com logica mobile interna) | Precisa migrar |
| Contacts | DashboardLayout | Precisa migrar |
| Funnels | DashboardLayout | Precisa migrar |
| Campaigns | DashboardLayout | Precisa migrar |
| Settings | DashboardLayout | Precisa migrar |
| AIAgents | DashboardLayout | Precisa migrar |
| Instances | DashboardLayout | Precisa migrar |
| Templates | DashboardLayout | Precisa migrar |
| Calendar | DashboardLayout | Precisa migrar |
| E outras... | DashboardLayout | Precisa migrar |

### Componentes Duplicados a Limpar

| Componente Desktop (remover) | Componente Mobile (manter) |
|------------------------------|----------------------------|
| `src/components/MobileHeader.tsx` | `src/mobile/components/MobileHeader.tsx` |
| `src/components/MobileBottomNav.tsx` | `src/mobile/components/MobileBottomNav.tsx` |

### Problema no DashboardLayout

O `DashboardLayout.tsx` atual renderiza componentes mobile condicionalmente:

```typescript
{isMobile && (
  <>
    <MobileHeader />
    <MobileSidebarDrawer />
    <MobileBottomNav />
  </>
)}
```

Isso conflita com o `MobileAppLayout` que deve gerenciar esses componentes.

## Estrategia de Migracao

### Abordagem 1: AppLayout como Router (Recomendada)

Usar o `AppLayout.tsx` ja criado como wrapper padrao que decide automaticamente:

```typescript
// Em cada pagina:
import { AppLayout } from "@/layouts/AppLayout";

// Ao inves de:
<DashboardLayout>...</DashboardLayout>

// Usar:
<AppLayout pageTitle="Contatos">...</AppLayout>
```

O `AppLayout` ja encaminha para `MobileAppLayout` ou `DashboardLayout` automaticamente.

### Abordagem 2: Paginas Mobile Dedicadas (Para UX otimizada)

Para paginas complexas como Inbox (que ja tem logica mobile propria), manter a logica interna mas usar o MobileAppLayout.

## Arquivos a Modificar

### 1. Limpar DashboardLayout

Remover renderizacao condicional de componentes mobile:

```typescript
// ANTES (DashboardLayout.tsx)
{isMobile && (
  <>
    <MobileHeader />
    <MobileSidebarDrawer />
    <MobileBottomNav />
  </>
)}

// DEPOIS
// Remover completamente - MobileAppLayout gerencia isso
```

### 2. Atualizar DashboardLayout imports

Remover imports dos componentes mobile duplicados:

```typescript
// REMOVER:
import { MobileHeader } from "@/components/MobileHeader";
import { MobileBottomNav } from "@/components/MobileBottomNav";
```

### 3. Migrar Paginas Principais

| Arquivo | Alteracao |
|---------|-----------|
| `src/pages/Contacts.tsx` | Usar AppLayout |
| `src/pages/Funnels.tsx` | Usar AppLayout |
| `src/pages/Campaigns.tsx` | Usar AppLayout |
| `src/pages/Settings.tsx` | Usar AppLayout |
| `src/pages/AIAgents.tsx` | Usar AppLayout |
| `src/pages/Instances.tsx` | Usar AppLayout |
| `src/pages/Templates.tsx` | Usar AppLayout |
| `src/pages/Calendar.tsx` | Usar AppLayout |
| `src/pages/Inbox.tsx` | Tratamento especial (ja tem logica mobile) |
| E outras paginas... | Usar AppLayout |

### 4. Deletar Componentes Duplicados

| Arquivo a Deletar | Motivo |
|-------------------|--------|
| `src/components/MobileHeader.tsx` | Duplicado de `src/mobile/components/MobileHeader.tsx` |
| `src/components/MobileBottomNav.tsx` | Duplicado de `src/mobile/components/MobileBottomNav.tsx` |

### 5. Tratamento Especial: Inbox

O Inbox ja tem logica mobile propria sofisticada. Opcoes:
- Opcao A: Manter logica atual mas envolver com MobileAppLayout (sem header/bottomnav duplicados)
- Opcao B: Usar DashboardLayout no desktop e MobileAppLayout com conteudo proprio no mobile

Recomendacao: Opcao B - parecido com Dashboard

```typescript
// Inbox.tsx
if (isMobile) {
  return (
    <MobileAppLayout pageTitle="Inbox">
      {/* Conteudo mobile existente, sem header proprio */}
    </MobileAppLayout>
  );
}
return (
  <DashboardLayout>
    {/* Conteudo desktop existente */}
  </DashboardLayout>
);
```

## Detalhes Tecnicos

### Padrao de Migracao para Paginas Simples

```typescript
// ANTES
import { DashboardLayout } from "@/components/DashboardLayout";

const MinhaPage = () => {
  return (
    <DashboardLayout className="p-8">
      {/* conteudo */}
    </DashboardLayout>
  );
};

// DEPOIS
import { AppLayout } from "@/layouts/AppLayout";

const MinhaPage = () => {
  return (
    <AppLayout pageTitle="Minha Page" className="p-8">
      {/* conteudo - ajustar padding para mobile */}
    </AppLayout>
  );
};
```

### Ajustes de Padding Mobile

O MobileAppLayout ja adiciona `pt-14 pb-20` para header e bottom nav.
Paginas precisam usar padding condicional:

```typescript
<AppLayout pageTitle="Contatos">
  <div className="p-4 md:p-8">
    {/* conteudo */}
  </div>
</AppLayout>
```

### Atualizar AppLayout para suportar className

```typescript
// AppLayout.tsx
export const AppLayout = ({ children, className, pageTitle }: AppLayoutProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <MobileAppLayout pageTitle={pageTitle}>
        <div className={className}>{children}</div>
      </MobileAppLayout>
    );
  }

  return (
    <DashboardLayout className={className}>
      {children}
    </DashboardLayout>
  );
};
```

## Ordem de Execucao

```text
1. Atualizar AppLayout para suportar className
2. Limpar DashboardLayout (remover componentes mobile)
3. Deletar arquivos duplicados
4. Migrar paginas principais (Contacts, Funnels, etc.)
5. Tratamento especial para Inbox
6. Testar navegacao mobile
```

## Lista Completa de Paginas a Migrar

Baseado em `src/pages/`:

| Pagina | Prioridade | Complexidade |
|--------|------------|--------------|
| Contacts | Alta | Media (tabela grande) |
| Funnels | Alta | Media (kanban) |
| Inbox | Alta | Ja tem mobile |
| Campaigns | Alta | Baixa |
| Settings | Alta | Baixa |
| AIAgents | Media | Baixa |
| Instances | Media | Media |
| Templates | Media | Baixa |
| Calendar | Media | Media |
| Analysis | Baixa | Baixa |
| BroadcastLists | Baixa | Baixa |
| Chatbots | Baixa | Baixa |
| Forms | Baixa | Baixa |
| LeadSearch | Baixa | Baixa |
| Warming | Baixa | Baixa |

Paginas publicas (Login, PrivacyPolicy, etc.) nao precisam de AppLayout.

## Resultado Esperado

- Experiencia mobile consistente em todas as paginas
- Header e bottom nav unificados
- Sem componentes duplicados
- Transicoes suaves entre paginas
- Codigo mais limpo e manutencao mais facil
