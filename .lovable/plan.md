
# Plano: Corrigir Detecção de Mobile no Primeiro Render

## Problema Identificado

O hook `useIsMobile` está causando um "flash" de layout desktop antes de detectar corretamente que o dispositivo é mobile.

### Código Atual com Problema

```typescript
// src/hooks/use-mobile.tsx
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    // ... detecção acontece aqui, APÓS primeiro render
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
  }, []);

  return !!isMobile;  // ❌ undefined vira false = mostra desktop primeiro
}
```

### Fluxo do Problema

```text
1ª Renderização → isMobile = undefined → !!undefined = false → DashboardLayout (desktop) ❌
       ↓
useEffect executa → isMobile = true → Re-render → MobileAppLayout (mobile) ✓
       ↓
Usuário vê "flash" do layout errado
```

## Solução

Inicializar o estado com detecção síncrona baseada na largura da janela, para que o primeiro render já tenha o valor correto.

### Código Corrigido

```typescript
// src/hooks/use-mobile.tsx
import * as React from "react";

const MOBILE_BREAKPOINT = 768;

// Helper para detectar mobile de forma síncrona
const getIsMobile = () => {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
};

export function useIsMobile() {
  // Inicializa com valor correto desde o primeiro render
  const [isMobile, setIsMobile] = React.useState<boolean>(getIsMobile);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
```

### Mudanças Principais

| Antes | Depois |
|-------|--------|
| `useState<boolean \| undefined>(undefined)` | `useState<boolean>(getIsMobile)` |
| Detecção apenas no useEffect | Detecção síncrona no init |
| `return !!isMobile` (converte undefined para false) | `return isMobile` (já é boolean) |

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/use-mobile.tsx` | Inicialização síncrona do estado |

## Fluxo Corrigido

```text
1ª Renderização → getIsMobile() = true (em mobile) → MobileAppLayout ✓
       ↓
useEffect registra listener para mudanças de tamanho
       ↓
Usuário vê layout correto imediatamente
```

## Resultado Esperado

- Interface mobile aparece corretamente desde o primeiro momento
- Sem "flash" do layout desktop
- Transições suaves ao redimensionar janela
- Compatível com SSR (verifica `typeof window`)
