# Corrigir o Lead ID inválido/duplicado no painel do chat

## O que está acontecendo (verificado no banco)

O Lead ID (`contact_display_id`) **é gerado sim** — nos últimos 7 dias, 861 contatos criados e nenhum sem ID. O problema é que a numeração é feita **por usuário**, e não por organização:

- Owner (Grupo Wil): 11.443 contatos, IDs de `0001` até `11436`
- Membro A: 8.984 contatos, IDs de `0001` até `8984`
- Membro B: 448 contatos, IDs de `0001` até `0448`

Resultado: o ID `0001` existe 37 vezes no sistema, `0002` 32 vezes, e assim por diante. Quando um membro cria/associa um lead, ele recebe um número baixo que **já pertence a outro lead da mesma equipe** — por isso o ID aparece "inválido": buscar por ele traz outro lead, ou parece que o lead não foi criado.

Um segundo problema contribui no fluxo "Nova Conversa": ao digitar um número, o sistema procura contato existente comparando apenas os **10 últimos dígitos** do telefone. Isso pode casar com um contato diferente (outro DDI, número parecido) e abrir o chat/ID de outra pessoa.

## Correção proposta

### 1. Numeração de Lead ID por organização
- Criar uma tabela de contadores por organização (`contact_id_counters`) com as permissões necessárias.
- Reescrever o gatilho `generate_contact_display_id` para:
  - resolver a organização a partir de `user_id` (`resolve_user_organization_id`);
  - pegar o próximo número **da organização** com trava (evita duplicidade em inserções simultâneas);
  - manter o formato atual com zeros à esquerda;
  - preservar IDs externos informados na importação (não sobrescrever quando o ID já vem preenchido).
- Trocar o índice único de `(user_id, contact_display_id)` para o escopo organizacional.

### 2. Regularizar os IDs já existentes
- Para cada organização: manter o ID de quem o recebeu primeiro (não muda nada para o owner, que já tem a sequência mais longa) e **renumerar apenas os duplicados**, atribuindo números novos acima do maior número da organização.
- Inicializar o contador de cada organização com o maior número existente após o ajuste.
- Assim, ninguém perde um ID que já usa hoje; só os conflitos são resolvidos.

### 3. Correspondência de telefone mais segura na "Nova Conversa"
- Em `NewConversationDialog.tsx`, comparar o telefone normalizado completo (DDI + DDD + número, com a regra do 9º dígito) em vez de "últimos 10 dígitos", para não abrir/associar o contato errado.

### 4. Atualização imediata na tela
- Após criar contato ou associar um contato existente ao lead, invalidar as queries de `conversations`/`contacts` para o painel direito exibir o ID recém-gerado sem precisar de F5.

## Detalhes técnicos

- Migração: nova tabela `public.contact_id_counters(organization_id uuid pk, last_number int)` com GRANTs (`service_role` total, leitura para `authenticated`) e RLS restrita à própria organização.
- Gatilho `BEFORE INSERT ON public.contacts` reescrito com `pg_advisory_xact_lock` por organização.
- Backfill executado em lote (`UPDATE ... FROM` com `row_number()`), sem tocar em contatos cujo ID já é único na organização.
- Frontend: `src/components/inbox/NewConversationDialog.tsx` (normalização) e o hook de criação de conversa/contato (invalidações).

## Verificação após a correção

- Rodar consulta confirmando zero `contact_display_id` repetido dentro da mesma organização.
- Criar um lead novo pelo Inbox com um usuário membro e confirmar que o ID exibido no painel direito é único e sequencial na equipe.
