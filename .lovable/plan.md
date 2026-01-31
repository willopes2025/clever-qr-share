
# Plano: Links de Formulário Rastreáveis com Dados Dinâmicos nas Automações

## Resumo do Pedido

O usuário deseja criar links de formulários rastreáveis com parâmetros estáticos pré-definidos que são gerados dinamicamente a partir de automações de funil. Por exemplo: quando um card é movido para uma nova etapa, uma automação pode enviar uma mensagem com um link de formulário contendo dados como data do evento, cidade, vendedor, etc.

## Como Funciona Atualmente

O sistema já possui:
- **Formulários públicos** com suporte a `url_static_params` (parâmetros estáticos na URL)
- **Automações de funil** com diversos tipos de ação (enviar mensagem, mover etapa, etc.)
- **Edge Function `submit-form`** que captura parâmetros estáticos no metadata da submissão

## Solução Proposta

Criar uma nova ação nas automações chamada **"Enviar Link de Formulário"** que:

1. Permite selecionar um formulário publicado
2. Define parâmetros estáticos dinâmicos (usando variáveis do deal/contato)
3. Gera um link único e rastreável
4. Envia o link via WhatsApp com uma mensagem personalizada

## Alterações Necessárias

### 1. Novo Tipo de Ação: `send_form_link`

Adicionar ao `AutomationFormDialog.tsx`:

```typescript
type ActionType = 
  // ... existentes
  | 'send_form_link'; // Nova ação
```

### 2. Interface de Configuração no Dialog

Nova seção no formulário de automação para:
- Selecionar formulário publicado
- Mensagem de acompanhamento (com variáveis)
- Lista de parâmetros dinâmicos:
  - Chave (ex: `vendedor`, `data_evento`, `cidade`)
  - Valor (texto livre ou variável: `{{nome}}`, `{{etapa}}`, `{{funil}}`, `{{valor}}`)
  - Opção de usar valores do deal/contato

Variáveis disponíveis:
- `{{nome}}` - Nome do contato
- `{{telefone}}` - Telefone do contato
- `{{email}}` - Email do contato
- `{{valor}}` - Valor do deal
- `{{funil}}` - Nome do funil
- `{{etapa}}` - Nome da etapa atual
- `{{titulo}}` - Título do deal
- `{{data}}` - Data atual formatada
- `{{deal_id}}` - ID do deal (para rastreamento)

### 3. Processamento na Edge Function

Adicionar case `send_form_link` em `process-funnel-automations`:

```typescript
case 'send_form_link': {
  const formId = actionConfig.form_id as string;
  const messageTemplate = actionConfig.message as string;
  const dynamicParams = actionConfig.params as { key: string; value: string }[];
  
  // Buscar slug do formulário
  const { data: form } = await supabase
    .from('forms')
    .select('slug, name')
    .eq('id', formId)
    .eq('status', 'published')
    .single();
  
  // Substituir variáveis nos parâmetros
  const resolvedParams = dynamicParams.map(p => ({
    key: p.key,
    value: replaceVariables(p.value)
  }));
  
  // Construir URL com parâmetros path-based
  const baseUrl = `${publicUrl}/form/${form.slug}`;
  const paramsPath = resolvedParams
    .filter(p => p.key && p.value)
    .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('/');
  
  const formUrl = paramsPath ? `${baseUrl}/${paramsPath}` : baseUrl;
  
  // Enviar mensagem com link
  const message = replaceVariables(messageTemplate)
    .replace('{{link}}', formUrl);
  
  // ... envio via WhatsApp
}
```

### 4. Armazenar Origem do Link

Na submissão, os parâmetros serão salvos no `metadata.static_params`, permitindo:
- Identificar qual deal/automação gerou o lead
- Análise de campanhas e fontes
- Atribuição correta de leads

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/funnels/AutomationFormDialog.tsx` | Adicionar tipo `send_form_link` e UI de configuração |
| `supabase/functions/process-funnel-automations/index.ts` | Implementar processamento da nova ação |

## Fluxo de Uso

```text
1. Usuário cria automação "Enviar formulário de evento"
   ├── Gatilho: Quando entrar na etapa "Confirmação"
   └── Ação: Enviar link de formulário
       ├── Formulário: "Pesquisa de Satisfação"
       ├── Mensagem: "Olá {{nome}}! Por favor, preencha a pesquisa: {{link}}"
       └── Parâmetros:
           ├── vendedor = João Silva (fixo)
           ├── evento = "Evento Outubro 2024" (fixo)
           ├── deal_id = {{deal_id}} (dinâmico)
           └── etapa_origem = {{etapa}} (dinâmico)

2. Card é movido para etapa "Confirmação"
   └── Automação dispara
       └── Mensagem enviada via WhatsApp:
           "Olá Maria! Por favor, preencha a pesquisa: 
            https://site.com/form/pesquisa-satisfacao/vendedor=João%20Silva/evento=Evento%20Outubro%202024/deal_id=abc123/etapa_origem=Confirmação"

3. Cliente preenche o formulário
   └── Submissão salva com metadata.static_params:
       {
         "vendedor": "João Silva",
         "evento": "Evento Outubro 2024",
         "deal_id": "abc123",
         "etapa_origem": "Confirmação"
       }
```

## Interface Visual da Configuração

```text
┌─────────────────────────────────────────────────────────┐
│ Ação: Enviar Link de Formulário                         │
├─────────────────────────────────────────────────────────┤
│ Formulário: [Pesquisa de Satisfação       ▼]            │
│                                                         │
│ Mensagem:                                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Olá {{nome}}! Por favor, preencha a pesquisa:       │ │
│ │ {{link}}                                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Parâmetros de Rastreamento:                             │
│ ┌───────────────┬────────────────────────┬───┐          │
│ │ vendedor      │ João Silva             │ ✕ │          │
│ │ evento        │ Evento Outubro 2024    │ ✕ │          │
│ │ deal_id       │ {{deal_id}}            │ ✕ │          │
│ │ etapa_origem  │ {{etapa}}              │ ✕ │          │
│ └───────────────┴────────────────────────┴───┘          │
│ [+ Adicionar Parâmetro]                                 │
│                                                         │
│ Variáveis disponíveis: {{nome}}, {{etapa}}, {{funil}},  │
│ {{valor}}, {{titulo}}, {{data}}, {{deal_id}}            │
└─────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Rastreabilidade completa**: Saber exatamente de onde veio cada lead
2. **Personalização**: Dados dinâmicos baseados no contexto do deal
3. **Automação**: Links gerados automaticamente sem intervenção manual
4. **Análise**: Métricas de conversão por campanha, vendedor, etapa, etc.
