

## Destaque Visual da Etapa no Card do Lead

### Problema
O badge da etapa atual (ex: "Faturado") usa cor de fundo com apenas 20% de opacidade (`${color}20`), ficando muito sutil e fácil de ignorar.

### Opções de Destaque

**Opção A — Fundo sólido com texto branco**
O badge usa a cor da etapa como fundo sólido (100%) com texto branco. Máximo contraste e visibilidade imediata.

```text
┌──────────────────────────────────┐
│ Programa Seven - [ Faturado ]   │  ← fundo laranja sólido, texto branco
│ ⏱ Na etapa há 7 dias            │
└──────────────────────────────────┘
```

**Opção B — Fundo forte (60%) com texto na cor da etapa**
Aumenta a opacidade do fundo para 60% e usa borda mais marcada. Mantém o estilo atual mas bem mais visível.

```text
┌──────────────────────────────────┐
│ Programa Seven - [ Faturado ]   │  ← fundo laranja 60%, texto laranja escuro
│ ⏱ Na etapa há 7 dias            │
└──────────────────────────────────┘
```

**Opção C — Fundo sólido + indicador de tempo com cor de urgência**
Fundo sólido como Opção A, e o texto "Na etapa há X dias" ganha cor amarela/vermelha conforme o tempo aumenta (>3 dias amarelo, >7 dias vermelho), criando senso de urgência.

### Alteração Técnica
Arquivo: `src/components/inbox/lead-panel/LeadPanelFunnelBar.tsx` (linhas 83-93)

- Opção A: `backgroundColor: currentStage?.color`, `color: '#fff'`
- Opção B: `backgroundColor: ${color}99`, `color: currentStage?.color`
- Opção C: Opção A + lógica de cor dinâmica no texto de tempo

Mesma alteração será replicada em `src/components/inbox/FunnelDealSection.tsx` para consistência.

