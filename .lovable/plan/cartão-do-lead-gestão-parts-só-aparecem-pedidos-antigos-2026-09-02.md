# Cartão do lead (Gestão Parts): só aparecem pedidos antigos

## Problema encontrado

O botão "Atualizar" do cartão do lead chama a ação `lead_sync` da função `gestao-parts-api`. O ERP não filtra pedidos por cliente no feed v3, então a função baixa o feed inteiro dos últimos 365 dias (todos os tipos: ORCAMENTO, CONDICIONAL, PRE-VENDA, E-COMMERCE) e filtra no nosso lado por código/CPF/telefone.

Essa varredura tem um teto de 60 blocos aplicado da forma errada:

```text
totalblocos = min(totalblocos_real, 60)     // ex.: min(400, 60) = 60
varre blocos 60, 59, ... 2, 1
```

O comentário do código diz que se varre "do último bloco para o primeiro" para pegar os mais novos, mas o "último" passa a ser o bloco 60 e não o bloco real (ex.: 400). Como o feed vem em ordem cronológica crescente, os blocos 1–60 são justamente os **mais antigos** do período. Resultado: o cartão só recebe pedidos velhos e os recentes nunca entram na varredura.

Há ainda dois agravantes:

1. Prazo de 35s: mesmo com o intervalo certo, uma varredura de centenas de blocos estoura o tempo e grava um resultado parcial.
2. O `lead_sync` **substitui** o snapshot salvo (`gestao_parts_lead_data.pedidos`) pelo resultado da varredura. Uma varredura parcial/errada apaga pedidos que já estavam corretos no cartão — inclusive os que o job diário `gestao-parts-sync-leads` (janela de 15 dias, pedidos recentes) havia gravado.

## Solução proposta

### 1. Varrer do bloco real mais recente para trás
Em `lead_sync` (`supabase/functions/gestao-parts-api/index.ts`):
- Guardar `totalReal = first.totalblocos` e iniciar a varredura em `totalReal`, descendo até `max(2, totalReal - MAX_BLOCOS)`.
- O teto passa a limitar **quantos** blocos são lidos, não **até onde** se lê — sempre priorizando os mais recentes.

### 2. Janela padrão menor + opção de histórico
- Padrão: últimos 90 dias (traz pedidos/orçamentos atuais com poucos blocos e dentro do tempo).
- Parâmetro opcional `dias` (até 365) para quem quiser puxar o histórico completo, acionado por um botão secundário no cartão ("Buscar histórico de 12 meses").

### 3. Nunca perder pedidos já salvos
- Antes de gravar, mesclar os pedidos encontrados com os do snapshot atual, deduplicando por número do pedido, reordenando por data/hora de emissão (mais novo primeiro) e recalculando `pedidos_count` / `pedidos_total`.
- Se a varredura foi parcial (deadline), devolver `parcial: true` e exibir aviso no cartão em vez de sobrescrever silenciosamente.

### 4. Alinhar o job diário
- `gestao-parts-sync-leads` também faz upsert do snapshot: aplicar a mesma mesclagem, para o job de 15 dias não apagar o histórico trazido manualmente.

## Detalhes técnicos
- Arquivos: `supabase/functions/gestao-parts-api/index.ts` (bloco `lead_summary`/`lead_sync`), `supabase/functions/gestao-parts-sync-leads/index.ts`, `src/components/inbox/lead-panel/GestaoPartsLeadTab.tsx`, `src/hooks/useGestaoPartsLeadData.ts`.
- Sem migração de banco; a coluna `pedidos` (jsonb) continua a mesma.
- Mesma correção de intervalo de blocos pode ser reaproveitada no scan de orçamentos (`_shared/gestaoPartsOrcamento.ts`), que hoje corta em `min(total, maxBlocos)` a partir do bloco 1.
