

## Diagnóstico: Análises de Oportunidade Imprecisas

### Problemas Identificados

1. **Modelo fraco (`gpt-4.1-nano`)**: Este é o modelo mais barato e limitado. Para análise complexa de vendas com múltiplos deals e contexto de conversa, ele não tem capacidade de raciocínio suficiente para gerar insights precisos.

2. **Campos personalizados ausentes**: A análise NÃO inclui `custom_fields` dos deals (ex: "local do evento", "valor da venda", "data do evento"). Informações cruciais do negócio são ignoradas.

3. **Contexto de conversa truncado**: Apenas os últimos 3.000 caracteres da conversa são enviados (`messagesText.slice(-3000)`), e apenas 30 mensagens por conversa. Mensagens importantes do início podem ser cortadas.

4. **50 deals de uma vez**: Enviar muitos deals simultaneamente para um modelo fraco dilui a qualidade da análise de cada um.

5. **Sem contexto das etapas**: O prompt não explica o significado de cada etapa do funil, então a IA não sabe o que significa estar em "Proposta Enviada" vs "Primeiro Contato".

### Plano de Correção

#### 1. Trocar modelo para Gemini 2.5 Flash (via Lovable AI Gateway)
- Substituir chamada direta à OpenAI pelo gateway Lovable AI
- Usar `google/gemini-2.5-flash` — bom raciocínio, multimodal, custo razoável
- Não requer API key do usuário

#### 2. Incluir campos personalizados dos deals
- Buscar `custom_fields` na query de `funnel_deals`
- Buscar definições dos campos (`custom_field_definitions`) para usar nomes legíveis
- Incluir no contexto enviado à IA como dados do negócio

#### 3. Incluir descrição das etapas do funil
- Adicionar ao prompt a lista de etapas com seus nomes e tipos (aberta/ganho/perdido)
- Dar à IA contexto sobre a progressão do funil

#### 4. Melhorar prompt com mais estrutura
- Instruir a IA a considerar campos personalizados como indicadores de maturidade
- Pedir análise mais granular: sinais positivos, negativos e neutros
- Aumentar limite de contexto de conversa de 3.000 para 5.000 chars

#### 5. Reduzir batch e melhorar qualidade
- Reduzir de 50 para 30 deals por batch para dar mais atenção a cada um
- Randomizar seleção (já existe lógica de exclusão)

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/analyze-funnel-opportunities/index.ts` | Trocar modelo, incluir custom_fields, melhorar prompt, adicionar contexto de etapas |

### Prompt Melhorado (resumo)
```
Você é um analista de vendas especialista.
ETAPAS DO FUNIL: [lista com nomes e significados]
Para cada deal, considere:
- Campos personalizados (dados do negócio)
- Histórico de conversas (sinais de compra)
- Tempo no funil e etapa atual
- Valor do negócio
Gere scores realistas baseados em evidências concretas.
Se não há conversa ou dados, o score deve ser baixo.
```

