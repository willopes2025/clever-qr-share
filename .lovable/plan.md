

# Plano: Correção do Erro de Parsing no Relatório de Análise

## Problema Identificado

Ao gerar um relatório de análise para o cliente "Mercearia Saudável", a edge function `analyze-conversations` falhou com o erro:

```
Failed to parse content: SyntaxError: Unexpected token 'O', "O relatóri"... is not valid JSON
```

**Causa Raiz:** A Lovable AI (modelo `google/gemini-2.5-flash`) está ignorando o `tool_choice` forçado e retornando **texto livre em português** ao invés do JSON estruturado esperado via function calling.

O log mostra:
- A função encontrou 117 conversas e 1000 mensagens
- A chamada à IA foi feita corretamente
- A resposta veio como texto ("O relatório...") ao invés de um tool_call estruturado

## Análise Técnica

O código atual (linha 420) usa:
```typescript
tool_choice: { type: "function", function: { name: "analyze_conversations" } }
```

Porém o modelo Gemini pode não respeitar esse formato consistentemente, especialmente quando:
1. O prompt é muito longo (117 conversas, 1000 mensagens)
2. O schema tem muitos campos obrigatórios
3. O contexto é em português

## Solução Proposta

Implementar múltiplas estratégias de fallback e reforçar as instruções:

### 1. Reforçar instrução no prompt de sistema

Adicionar instrução explícita obrigando o modelo a usar a função:

```typescript
content: `Você é um especialista em análise de qualidade de atendimento...

IMPORTANTE: Você DEVE OBRIGATORIAMENTE chamar a função analyze_conversations para fornecer sua análise. 
NÃO escreva texto livre. APENAS chame a função com os dados estruturados.`
```

### 2. Adicionar logging da resposta completa

Para debug futuro, logar a estrutura da resposta:

```typescript
console.log('AI response structure:', JSON.stringify({
  hasToolCalls: !!aiData.choices?.[0]?.message?.tool_calls,
  contentPreview: aiData.choices?.[0]?.message?.content?.substring(0, 100)
}));
```

### 3. Melhorar o parsing de fallback

Se a IA retornar texto, tentar extrair JSON com regex mais robusto:

```typescript
// Tentar extrair JSON de qualquer lugar do texto
const jsonMatch = aiContent.match(/\{[\s\S]*"overall_score"[\s\S]*\}/);
if (jsonMatch) {
  const rawResult = JSON.parse(jsonMatch[0]);
  // ...
}
```

### 4. Adicionar retry automático com prompt simplificado

Se a primeira tentativa falhar, fazer segunda tentativa com mensagem mais curta:

```typescript
if (!analysisResult) {
  console.log('First attempt failed, retrying with simplified prompt...');
  // Segunda tentativa com apenas 10 conversas
  const simplifiedConversations = conversationsWithMessages.slice(0, 10);
  // ... nova chamada
}
```

### 5. Considerar trocar para modelo mais robusto

O `google/gemini-2.5-pro` ou `openai/gpt-5-mini` podem ter melhor suporte para function calling forçado.

## Alterações Técnicas

### Arquivo: `supabase/functions/analyze-conversations/index.ts`

**Mudanças:**

1. **Linhas 384-395** - Reforçar prompt de sistema com instrução obrigatória de usar a função
2. **Linhas 462-464** - Adicionar logging detalhado da resposta da IA
3. **Linhas 479-496** - Melhorar regex de extração de JSON do texto
4. **Após linha 496** - Implementar retry com prompt simplificado
5. **Linha 381** - Considerar usar `google/gemini-2.5-pro` ao invés de `flash`

## Resultado Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| IA retorna texto ao invés de tool_call | Erro de parsing | Extração via regex ou retry |
| Prompt muito longo | Modelo ignora function calling | Retry com prompt simplificado |
| Debugging | Logs vagos | Estrutura completa da resposta logada |

## Arquivos a Modificar

1. **Edge Function**: `supabase/functions/analyze-conversations/index.ts`

## Testes Recomendados

Após a correção:
1. Gerar novo relatório para "Mercearia Saudável" no período de 20/01 a 30/01
2. Verificar logs para confirmar que a função foi chamada corretamente
3. Verificar que o relatório foi gerado com sucesso

