
# Plano: Corrigir Problema de Datas do Agente Rodolfo

## Problema Identificado

O agente Rodolfo esta informando datas incorretas aos usuarios. Isso ocorre devido ao manuseio inadequado de datas, especificamente a conversao de UTC para o fuso horario de Brasilia.

## Causa Raiz

O codigo esta usando `new Date().toISOString().split('T')[0]` para obter a data atual, o que retorna a data em UTC. Quando sao 22h em Brasilia (GMT-3), em UTC ja e o dia seguinte (01h). Isso faz com que o agente:

1. Ofereca horarios para o dia errado
2. Diga que uma data "ja esta preenchida" quando na verdade e a data correta no fuso de Brasilia
3. Mostre datas inconsistentes ao usuario

### Locais do Problema

| Arquivo | Linha | Codigo Problematico |
|---------|-------|---------------------|
| `ai-campaign-agent/index.ts` | 167-168 | `new Date().toLocaleDateString('pt-BR')` (sem timezone) |
| `ai-campaign-agent/index.ts` | 283 | `new Date().toISOString().split('T')[0]` |
| `ai-campaign-agent/index.ts` | 1269-1270 | `today.toISOString().split('T')[0]` |
| `ai-campaign-agent/index.ts` | 1351 | `agora.getFullYear()` (pode mudar em virada de ano UTC) |

## Solucao Proposta

Criar uma funcao helper para formatar datas de forma consistente no fuso horario de Brasilia:

```text
Antes (errado):
   new Date().toISOString().split('T')[0]
   
   Exemplo: as 22:00 BRT = retorna data do dia SEGUINTE (UTC)

Depois (correto):
   formatDateBrazil(new Date())
   
   Exemplo: as 22:00 BRT = retorna data CORRETA (BRT)
```

## Arquivos a Modificar

| Arquivo | Alteracoes |
|---------|------------|
| `supabase/functions/ai-campaign-agent/index.ts` | Adicionar helper e corrigir 4 locais |

## Detalhes Tecnicos

### 1. Criar funcao helper para data brasileira

```typescript
// Formata data no fuso horario de Brasilia (YYYY-MM-DD)
const formatDateBrazil = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date); // Retorna YYYY-MM-DD no fuso BRT
};
```

### 2. Corrigir linha 167-168 (replaceVariables)

De:
```typescript
result = result.replace(/\{\{data\}\}/gi, new Date().toLocaleDateString('pt-BR'));
result = result.replace(/\{\{hora\}\}/gi, new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }));
```

Para:
```typescript
const now = new Date();
result = result.replace(/\{\{data\}\}/gi, now.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
result = result.replace(/\{\{hora\}\}/gi, now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }));
```

### 3. Corrigir linha 283 (fetchCalendlyAvailability)

De:
```typescript
date: new Date().toISOString().split('T')[0],
```

Para:
```typescript
date: formatDateBrazil(new Date()),
```

### 4. Corrigir linhas 1269-1270 (pre-fetch slots)

De:
```typescript
const today = new Date();
const startDate = today.toISOString().split('T')[0];
const endDate = new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
```

Para:
```typescript
const today = new Date();
const startDate = formatDateBrazil(today);
const endDate = formatDateBrazil(new Date(today.getTime() + 6 * 24 * 60 * 60 * 1000));
```

### 5. Corrigir linha 1351 (ano atual)

De:
```typescript
const anoAtual = agora.getFullYear();
```

Para:
```typescript
const anoAtual = parseInt(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', year: 'numeric' }).format(agora));
```

## Resultado Esperado

- Datas exibidas correspondem ao fuso horario de Brasilia
- Horarios do Calendly buscados para o dia correto
- Agente nao mais diz que datas "ja estao preenchidas" incorretamente
- Consistencia entre o que o agente diz e o que o usuario espera

## Impacto

| Area | Antes | Depois |
|------|-------|--------|
| Busca de horarios | Podia buscar dia errado as 21h+ | Sempre busca dia correto BRT |
| Variaveis {{data}} | Sem timezone | Com timezone America/Sao_Paulo |
| Ano atual | UTC (errado na virada) | BRT (correto) |
| Slots pre-carregados | Data UTC | Data BRT |
