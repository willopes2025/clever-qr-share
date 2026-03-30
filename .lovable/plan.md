

## Diagnóstico: Dados do formulário de pré-venda no card do lead (Inbox)

### Investigação Realizada

Verifiquei o banco de dados em detalhe:

1. **Os dados DO formulário ESTÃO sendo salvos corretamente** — tanto nos campos personalizados do contato (`contacts.custom_fields`) quanto nos campos do deal (`funnel_deals.custom_fields`). Ex: CPF, Data de Nascimento, Município, Consultor, Modelo da Lente, Valor da Venda, etc.

2. **As definições de campos existem** — todos os `field_key` gravados nos custom_fields possuem definições correspondentes em `custom_field_definitions` com os `entity_type` corretos (contact/lead).

3. **Problema identificado**: Os 5 contatos mais recentes do formulário "Cadastro Pré-Venda" **não possuem conversas no WhatsApp** (`conversation_id = null`). O inbox exibe apenas contatos que têm conversas ativas. Sem conversa, não há card do lead para exibir os dados.

4. **Problema secundário**: Quando um contato JÁ possui conversa e o formulário é preenchido, os dados são salvos mas **a tela do inbox não atualiza automaticamente** porque o sistema de realtime (`useGlobalRealtime`) só monitora as tabelas `conversations` e `inbox_messages`, não `contacts` nem `funnel_deals`.

### Solução

**Arquivo: `src/hooks/useGlobalRealtime.ts`**
- Adicionar assinaturas realtime para as tabelas `contacts` e `funnel_deals`
- Quando dados dessas tabelas forem alterados, invalidar as queries relevantes (`conversations`, `contact-deal`, `contacts`)

Isso garante que, ao preencher o formulário para um contato que já tem conversa no inbox, os dados atualizem automaticamente no card do lead sem necessidade de recarregar a página.

### Observação importante
Os contatos recentes de Linhares (José Silva Vilabôa, Maria Aparecida, etc.) não aparecem no inbox porque nunca tiveram uma conversa WhatsApp. Eles estão visíveis no funil de vendas. Para aparecerem no inbox, é necessário que uma conversa WhatsApp seja iniciada com eles.

### Detalhes Técnicos
- Tabelas a monitorar via realtime: `contacts` (UPDATE) e `funnel_deals` (INSERT, UPDATE)
- Queries a invalidar: `conversations`, `contact-deal`, `contacts`, `funnel-deals`
- Nenhuma alteração de banco de dados (apenas precisa habilitar realtime para `contacts` e `funnel_deals` via migration `ALTER PUBLICATION`)
- 1 arquivo frontend modificado + 1 migration SQL

