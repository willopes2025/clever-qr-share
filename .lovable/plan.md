
# Plano: Adicionar Estatísticas Detalhadas no Card de Campanha

## Resumo

Melhorar o card de campanha para exibir estatísticas completas: **enviados**, **falhas**, **total** e **duplicados** (contatos que foram pulados por já terem recebido o template).

---

## Situação Atual

O card atualmente exibe:
- Progresso em porcentagem
- `X de Y enviados`
- ✓ Entregues (verde)
- ✗ Falhas (vermelho)

**Problema identificado:** Os contatos duplicados são filtrados **antes** de criar registros na fila, então não há como rastrear quantos foram pulados.

---

## Mudanças Necessárias

### 1. Banco de Dados

Adicionar campo `skipped` na tabela `campaigns`:

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `skipped` | `integer` | Contagem de contatos ignorados por duplicidade |

### 2. Backend (Edge Function)

**Arquivo:** `supabase/functions/start-campaign/index.ts`

- Atualizar o campo `skipped` na campanha após filtrar duplicados
- O valor será: `totalContacts - filteredContacts.length`

### 3. Frontend - Hook

**Arquivo:** `src/hooks/useCampaigns.ts`

Adicionar `skipped` na interface `Campaign`:

```typescript
export interface Campaign {
  // ... campos existentes
  skipped: number; // NOVO
}
```

### 4. Frontend - Card

**Arquivo:** `src/components/campaigns/CampaignCard.tsx`

Atualizar a exibição de estatísticas:

```text
+----------------------------------------+
| Progresso                          85% |
| ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░                 |
|                                        |
| 85 de 100 enviados                     |
|                                        |
| ✓ 80 Entregues   ✗ 5 Falhas           |
| ⊘ 15 Duplicados  📊 100 Total          |
+----------------------------------------+
```

Ou em formato de grid mais limpo:

```text
+----------------------------------------+
| Progresso                          85% |
| ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░                 |
|----------------------------------------|
|  📤 85        | ✓ 80       | ✗ 5      |
|  Enviados     | Entregues  | Falhas   |
|----------------------------------------|
|  ⊘ 15         | 📊 100                 |
|  Duplicados   | Total                  |
+----------------------------------------+
```

---

## Detalhes Técnicos

### Modificação no start-campaign

```typescript
// Após filtrar duplicados
const skippedCount = originalCount - filteredContacts.length;

// Atualizar campanha com contagem de pulados
await supabase
  .from('campaigns')
  .update({ 
    skipped: skippedCount,
    total_contacts: originalCount // manter total original
  })
  .eq('id', campaignId);
```

### Modificação no CampaignCard.tsx

```typescript
<div className="grid grid-cols-4 gap-2 text-xs">
  <div className="flex items-center gap-1">
    <Send className="h-3 w-3 text-blue-500" />
    <span>{campaign.sent} Enviados</span>
  </div>
  <div className="flex items-center gap-1 text-green-600">
    <CheckCircle2 className="h-3 w-3" />
    <span>{campaign.delivered}</span>
  </div>
  <div className="flex items-center gap-1 text-red-600">
    <XCircle className="h-3 w-3" />
    <span>{campaign.failed}</span>
  </div>
  <div className="flex items-center gap-1 text-muted-foreground">
    <Ban className="h-3 w-3" />
    <span>{campaign.skipped || 0} Dup.</span>
  </div>
</div>
```

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| Migração SQL | Adicionar coluna `skipped` |
| `supabase/functions/start-campaign/index.ts` | Salvar contagem de skipped |
| `src/hooks/useCampaigns.ts` | Adicionar campo na interface |
| `src/components/campaigns/CampaignCard.tsx` | Exibir novas estatísticas |

---

## Resultado Visual Esperado

O card passará a mostrar:
- **Enviados:** Quantidade de mensagens enviadas
- **Entregues:** Confirmados como entregues (verde)
- **Falhas:** Que falharam no envio (vermelho)
- **Duplicados:** Contatos pulados por já terem recebido (cinza)
- **Total:** Total original de contatos na lista

Isso dará visibilidade completa sobre o desempenho do disparo.
