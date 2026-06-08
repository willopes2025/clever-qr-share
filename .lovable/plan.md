## Objetivo

Já existe um cabeçalho que aparece entre mensagens quando o número/instância muda no chat (`ConversationCardHeader` em `MessageView.tsx`, linha ~1557). Hoje ele aparece sempre verde (Evolution) ou azul (Meta). Vamos:

1. Dar a esse divisor um visual de **linha separadora suave animada**, e não só um badge isolado.
2. Atribuir uma **cor única e estável por instância** (derivada do `instance_id` / `meta_phone_number_id`), para que cada número tenha sua própria cor — facilitando a percepção de qual instância está sendo usada.

Mudança puramente visual no inbox. Sem alterações em backend, lógica de envio, dados ou esquema.

## Mudanças

### 1. `src/components/inbox/ConversationCard.tsx` (`ConversationCardHeader`)
- Adicionar prop opcional `originKey: string` (ex.: `evo:<instance_id>` ou `meta:<phone_number_id>`) usada para gerar cor estável.
- Trocar o layout: em vez de só um "pill" central, renderizar uma **linha horizontal suave** atravessando a largura, com o pill (ícone + label + telefone) centralizado sobre ela (padrão do `ContactSeparator`/`DateSeparator`).
- Aplicar animação de entrada `animate-fade-in` (utilitário já existente no projeto) para o efeito suave.
- Gerar cor estável por instância via hash do `originKey` mapeado para uma paleta de ~10 tokens (emerald, blue, violet, amber, rose, cyan, fuchsia, lime, orange, teal). Para Meta manter o tom azul por padrão (continua sendo "API oficial"), mas variando levemente entre números Meta diferentes via mesmo esquema de hash. Usar classes Tailwind estáticas (mapa pré-definido para evitar purge dinâmico).
- A linha (`border-t`) usa a cor do divisor com baixa opacidade da cor escolhida; o pill usa fundo `cor/10`, borda `cor/20`, texto `cor-600 dark:cor-400`, mantendo o estilo atual.

### 2. `src/components/inbox/MessageView.tsx`
- Passar `originKey={currentOrigin}` para `<ConversationCardHeader>` (linha ~1557). Nenhuma outra alteração.

### Paleta (mapa fixo)

```text
emerald | blue | violet | amber | rose | cyan | fuchsia | lime | orange | teal
```

Função `getOriginColor(originKey)`:
- hash simples (sum char codes) % paleta.length → índice estável.
- retorna objeto `{ border, bg, text, line }` com classes Tailwind pré-escritas.

### Não muda
- Cores do `ProviderBadge` (badges pequenos na lista de conversas) ficam como estão para não confundir o significado verde=Lite / azul=API ali.
- Nenhuma alteração em lógica de envio, instâncias, automação ou banco.
