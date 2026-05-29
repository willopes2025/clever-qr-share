## Diagnóstico

As mensagens "Padrão" do **Banco de Conteúdos** (aba `Padrão (0)` na tela de Aquecimento) são inseridas por um cron job diário.

**Arquivo:** `supabase/functions/generate-daily-warming-news/index.ts`
**Cron:** `generate-daily-warming-news` agendado em `0 9 * * *` (diariamente às 9h UTC), criado na migration `20260115191524_b3a064cb...sql`.

O que ele faz a cada execução:
- Chama o OpenAI e gera ~20 mensagens novas
- Insere todas em `warming_content` com `user_id = '00000000-0000-0000-0000-000000000000'` (usuário "sistema") — que é exatamente o filtro usado pela aba **Padrão** em `WarmingContentManager.tsx` (linha 164).

Resultado: quando o cliente deleta as mensagens padrão, no dia seguinte às 6h (Brasil) o cron regenera ~20 novas e elas voltam a aparecer na aba "Padrão". A exclusão funciona corretamente (a policy `Authenticated users can delete default warming content` existe), mas não há nada que impeça o cron de repovoar a tabela.

A geração via botão **"Gerar com IA"** (em `useGenerateWarmingContent`) salva com `user_id = user.id` e vira "Meus Conteúdos" — esses são apagados pelo usuário e **não** retornam, pois nenhum job recria conteúdos por usuário.

## Solução proposta

Desativar a geração automática diária de conteúdo padrão. O cliente continua podendo gerar mensagens manualmente pelo botão "Gerar com IA" (que cria como "Meus Conteúdos" e respeita a exclusão).

### Passos

1. **Migration** para remover o agendamento:
   ```sql
   SELECT cron.unschedule('generate-daily-warming-news');
   ```
   (Mantemos o agendamento `auto-pair-warming-pool` intacto.)

2. **Limpar os conteúdos padrão existentes** (opcional, evita que o cliente precise apagar manualmente o que já está na tabela):
   ```sql
   DELETE FROM public.warming_content
   WHERE user_id = '00000000-0000-0000-0000-000000000000';
   ```

3. **Edge function** `generate-daily-warming-news`: pode ser mantida (não causa mais dano sem o cron) ou deletada. Recomendo **deletar** para evitar reativação acidental.

### Alternativa (caso queira manter o recurso opcional)

Em vez de remover, posso adicionar uma flag `disable_default_seed` por organização e fazer o cron filtrar — mas isso é bem mais código. Recomendo a abordagem de remover, já que o cliente quer que apagado **não volte**.

## Confirmação

Você quer que eu siga com a opção **remover o cron + apagar conteúdos padrão existentes + deletar a edge function**? Ou prefere apenas desabilitar o cron e manter o restante?
