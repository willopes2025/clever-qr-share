

# Correções na Geração de Cobrança PIX (Asaas)

## Problemas Identificados

1. **Telefone com DDI**: O código envia o telefone com o código do país (55). O Asaas aceita apenas DDD + número (ex: `27999315235`, não `5527999315235`).
2. **Valor não resolvido**: Se o campo personalizado retorna array (campos tipo select), o `parseFloat` falha.
3. **Data de vencimento ausente**: O campo de data pode estar em formato brasileiro (`dd/mm/yyyy`) ou ISO, e o parsing não trata ambos.

## Correções no Edge Function

**Arquivo**: `supabase/functions/process-funnel-automations/index.ts`

### 1. Telefone -- remover DDI antes de enviar ao Asaas
Na linha 1748-1769, após limpar o telefone, remover o prefixo `55` se presente:
```typescript
let cleanPhone = contactPhone.replace(/\D/g, '');
// Asaas aceita apenas DDD + número (sem DDI 55)
if (cleanPhone.startsWith('55') && cleanPhone.length > 11) {
  cleanPhone = cleanPhone.slice(2);
}
```

### 2. Valor -- tratar arrays e strings formatadas
Na linha 1648, melhorar o parsing do valor:
```typescript
let rawValue = dealCustomFields[valueField];
if (Array.isArray(rawValue)) rawValue = rawValue[0];
// Remove formatação BR (ex: "1.250,00" → "1250.00")
const chargeValue = parseFloat(
  String(rawValue || '0').replace(/\./g, '').replace(',', '.')
);
```

### 3. Data de vencimento -- tratar formato BR
Na linha 1677-1678, detectar e converter formato brasileiro:
```typescript
if (!dueDate) {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  dueDate = d.toISOString().split('T')[0];
} else {
  const dueDateStr = String(dueDate);
  // Detectar formato dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dueDateStr)) {
    const [dd, mm, yyyy] = dueDateStr.split('/');
    dueDate = `${yyyy}-${mm}-${dd}`;
  } else {
    dueDate = new Date(dueDateStr).toISOString().split('T')[0];
  }
}
```

### 4. Deploy e re-teste
- Redeployar o edge function `process-funnel-automations`
- Executar novamente a automação para a Tatiana para validar que valor, telefone e data são enviados corretamente

## Resultado Esperado
- Telefone enviado como `27999XXXXXX` (sem DDI)
- Valor da cobrança preenchido corretamente (ex: R$ 250,00)
- Data de vencimento no formato `YYYY-MM-DD` aceito pelo Asaas

