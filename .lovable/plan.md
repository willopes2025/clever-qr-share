

## Busca Global de Leads em Todos os Funis

### Problema
A busca atual só funciona dentro de um funil específico e apenas na visualização de lista. O usuário precisa de uma busca global — como o "Busca e filtro" do Kommo — que pesquise leads em **todos os funis** simultaneamente, por nome, telefone, cidade ou qualquer dado do contato.

### Solução
Adicionar uma barra de busca global no topo da página de Funis (ao lado do seletor de funil). Ao digitar, abre um painel dropdown/overlay com resultados em formato de lista, agrupados por funil e etapa, mostrando as informações principais do lead.

```text
┌─────────────────────────────────────────────────────┐
│  [Seletor Funil ▼]  [🔍 Busca e filtro...       ]  │
│                                                     │
│  ┌─ Resultados (quando digitando) ─────────────┐   │
│  │  FUNIL: Clientes - Fundo de Fun...           │   │
│  │    ● Validação da Venda                      │   │
│  │      - João Silva  |  27999...  |  R$1.200   │   │
│  │    ● Lançado OS                              │   │
│  │      - Maria Santos | 27998... |  R$780      │   │
│  │                                              │   │
│  │  FUNIL: Pós-Venda                            │   │
│  │    ● Acompanhamento                          │   │
│  │      - João Silva  |  27999...  |  R$500     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### O que será feito

1. **Novo componente `FunnelGlobalSearch.tsx`** — Campo de busca com dropdown de resultados. Pesquisa server-side em `contacts` (nome, telefone, email, custom_fields) e cruza com `funnel_deals` em todos os funis. Resultados agrupados por funil > etapa, com click para navegar ao deal.

2. **Busca server-side** — Reutiliza o padrão já existente no `FunnelListView` (busca por nome com `ilike`, normalização NFD, busca por dígitos do telefone), mas sem filtro de `funnel_id`, buscando em todos os funis. Inclui busca em `custom_fields` para encontrar por cidade/município.

3. **Integração na página `Funnels.tsx`** — O componente de busca é posicionado na barra de controles, entre o seletor de funil e as tabs de visualização. Ao clicar em um resultado, seleciona o funil correspondente e abre o deal.

4. **Comportamento** — Debounce de 400ms, mínimo 3 caracteres para texto ou 4 dígitos para telefone. Máximo 50 resultados. Fechar ao clicar fora ou pressionar Esc.

### Detalhes técnicos
- Busca em `contacts.name`, `contacts.phone`, `contacts.email`, e `contacts.custom_fields::text` via `ilike`
- Join com `funnel_deals` (todas as funnel_ids do usuário) + `funnel_stages` para nome/cor da etapa + `funnels` para nome do funil
- Agrupamento client-side por `funnel_id` > `stage_id`
- Componente usa `Popover` do shadcn para o dropdown de resultados

